"""Alert and notification endpoints."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, SessionDep
from app.models.user import UserRole
from app.schemas.alert import AlertRead, AlertsListResponse, OutbreakCluster, PushTokenRegister
from app.services.notification_service import (
    get_active_outbreak_clusters,
    get_user_alerts,
    mark_alert_as_read,
)

router = APIRouter(prefix="/alerts", tags=["Alerts & Notifications"])


@router.get(
    "/my",
    response_model=AlertsListResponse,
    summary="Get alerts and notifications for the current authenticated user",
)
def fetch_my_alerts(
    user: CurrentUser,
    session: SessionDep,
    limit: int = Query(default=50, ge=1, le=100),
) -> AlertsListResponse:
    """Fetch notifications relevant to the logged-in user (personal + role-broadcast)."""
    data = get_user_alerts(user=user, session=session, limit=limit)
    return AlertsListResponse(
        alerts=[
            AlertRead(
                id=a.id,
                user_id=a.user_id,
                target_role=a.target_role,
                bovine_id=a.bovine_id,
                complaint_id=a.complaint_id,
                title=a.title,
                message=a.message,
                alert_type=a.alert_type,
                severity=a.severity,
                is_read=a.is_read,
                data_json=a.data_json,
                created_at=a.created_at,
            )
            for a in data["alerts"]
        ],
        unread_count=data["unread_count"],
    )


@router.patch(
    "/{alert_id}/read",
    response_model=AlertRead,
    summary="Mark an alert as read",
)
def read_alert(
    alert_id: uuid.UUID,
    user: CurrentUser,
    session: SessionDep,
) -> AlertRead:
    """Mark a specific notification as read."""
    alert = mark_alert_as_read(alert_id=alert_id, user=user, session=session)
    return AlertRead(
        id=alert.id,
        user_id=alert.user_id,
        target_role=alert.target_role,
        bovine_id=alert.bovine_id,
        complaint_id=alert.complaint_id,
        title=alert.title,
        message=alert.message,
        alert_type=alert.alert_type,
        severity=alert.severity,
        is_read=alert.is_read,
        data_json=alert.data_json,
        created_at=alert.created_at,
    )


@router.post(
    "/push-token",
    status_code=status.HTTP_200_OK,
    summary="Register Expo mobile push token for the current user",
)
def register_push_token(
    payload: PushTokenRegister,
    user: CurrentUser,
    session: SessionDep,
) -> dict:
    """Store or update the user's mobile device push token (ExponentPushToken[...])."""
    user.push_token = payload.push_token
    session.add(user)
    session.commit()
    return {"status": "ok", "message": "Push token registered successfully"}


@router.get(
    "/outbreaks",
    response_model=List[OutbreakCluster],
    summary="Get active epidemiological disease clusters (Authority / Vets)",
)
def fetch_outbreaks(
    user: CurrentUser,
    session: SessionDep,
) -> List[OutbreakCluster]:
    """Inspect spatial clusters of mastitis / disease across villages in the last 48 hours."""
    # Authorities, doctors, and inspectors can inspect regional outbreak clusters
    return get_active_outbreak_clusters(session=session)


@router.post(
    "/simulate",
    response_model=AlertRead,
    summary="Simulate a test alert for the current user based on their role",
)
def simulate_test_alert(
    user: CurrentUser,
    session: SessionDep,
    alert_kind: Optional[str] = Query(default=None, description="Optional 'environment' or 'mastitis'"),
) -> AlertRead:
    """Generate a realistic test alert for demonstrations and testing."""
    from sqlmodel import select
    from app.models.alert import AlertSeverity, AlertType
    from app.models.cow import Bovine
    from app.services.notification_service import create_alert

    role = str(user.role)
    if alert_kind == "environment" or (role == "farmer" and alert_kind == "barn"):
        alert = create_alert(
            session=session,
            user_id=user.id,
            title="⚠️ Barn Hazard: Toxic Ammonia Level (28.4 ppm)",
            message="Barn ammonia gas is at 28.4 ppm (safe limit is 25 ppm). High ammonia causes respiratory tissue inflammation and increases bovine infection risk. Activate shed exhaust fans and clear accumulated waste immediately.",
            alert_type=AlertType.barn_environment_hazard,
            severity=AlertSeverity.warning,
            data={"hazard": "ammonia", "ammonia_ppm": 28.4, "threshold": 25.0},
        )
    elif role == "doctor":
        alert = create_alert(
            session=session,
            user_id=user.id,
            title="🚨 New Case Assigned: CMP-0024",
            message="Clinical emergency assigned: Cow showing high fever and udder swelling in Mandya.",
            alert_type=AlertType.case_assigned,
            severity=AlertSeverity.critical,
            data={"complaint_number": 24, "priority": "critical"},
        )
    elif role == "authority":
        alert = create_alert(
            session=session,
            user_id=user.id,
            target_role="authority",
            title="⚠️ Disease Outbreak Alert: Mandya North",
            message="Epidemiological cluster detected: 4 cattle in Mandya North flagged with acute mastitis risk within 48h.",
            alert_type=AlertType.outbreak_warning,
            severity=AlertSeverity.critical,
            data={"village_or_place": "Mandya North", "case_count": 4},
        )
    else:
        # Farmer
        cow = session.exec(select(Bovine).where(Bovine.farmer_id == user.id)).first()
        cow_name = cow.name if cow else "Gauri (KA-04-101)"
        cow_id = cow.id if cow else None
        alert = create_alert(
            session=session,
            user_id=user.id,
            bovine_id=cow_id,
            title=f"🚨 High Mastitis Risk: {cow_name} (86/100)",
            message=f"Collar rumination dropped 38% and milk conductivity spiked in {cow_name}. Immediate isolation and veterinary check advised.",
            alert_type=AlertType.high_risk_mastitis,
            severity=AlertSeverity.critical,
            data={"cow_name": cow_name, "risk_score": 86.0},
        )

    return AlertRead(
        id=alert.id,
        user_id=alert.user_id,
        target_role=alert.target_role,
        bovine_id=alert.bovine_id,
        complaint_id=alert.complaint_id,
        title=alert.title,
        message=alert.message,
        alert_type=alert.alert_type,
        severity=alert.severity,
        is_read=alert.is_read,
        data_json=alert.data_json,
        created_at=alert.created_at,
    )

