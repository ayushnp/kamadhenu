"""Tests for Alerts, Notifications, and Outbreak Detection."""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.alert import Alert, AlertSeverity, AlertType
from app.models.cow import Bovine
from app.models.risk import RiskScore
from app.models.user import User, UserRole
from app.services.notification_service import (
    check_and_trigger_risk_alert,
    check_outbreak_cluster,
    get_user_alerts,
    mark_alert_as_read,
    send_expo_push_notification,
)


def _register_user(client: TestClient, phone: str, role: str = "farmer", place: str = "Mandya") -> tuple[str, str]:
    """Helper to register and login a user."""
    client.post(
        "/api/v1/auth/register",
        json={"name": f"User {phone[-4:]}", "phone": phone, "password": "password123"},
    )
    # Update role and place directly if not farmer
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": phone, "password": "password123"},
    )
    token = login_resp.json()["access_token"]
    me_resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    user_id = me_resp.json()["id"]

    return token, user_id


def test_push_token_registration(client: TestClient, session: Session):
    token, user_id = _register_user(client, "9998881111")
    resp = client.post(
        "/api/v1/alerts/push-token",
        json={"push_token": "ExponentPushToken[mock-device-token-1234]"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    user = session.get(User, uuid.UUID(user_id))
    assert user.push_token == "ExponentPushToken[mock-device-token-1234]"


def test_send_expo_push_format_guard():
    # Invalid token skips cleanly without raising
    assert send_expo_push_notification("invalid-token", "Title", "Body") is False
    assert send_expo_push_notification("", "Title", "Body") is False


def test_high_risk_alert_trigger_and_deduplication(client: TestClient, session: Session):
    token, user_id = _register_user(client, "9998882222", place="Mandya")

    # Create a cow
    cow_resp = client.post(
        "/api/v1/cows/",
        json={
            "pashu_aadhar": "999888222201",
            "name": "Gauri",
            "species": "cattle",
            "latitude": 12.52,
            "longitude": 76.89,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    cow_id = uuid.UUID(cow_resp.json()["id"])

    # Score < 70 should NOT trigger an alert
    alert_low = check_and_trigger_risk_alert(cow_id, 45.0, session)
    assert alert_low is None

    # Score >= 70 SHOULD trigger a critical alert for the farmer
    alert_high = check_and_trigger_risk_alert(cow_id, 82.5, session)
    assert alert_high is not None
    assert alert_high.severity == AlertSeverity.critical
    assert alert_high.alert_type == AlertType.high_risk_mastitis
    assert alert_high.user_id == uuid.UUID(user_id)
    assert "Gauri" in alert_high.title

    # Second trigger within 24h should return the existing unread alert (deduplication)
    alert_dup = check_and_trigger_risk_alert(cow_id, 85.0, session)
    assert alert_dup.id == alert_high.id


def test_case_assigned_notification_on_complaint(client: TestClient, session: Session):
    # Register a doctor with GPS
    doc_token, doc_id = _register_user(client, "9998883333")
    doc_user = session.get(User, uuid.UUID(doc_id))
    doc_user.role = UserRole.doctor
    doc_user.latitude = 12.521
    doc_user.longitude = 76.891
    session.add(doc_user)
    session.commit()

    # Register a farmer with a cow near the doctor
    farmer_token, farmer_id = _register_user(client, "9998884444")
    cow_resp = client.post(
        "/api/v1/cows/",
        json={
            "pashu_aadhar": "999888444401",
            "name": "Ganga",
            "species": "cattle",
            "latitude": 12.520,
            "longitude": 76.890,
        },
        headers={"Authorization": f"Bearer {farmer_token}"},
    )
    cow_id = cow_resp.json()["id"]

    # Farmer raises a complaint
    comp_resp = client.post(
        "/api/v1/complaints/",
        json={
            "bovine_id": cow_id,
            "description": "Severe udder swelling",
            "priority": "high",
            "symptoms": "udder_swelling, fever",
        },
        headers={"Authorization": f"Bearer {farmer_token}"},
    )
    assert comp_resp.status_code == 201
    assert comp_resp.json()["status"] == "assigned"

    # Check doctor's alerts
    doc_alerts_resp = client.get("/api/v1/alerts/my", headers={"Authorization": f"Bearer {doc_token}"})
    assert doc_alerts_resp.status_code == 200
    alerts_data = doc_alerts_resp.json()
    assert alerts_data["unread_count"] >= 1
    assigned_alert = next((a for a in alerts_data["alerts"] if a["alert_type"] == "case_assigned"), None)
    assert assigned_alert is not None
    assert "CMP-" in assigned_alert["title"]


def test_outbreak_cluster_detection(client: TestClient, session: Session):
    # Setup authority user
    auth_token, auth_id = _register_user(client, "9998885555")
    auth_user = session.get(User, uuid.UUID(auth_id))
    auth_user.role = UserRole.authority
    session.add(auth_user)
    session.commit()

    # Setup 3 different cows in village "MandyaNorth" belonging to farmer
    f_token, f_id = _register_user(client, "9998886666")
    farmer = session.get(User, uuid.UUID(f_id))
    farmer.place = "MandyaNorth"
    session.add(farmer)
    session.commit()

    cows = []
    for i in range(3):
        c = Bovine(
            farmer_id=farmer.id,
            name=f"ClusterCow-{i}",
            pashu_aadhar=f"99988866660{i}",
            species="cattle",
            latitude=12.55,
            longitude=76.90,
        )
        session.add(c)
        session.commit()
        session.refresh(c)
        cows.append(c)

        # Add a high-risk score (>=70)
        rs = RiskScore(
            cow_id=c.id,
            score=78.0 + i,
            category="high",
            factors="[]",
            scored_at=datetime.now(timezone.utc),
        )
        session.add(rs)
        session.commit()

    # Trigger cluster check
    outbreak_alert = check_outbreak_cluster("MandyaNorth", session)
    assert outbreak_alert is not None
    assert outbreak_alert.alert_type == AlertType.outbreak_warning
    assert "MandyaNorth" in outbreak_alert.title
    assert outbreak_alert.target_role == "authority"

    # Authority should see it in their alerts
    auth_alerts_resp = client.get("/api/v1/alerts/my", headers={"Authorization": f"Bearer {auth_token}"})
    assert auth_alerts_resp.status_code == 200
    alerts_list = auth_alerts_resp.json()["alerts"]
    assert any(a["alert_type"] == "outbreak_warning" for a in alerts_list)

    # Outbreak endpoint
    outbreaks_resp = client.get("/api/v1/alerts/outbreaks", headers={"Authorization": f"Bearer {auth_token}"})
    assert outbreaks_resp.status_code == 200
    clusters = outbreaks_resp.json()
    assert any(c["village_or_place"] == "MandyaNorth" and c["case_count"] == 3 for c in clusters)


def test_mark_alert_read(client: TestClient, session: Session):
    token, user_id = _register_user(client, "9998887777")
    u_uuid = uuid.UUID(user_id)

    # Manually create an alert
    alert = Alert(
        user_id=u_uuid,
        title="Test Alert",
        message="Please check your animal",
        alert_type=AlertType.high_risk_mastitis,
        severity=AlertSeverity.warning,
        is_read=False,
    )
    session.add(alert)
    session.commit()
    session.refresh(alert)

    # Mark as read
    patch_resp = client.patch(f"/api/v1/alerts/{alert.id}/read", headers={"Authorization": f"Bearer {token}"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["is_read"] is True

    # Re-fetch my alerts -> unread_count should be 0
    my_resp = client.get("/api/v1/alerts/my", headers={"Authorization": f"Bearer {token}"})
    assert my_resp.json()["unread_count"] == 0


def test_barn_environment_deterioration_alert(client: TestClient, session: Session):
    from app.models.sensor import EnvironmentReading
    from app.services.notification_service import check_and_trigger_environment_alert

    token, user_id = _register_user(client, "9998889999")
    farmer_uuid = uuid.UUID(user_id)

    # 1. Normal barn vitals should NOT trigger an alert
    normal_reading = EnvironmentReading(
        farmer_id=farmer_uuid,
        ambient_temperature=24.0,
        humidity=55.0,
        bedding_moisture=32.0,
        ammonia_ppm=9.0,
        hygiene_score=1,
    )
    alert_normal = check_and_trigger_environment_alert(normal_reading, session)
    assert alert_normal is None

    # 2. Dangerous Ammonia Level (>25 ppm) SHOULD trigger an alert
    toxic_ammonia = EnvironmentReading(
        farmer_id=farmer_uuid,
        ambient_temperature=26.0,
        humidity=60.0,
        bedding_moisture=35.0,
        ammonia_ppm=36.5,
        hygiene_score=2,
    )
    alert_ammonia = check_and_trigger_environment_alert(toxic_ammonia, session)
    assert alert_ammonia is not None
    assert alert_ammonia.alert_type == AlertType.barn_environment_hazard
    assert alert_ammonia.severity == AlertSeverity.critical
    assert "Toxic Ammonia" in alert_ammonia.title
    assert alert_ammonia.user_id == farmer_uuid

    # 3. Duplicate within 6 hours should return existing unread alert
    alert_dup = check_and_trigger_environment_alert(toxic_ammonia, session)
    assert alert_dup.id == alert_ammonia.id


def test_barn_environment_ingest_triggers_alert(client: TestClient, session: Session):
    token, user_id = _register_user(client, "9998886666")

    # Ingest bad barn environment conditions via API (ammonia 29.5 ppm, wet bedding 58%)
    resp = client.post(
        "/api/v1/sensors/environment",
        json={
            "farmer_phone": "9998886666",
            "ambient_temperature": 27.5,
            "humidity": 65.0,
            "bedding_moisture": 58.0,
            "ammonia_ppm": 29.5,
            "hygiene_score": 3,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201

    # Farmer should immediately have an alert in /alerts/my
    alerts_resp = client.get("/api/v1/alerts/my", headers={"Authorization": f"Bearer {token}"})
    assert alerts_resp.status_code == 200
    user_alerts = alerts_resp.json()["alerts"]
    assert any(a["alert_type"] == "barn_environment_hazard" for a in user_alerts)
