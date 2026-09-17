"""Tests for authentication endpoints."""

import pytest
from fastapi.testclient import TestClient


FARMER_PAYLOAD = {
    "name": "Ravi Kumar",
    "phone": "9876543210",
    "email": "ravi@example.com",
    "password": "strongpassword123",
    "place": "Anand, Gujarat",
    "number_of_animals": 5,
}


def test_farmer_registration(client: TestClient):
    response = client.post("/api/v1/auth/register", json=FARMER_PAYLOAD)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Ravi Kumar"
    assert data["role"] == "farmer"
    assert "hashed_password" not in data


def test_duplicate_phone_rejected(client: TestClient):
    # First registration
    client.post("/api/v1/auth/register", json=FARMER_PAYLOAD)
    # Second registration with same phone
    response = client.post("/api/v1/auth/register", json=FARMER_PAYLOAD)
    assert response.status_code == 409


def test_register_requires_contact(client: TestClient):
    payload = {**FARMER_PAYLOAD, "phone": None, "email": None}
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422  # Validation error


def test_login_with_phone(client: TestClient):
    client.post("/api/v1/auth/register", json={**FARMER_PAYLOAD, "phone": "9000000001", "email": None})
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "9000000001", "password": "strongpassword123"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"


def test_login_with_email(client: TestClient):
    client.post(
        "/api/v1/auth/register",
        json={**FARMER_PAYLOAD, "phone": None, "email": "emailtest@example.com"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "emailtest@example.com", "password": "strongpassword123"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client: TestClient):
    client.post("/api/v1/auth/register", json={**FARMER_PAYLOAD, "phone": "9000000002", "email": None})
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "9000000002", "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_get_me(client: TestClient):
    client.post(
        "/api/v1/auth/register",
        json={**FARMER_PAYLOAD, "phone": "9000000003", "email": None},
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": "9000000003", "password": "strongpassword123"},
    )
    token = login_resp.json()["access_token"]
    me_resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["phone"] == "9000000003"
    assert me_resp.json()["role"] == "farmer"


def test_staff_login_with_employee_id(client: TestClient, session):
    """Inspector / Doctor / Authority can log in using their government employee ID."""
    from app.core.security import hash_password
    from app.models.user import User, UserRole

    # Seed an authority user directly in the DB (bypasses role restriction in /auth/register)
    authority = User(
        name="Authority Admin",
        phone="9000000099",
        hashed_password=hash_password("adminpass123"),
        role=UserRole.authority,
    )
    session.add(authority)
    session.commit()

    # Log in as authority
    authority_token = client.post(
        "/api/v1/auth/login",
        json={"identifier": "9000000099", "password": "adminpass123"},
    ).json()["access_token"]

    # Authority creates an inspector with an employee_id
    resp = client.post(
        "/api/v1/users/staff",
        json={
            "name": "Inspector Suresh",
            "role": "inspector",
            "phone": "9000000088",
            "password": "inspectorpass123",
            "employee_id": "INS-2024-001",
        },
        headers={"Authorization": f"Bearer {authority_token}"},
    )
    assert resp.status_code == 201

    # Inspector logs in using their employee ID (not phone, not email)
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "INS-2024-001", "password": "inspectorpass123"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
