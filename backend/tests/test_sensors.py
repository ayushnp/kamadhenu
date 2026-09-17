"""Tests for IoT sensor telemetry ingestion and query endpoints."""

import pytest
from fastapi.testclient import TestClient


def _register_farmer(client: TestClient, phone: str) -> tuple[str, str]:
    """Register farmer and return (token, user_id)."""
    client.post(
        "/api/v1/auth/register",
        json={"name": "Sensor Farmer", "phone": phone, "password": "password123"},
    )
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": phone, "password": "password123"},
    )
    token = resp.json()["access_token"]
    me_resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    return token, me_resp.json()["id"]


def _create_cow(client: TestClient, token: str, tag: str) -> dict:
    """Create a cow for testing."""
    resp = client.post(
        "/api/v1/cows/",
        json={
            "pashu_aadhar": tag,
            "name": f"Cow-{tag}",
            "breed": "HF",
            "species": "cattle",
            "age_years": 4.0,
            "latitude": 12.5,
            "longitude": 76.8,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()


def test_ingest_wearable_by_cow_id(client: TestClient):
    token, _ = _register_farmer(client, "9100000001")
    cow = _create_cow(client, token, "KA-SEN-01")

    payload = {
        "cow_id": cow["id"],
        "activity_index": 125.5,
        "rumination_minutes": 22.0,
        "body_temperature": 38.6,
        "lying_time_minutes": 35.0,
    }
    resp = client.post(
        "/api/v1/sensors/wearable",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["cow_id"] == cow["id"]
    assert data["activity_index"] == 125.5
    assert data["rumination_minutes"] == 22.0
    assert data["body_temperature"] == 38.6


def test_ingest_wearable_by_pashu_aadhar(client: TestClient):
    token, _ = _register_farmer(client, "9100000002")
    cow = _create_cow(client, token, "KA-SEN-02")

    # Pass pashu_aadhar instead of UUID
    payload = {
        "pashu_aadhar": "KA-SEN-02",
        "activity_index": 98.0,
        "rumination_minutes": 15.5,
        "body_temperature": 39.1,
    }
    resp = client.post(
        "/api/v1/sensors/wearable",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["cow_id"] == cow["id"]
    assert data["rumination_minutes"] == 15.5


def test_ingest_wearable_batch(client: TestClient):
    token, _ = _register_farmer(client, "9100000003")
    cow = _create_cow(client, token, "KA-SEN-03")

    payload = {
        "readings": [
            {"cow_id": cow["id"], "activity_index": 110, "rumination_minutes": 20},
            {"pashu_aadhar": "KA-SEN-03", "activity_index": 115, "rumination_minutes": 22},
        ]
    }
    resp = client.post(
        "/api/v1/sensors/wearable/batch",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    assert len(resp.json()) == 2


def test_ingest_milk_single_quarter(client: TestClient):
    token, _ = _register_farmer(client, "9100000004")
    cow = _create_cow(client, token, "KA-SEN-04")

    payload = {
        "cow_id": cow["id"],
        "quarter": "FL",
        "electrical_conductivity": 6.85,
        "ph": 6.95,
        "turbidity": 240.0,
        "cmt_result": "1+",
        "scc": 420000,
    }
    resp = client.post(
        "/api/v1/sensors/milk",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["quarter"] == "FL"
    assert data["electrical_conductivity"] == 6.85
    assert data["cmt_result"] == "1+"
    assert data["scc"] == 420000


def test_ingest_milk_session_all_quarters(client: TestClient):
    token, _ = _register_farmer(client, "9100000005")
    cow = _create_cow(client, token, "KA-SEN-05")

    payload = {
        "pashu_aadhar": "KA-SEN-05",
        "quarters": [
            {"quarter": "FL", "electrical_conductivity": 7.2, "ph": 7.1, "cmt_result": "2+"},
            {"quarter": "FR", "electrical_conductivity": 4.8, "ph": 6.6, "cmt_result": "negative"},
            {"quarter": "RL", "electrical_conductivity": 4.7, "ph": 6.6, "cmt_result": "negative"},
            {"quarter": "RR", "electrical_conductivity": 4.9, "ph": 6.65, "cmt_result": "negative"},
        ],
    }
    resp = client.post(
        "/api/v1/sensors/milk/session",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    quarters = resp.json()
    assert len(quarters) == 4
    fl = next(q for q in quarters if q["quarter"] == "FL")
    assert fl["electrical_conductivity"] == 7.2
    assert fl["cmt_result"] == "2+"


def test_ingest_environment(client: TestClient):
    token, farmer_id = _register_farmer(client, "9100000006")

    payload = {
        "farmer_id": farmer_id,
        "ambient_temperature": 31.5,
        "humidity": 84.0,
        "bedding_moisture": 62.0,
        "ammonia_ppm": 22.5,
        "hygiene_score": 3,
    }
    resp = client.post(
        "/api/v1/sensors/environment",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["ambient_temperature"] == 31.5
    assert data["humidity"] == 84.0
    assert data["bedding_moisture"] == 62.0


def test_cow_telemetry_summary_and_trends(client: TestClient):
    token, _ = _register_farmer(client, "9100000007")
    cow = _create_cow(client, token, "KA-SEN-07")

    # Ingest wearable & milk
    client.post(
        "/api/v1/sensors/wearable",
        json={"cow_id": cow["id"], "activity_index": 120, "rumination_minutes": 25},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.post(
        "/api/v1/sensors/milk",
        json={"cow_id": cow["id"], "quarter": "FR", "electrical_conductivity": 4.8, "ph": 6.6},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Get summary
    resp = client.get(
        f"/api/v1/sensors/cows/{cow['id']}/summary?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["cow_id"] == cow["id"]
    assert summary["wearable_records_count"] == 1
    assert summary["milk_records_count"] == 1
    assert len(summary["wearable"]) == 1
    assert len(summary["milk"]) == 1


def test_farmer_cannot_access_other_farmer_cow_telemetry(client: TestClient):
    token1, _ = _register_farmer(client, "9100000008")
    token2, _ = _register_farmer(client, "9100000009")

    cow1 = _create_cow(client, token1, "KA-SEN-08")

    # Farmer 2 tries to view Farmer 1's cow sensors
    resp = client.get(
        f"/api/v1/sensors/cows/{cow1['id']}/wearable",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert resp.status_code == 403
    assert "permission" in resp.json()["detail"].lower()
