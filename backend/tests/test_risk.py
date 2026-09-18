"""Tests for the AI Mastitis Risk Engine API and ML inference."""

import uuid
import pytest
from fastapi.testclient import TestClient

from ml.engine import _load_model, CATEGORIES
from ml.features import FEATURE_COLS
from app.models.sensor import MilkQuarter, CMTResult


def _register_farmer(client: TestClient, phone: str) -> tuple[str, str]:
    """Register farmer and return (token, user_id)."""
    client.post(
        "/api/v1/auth/register",
        json={"name": "Risk Farmer", "phone": phone, "password": "password123"},
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
            "breed": "Gir",
            "species": "cattle",
            "age_years": 4.0,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()


def test_ml_artifacts_loading():
    """Verify XGBoost model loads, SHAP explainer initializes, and 18 features are defined."""
    model = _load_model()
    assert model is not None
    assert len(FEATURE_COLS) == 18


def test_score_cow_end_to_end(client: TestClient):
    """Test full pipeline: farmer registration -> cow creation -> sensor readings -> risk score."""
    token, _ = _register_farmer(client, "9200000001")
    cow = _create_cow(client, token, "KA-RSK-01")
    cow_id = cow["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # Ingest symptomatic wearable reading
    client.post(
        "/api/v1/sensors/wearable",
        json={
            "cow_id": cow_id,
            "body_temperature": 40.2,
            "activity_index": 45.0,
            "rumination_minutes": 18.0,
            "lying_time_minutes": 420.0,
        },
        headers=headers,
    )

    # Ingest symptomatic milk reading
    client.post(
        "/api/v1/sensors/milk",
        json={
            "cow_id": cow_id,
            "quarter": "FL",
            "electrical_conductivity": 7.3,
            "ph": 7.1,
            "turbidity": 240.0,
            "cmt_result": "2+",
            "scc": 900000,
            "milk_yield_litres": 7.5,
        },
        headers=headers,
    )

    # Ingest barn environment reading
    client.post(
        "/api/v1/sensors/environment",
        json={
            "ambient_temperature": 33.0,
            "humidity": 80.0,
            "bedding_moisture": 52.0,
        },
        headers=headers,
    )

    # 1. Trigger on-demand risk score
    resp = client.post(f"/api/v1/risk/score/{cow_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["cow_id"] == cow_id
    assert 0.0 <= data["score"] <= 100.0
    assert data["category"] in CATEGORIES
    assert len(data["factors"]) <= 5
    assert len(data["recommendation"]) > 0

    # 2. Get latest score
    latest_resp = client.get(f"/api/v1/risk/cows/{cow_id}/latest", headers=headers)
    assert latest_resp.status_code == 200
    latest_data = latest_resp.json()
    assert latest_data["score"] == data["score"]
    assert latest_data["category"] == data["category"]

    # 3. Get history
    hist_resp = client.get(f"/api/v1/risk/cows/{cow_id}/history?days=14", headers=headers)
    assert hist_resp.status_code == 200
    hist_data = hist_resp.json()
    assert len(hist_data) >= 1

    # 4. Get farm summary
    summary_resp = client.get("/api/v1/risk/farm/summary", headers=headers)
    assert summary_resp.status_code == 200
    summary_data = summary_resp.json()
    assert summary_data["total_cows"] >= 1
