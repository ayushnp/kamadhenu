"""Tests for cow profile endpoints."""

import pytest
from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, phone: str) -> str:
    """Helper: register a farmer and return a Bearer token."""
    client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test Farmer",
            "phone": phone,
            "password": "testpass123",
        },
    )
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": phone, "password": "testpass123"},
    )
    return resp.json()["access_token"]


COW_PAYLOAD = {
    "pashu_aadhar": "123456789012",
    "barcode": "BAR-001",
    "name": "Ganga",
    "breed": "HF",
    "species": "cattle",
    "age_years": 4.5,
    "calf_number": 2,
    "lactation_number": 2,
    "latitude": 22.3072,
    "longitude": 73.1812,
}


def test_farmer_can_add_cow(client: TestClient):
    token = _register_and_login(client, "8100000001")
    response = client.post(
        "/api/v1/cows/",
        json=COW_PAYLOAD,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Ganga"
    assert data["pashu_aadhar"] == "123456789012"


def test_duplicate_barcode_rejected(client: TestClient):
    token = _register_and_login(client, "8100000002")
    client.post(
        "/api/v1/cows/",
        json={**COW_PAYLOAD, "pashu_aadhar": "111111111111", "barcode": "BAR-DUP"},
        headers={"Authorization": f"Bearer {token}"},
    )
    response = client.post(
        "/api/v1/cows/",
        json={**COW_PAYLOAD, "pashu_aadhar": "222222222222", "barcode": "BAR-DUP"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 409


def test_lookup_by_barcode(client: TestClient):
    token = _register_and_login(client, "8100000003")
    client.post(
        "/api/v1/cows/",
        json={**COW_PAYLOAD, "pashu_aadhar": "333333333333", "barcode": "BAR-LOOKUP"},
        headers={"Authorization": f"Bearer {token}"},
    )
    response = client.get(
        "/api/v1/cows/lookup",
        params={"barcode": "BAR-LOOKUP"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["barcode"] == "BAR-LOOKUP"
    assert "health_records" in data
    assert "vaccinations" in data


def test_list_my_herd(client: TestClient):
    token = _register_and_login(client, "8100000004")
    client.post(
        "/api/v1/cows/",
        json={**COW_PAYLOAD, "pashu_aadhar": "444444444444", "barcode": "BAR-HERD1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.post(
        "/api/v1/cows/",
        json={**COW_PAYLOAD, "pashu_aadhar": "555555555555", "barcode": "BAR-HERD2"},
        headers={"Authorization": f"Bearer {token}"},
    )
    response = client.get("/api/v1/cows/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_add_health_record(client: TestClient):
    token = _register_and_login(client, "8100000005")
    cow_resp = client.post(
        "/api/v1/cows/",
        json={**COW_PAYLOAD, "pashu_aadhar": "666666666666", "barcode": "BAR-HEALTH"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cow_id = cow_resp.json()["id"]
    response = client.post(
        f"/api/v1/cows/{cow_id}/health/",
        json={
            "disease_name": "Mastitis",
            "diagnosed_date": "2025-01-15",
            "treatment": "Antibiotic course",
            "is_comorbidity": False,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["disease_name"] == "Mastitis"


def test_add_vaccination(client: TestClient):
    token = _register_and_login(client, "8100000006")
    cow_resp = client.post(
        "/api/v1/cows/",
        json={**COW_PAYLOAD, "pashu_aadhar": "777777777777", "barcode": "BAR-VAX"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cow_id = cow_resp.json()["id"]
    response = client.post(
        f"/api/v1/cows/{cow_id}/vaccinations/",
        json={
            "vaccine_name": "FMD Vaccine",
            "disease_covered": "Foot and Mouth Disease",
            "date_administered": "2025-03-01",
            "next_due_date": "2025-09-01",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["vaccine_name"] == "FMD Vaccine"
