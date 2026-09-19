"""Notification service — handles alert creation, Expo push notifications, and outbreak cluster detection."""

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlmodel import Session, select, func

from app.models.alert import Alert, AlertSeverity, AlertType
from app.models.cow import Bovine
from app.models.risk import RiskScore
from app.models.user import User, UserRole
from app.schemas.alert import OutbreakCluster

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


# ─── Push Notification Dispatch ───────────────────────────────────────────────

def send_expo_push_notification(
    push_token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> bool:
    """Send a mobile push notification via the Expo Push Notification Service."""
    if not push_token or not (push_token.startswith("ExponentPushToken[") or push_token.startswith("ExpoPushToken[")):
        logger.debug("Skipping push notification: invalid or missing token: %s", push_token)
        return False

    payload = {
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {},
    }

    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.post(
                EXPO_PUSH_URL,
                json=payload,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
            return resp.status_code == 200
    except Exception as exc:
        logger.warning("Failed to deliver Expo push notification: %s", exc)
        return False


# ─── Alert Persistence & Delivery ─────────────────────────────────────────────

def create_alert(
    session: Session,
    title: str,
    message: str,
    alert_type: AlertType,
    severity: AlertSeverity = AlertSeverity.warning,
    user_id: Optional[uuid.UUID] = None,
    target_role: Optional[str] = None,
    bovine_id: Optional[uuid.UUID] = None,
    complaint_id: Optional[uuid.UUID] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Alert:
    """Create and persist an alert record, and dispatch push notification if token exists."""
    alert = Alert(
        user_id=user_id,
        target_role=target_role,
        bovine_id=bovine_id,
        complaint_id=complaint_id,
        title=title,
        message=message,
        alert_type=alert_type,
        severity=severity,
        data_json=json.dumps(data) if data else None,
        created_at=datetime.now(timezone.utc),
    )
    session.add(alert)
    session.commit()
    session.refresh(alert)

    # 1. Direct user push
    if user_id:
        user = session.get(User, user_id)
        if user and user.push_token:
            send_expo_push_notification(user.push_token, title, message, data)

    # 2. Broadcast push to all users of a given role (e.g. Authority)
    if target_role:
        role_users = session.exec(select(User).where(User.role == target_role, User.is_active == True)).all()
        for u in role_users:
            if u.push_token:
                send_expo_push_notification(u.push_token, title, message, data)

    return alert


# ─── Risk Alert Trigger (>70% score) ──────────────────────────────────────────

def check_and_trigger_risk_alert(
    cow_id: uuid.UUID,
    risk_score: float,
    session: Session,
) -> Optional[Alert]:
    """Inspects a newly calculated risk score. If >70%, triggers a critical alert for the farmer."""
    if risk_score < 70.0:
        return None

    cow = session.get(Bovine, cow_id)
    if not cow or not cow.is_active or not cow.farmer_id:
        return None

    # De-duplicate: Check if an active unread high-risk alert for this cow was created in the last 24h
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    existing_alert = session.exec(
        select(Alert).where(
            Alert.bovine_id == cow_id,
            Alert.alert_type == AlertType.high_risk_mastitis,
            Alert.created_at >= cutoff,
            Alert.is_read == False,
        )
    ).first()

    if existing_alert:
        return existing_alert

    farmer = session.get(User, cow.farmer_id)
    cow_name = cow.name or cow.tag_number or f"Cow {str(cow.id)[:6]}"

    alert = create_alert(
        session=session,
        user_id=cow.farmer_id,
        bovine_id=cow.id,
        title=f"🚨 High Mastitis Risk: {cow_name} ({risk_score:.0f}/100)",
        message=(
            f"Sensors indicate acute mastitis risk for {cow_name}. "
            "Isolate the animal immediately and contact a veterinarian."
        ),
        alert_type=AlertType.high_risk_mastitis,
        severity=AlertSeverity.critical,
        data={
            "cow_id": str(cow.id),
            "cow_name": cow_name,
            "risk_score": risk_score,
            "tag_number": cow.tag_number,
        },
    )

    # Trigger epidemiological cluster check for the farmer's village
    if farmer and farmer.place:
        check_outbreak_cluster(farmer.place, session)

    return alert


# ─── Outbreak Cluster Detector (Authority Warning) ────────────────────────────

def check_outbreak_cluster(
    village_or_place: Optional[str],
    session: Session,
) -> Optional[Alert]:
    """Evaluates whether >=3 high-risk animals or complaints exist in the same place in the last 48h."""
    if not village_or_place:
        return None

    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)

    # Find all farmers in this village
    village_farmers = session.exec(
        select(User.id).where(User.place == village_or_place, User.role == UserRole.farmer)
    ).all()

    if not village_farmers:
        return None

    # Count high-risk risk scores in this village in last 48h
    high_risk_cows = session.exec(
        select(Bovine.id).join(RiskScore, RiskScore.cow_id == Bovine.id).where(
            Bovine.farmer_id.in_(village_farmers),
            RiskScore.score >= 70.0,
            RiskScore.scored_at >= cutoff,
        ).distinct()
    ).all()

    distinct_count = len(high_risk_cows)

    if distinct_count >= 3:
        # Check if an outbreak alert was already sent for this village in the last 24h
        alert_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        existing_outbreak = session.exec(
            select(Alert).where(
                Alert.alert_type == AlertType.outbreak_warning,
                Alert.created_at >= alert_cutoff,
            )
        ).all()

        for a in existing_outbreak:
            if village_or_place.lower() in a.title.lower() or village_or_place.lower() in a.message.lower():
                return a

        # Trigger Outbreak Alert to all district authorities!
        cow_ids_str = [str(cid) for cid in high_risk_cows]
        return create_alert(
            session=session,
            target_role=UserRole.authority.value,
            title=f"⚠️ Disease Outbreak Alert: {village_or_place}",
            message=(
                f"Epidemiological cluster detected: {distinct_count} cattle in {village_or_place} "
                "flagged with acute mastitis risk within the last 48 hours. Field inspection recommended."
            ),
            alert_type=AlertType.outbreak_warning,
            severity=AlertSeverity.critical,
            data={
                "village_or_place": village_or_place,
                "case_count": distinct_count,
                "affected_cow_ids": cow_ids_str,
            },
        )

# ─── Barn Environment Deterioration Detector ──────────────────────────────────

def check_and_trigger_environment_alert(
    reading: Any,
    session: Session,
) -> Optional[Alert]:
    """Inspects a newly ingested barn environment reading.
    
    Triggers an alert if:
    1. Toxic ammonia buildup (>25 ppm)
    2. Wet bedding / poor floor hygiene (>50% bedding moisture or hygiene score >= 3)
    3. Severe heat stress (THI >= 78.0 or ambient temp >= 35°C)
    """
    farmer_id = reading.farmer_id
    if not farmer_id:
        return None

    # De-duplicate: check if an unread barn environment alert exists from last 6 hours
    cooldown = datetime.now(timezone.utc) - timedelta(hours=6)
    existing_alert = session.exec(
        select(Alert).where(
            Alert.user_id == farmer_id,
            Alert.alert_type == AlertType.barn_environment_hazard,
            Alert.created_at >= cooldown,
            Alert.is_read == False,
        )
    ).first()
    if existing_alert:
        return existing_alert

    # 1. Toxic Ammonia Level (>25 ppm)
    if reading.ammonia_ppm is not None and reading.ammonia_ppm > 25.0:
        is_critical = reading.ammonia_ppm >= 35.0
        return create_alert(
            session=session,
            user_id=farmer_id,
            title=f"⚠️ Barn Hazard: Toxic Ammonia Level ({reading.ammonia_ppm:.1f} ppm)",
            message=(
                f"Barn ammonia gas is at {reading.ammonia_ppm:.1f} ppm (safe limit is 25 ppm). "
                "High ammonia causes respiratory tissue inflammation and increases bovine infection risk. "
                "Activate shed exhaust fans and clear accumulated waste immediately."
            ),
            alert_type=AlertType.barn_environment_hazard,
            severity=AlertSeverity.critical if is_critical else AlertSeverity.warning,
            data={
                "hazard": "ammonia",
                "ammonia_ppm": reading.ammonia_ppm,
                "threshold": 25.0,
            },
        )

    # 2. Wet Bedding & Hygiene (>50% moisture or hygiene score >= 3)
    if reading.bedding_moisture > 50.0 or (reading.hygiene_score is not None and reading.hygiene_score >= 3):
        is_critical = reading.bedding_moisture >= 65.0 or (reading.hygiene_score == 4)
        return create_alert(
            session=session,
            user_id=farmer_id,
            title=f"⚠️ Barn Warning: High Bedding Moisture ({reading.bedding_moisture:.0f}%)",
            message=(
                f"Stall floor moisture is at {reading.bedding_moisture:.0f}%"
                f"{f' with hygiene grade {reading.hygiene_score}/4' if reading.hygiene_score else ''}. "
                "Damp bedding acts as a rapid breeding ground for environmental mastitis pathogens (E. coli, Strep uberis). "
                "Replace stall bedding and apply dry lime/disinfectant."
            ),
            alert_type=AlertType.barn_environment_hazard,
            severity=AlertSeverity.critical if is_critical else AlertSeverity.warning,
            data={
                "hazard": "bedding_moisture",
                "bedding_moisture": reading.bedding_moisture,
                "hygiene_score": reading.hygiene_score,
            },
        )

    # 3. Severe Heat Stress: THI = 0.8*T + (RH/100)*(T - 14.4) + 46.4
    temp = reading.ambient_temperature
    rh = reading.humidity
    thi = 0.8 * temp + (rh / 100.0) * (temp - 14.4) + 46.4
    if thi >= 78.0 or temp >= 35.0:
        is_critical = thi >= 84.0 or temp >= 38.0
        return create_alert(
            session=session,
            user_id=farmer_id,
            title=f"⚠️ Barn Heat Stress Warning (THI {thi:.0f})",
            message=(
                f"Barn ambient temperature is {temp:.1f}°C at {rh:.0f}% humidity (Temperature-Humidity Index: {thi:.0f}). "
                "Cattle are at acute risk of heat stress, reduced rumination, and lowered immunity. "
                "Ensure shade, active air circulation fans, and cool drinking water."
            ),
            alert_type=AlertType.barn_environment_hazard,
            severity=AlertSeverity.critical if is_critical else AlertSeverity.warning,
            data={
                "hazard": "heat_stress",
                "temperature": temp,
                "humidity": rh,
                "thi": round(thi, 1),
            },
        )

    return None


# ─── Query Helpers ────────────────────────────────────────────────────────────

def get_user_alerts(user: User, session: Session, limit: int = 50) -> Dict[str, Any]:
    """Fetch recent alerts for a user (both direct and role-based), with unread count."""
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    query = select(Alert).where(
        (Alert.user_id == user.id) | (Alert.target_role == role_str)
    ).order_by(Alert.created_at.desc()).limit(limit)

    alerts = session.exec(query).all()
    unread_count = sum(1 for a in alerts if not a.is_read)

    return {
        "alerts": alerts,
        "unread_count": unread_count,
    }


def mark_alert_as_read(alert_id: uuid.UUID, user: User, session: Session) -> Alert:
    """Mark an alert as read."""
    alert = session.get(Alert, alert_id)
    if not alert:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    alert.is_read = True
    session.add(alert)
    session.commit()
    session.refresh(alert)
    return alert


def get_active_outbreak_clusters(session: Session) -> List[OutbreakCluster]:
    """Return all active outbreak clusters across villages in the last 48 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    
    # Query distinct high-risk occurrences grouped by farmer place
    farmers = session.exec(select(User).where(User.role == UserRole.farmer, User.place != None)).all()
    place_to_farmers: Dict[str, List[uuid.UUID]] = {}
    for f in farmers:
        if f.place:
            place_to_farmers.setdefault(f.place, []).append(f.id)

    clusters: List[OutbreakCluster] = []

    for place, farmer_ids in place_to_farmers.items():
        high_risk_cows = session.exec(
            select(Bovine.id).join(RiskScore, RiskScore.cow_id == Bovine.id).where(
                Bovine.farmer_id.in_(farmer_ids),
                RiskScore.score >= 70.0,
                RiskScore.scored_at >= cutoff,
            ).distinct()
        ).all()

        if len(high_risk_cows) >= 2:  # report clusters of 2 or more for authority monitoring
            clusters.append(OutbreakCluster(
                village_or_place=place,
                case_count=len(high_risk_cows),
                severity="critical" if len(high_risk_cows) >= 3 else "warning",
                affected_cow_ids=[str(cid) for cid in high_risk_cows],
                alert_triggered=len(high_risk_cows) >= 3,
                latest_incident_at=datetime.now(timezone.utc),
            ))

    return clusters
