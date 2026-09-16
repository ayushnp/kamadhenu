# Kamadhenu — Backend API

> **AI-Based Predictive Modelling for Early Forecasting of Bovine Mastitis in Indian Dairy Farms**

FastAPI · SQLModel · PostgreSQL (Neon) · JWT Auth

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting the Code](#getting-the-code)
- [Project Setup](#project-setup)
- [Environment Variables](#environment-variables)
- [Running the Server](#running-the-server)
- [API Overview](#api-overview)
- [Authentication Flow](#authentication-flow)
- [User Roles](#user-roles)

---

## Prerequisites

Make sure these are installed on your laptop before starting:

| Tool | Version | Download |
|------|---------|----------|
| Python | 3.11, 3.12, or 3.13 | https://python.org/downloads |
| `uv` (package manager) | latest | `pip install uv` |
| Git | any | https://git-scm.com |

> **Python version:** 3.11 is recommended (matches the dev environment). 3.12 and 3.13 also work. **3.10 or older will not work.**

> **Why `uv`?** It's a fast Python package manager that replaces `pip` + `venv`. It reads `pyproject.toml` and installs everything automatically.

---

## Getting the Code

```bash
# Clone the repository
git clone https://github.com/<your-org>/kamadhenu.git

# Go into the backend folder
cd kamadhenu/backend
```

---

## Project Setup

```bash
# 1. Create a virtual environment
uv venv

# 2. Activate it
#    Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
#    Mac / Linux:
source .venv/bin/activate

# 3. Install all dependencies
uv sync
```

---

## Environment Variables

Copy the example file and fill in your values:

```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Now open `.env` and set these values:

```env
# ─── Database ────────────────────────────────────────────────────────────────
# Get this from console.neon.tech → your project → Connection Details
# Make sure the scheme is postgresql+psycopg:// (not plain postgresql://)
DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>/<dbname>?sslmode=require

# ─── JWT ─────────────────────────────────────────────────────────────────────
# Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=your_generated_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# ─── App ─────────────────────────────────────────────────────────────────────
APP_NAME=Kamadhenu
VERSION=0.1.0
DEBUG=true
```

> **Note:** Never commit `.env` to Git. It's already in `.gitignore`.

### Getting the Neon DB URL

1. Go to [console.neon.tech](https://console.neon.tech) and sign in
2. Open the project → **Dashboard** → **Connection Details**
3. Copy the connection string — it looks like:
   ```
   postgresql://neondb_owner:xxxx@ep-xxxx.aws.neon.tech/neondb?sslmode=require
   ```
4. Change `postgresql://` to `postgresql+psycopg://` and paste into `.env`

---

## Running the Server

```bash
uvicorn app.main:app --reload
```

The API will be live at:

| URL | Description |
|-----|-------------|
| `http://127.0.0.1:8000` | Health check |
| `http://127.0.0.1:8000/docs` | Interactive Swagger UI |
| `http://127.0.0.1:8000/redoc` | ReDoc documentation |

---

## API Overview

All routes are prefixed with `/api/v1`.

| Tag | Prefix | Description |
|-----|--------|-------------|
| Auth | `/api/v1/auth` | Register and login |
| Users | `/api/v1/users` | User management (admin only) |
| Cows | `/api/v1/cows` | Cow records |
| Cow Health | `/api/v1/cow-health` | Health logs and mastitis predictions |
| Vaccinations | `/api/v1/vaccinations` | Vaccination records |

Full interactive docs available at `/docs` once the server is running.

---

## Authentication Flow

The API uses **JWT Bearer tokens**. Here is how to authenticate from your frontend:

### 1. Register a farmer account

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "Ravi Kumar",
  "phone": "9876543210",
  "password": "yourpassword",
  "place": "Coimbatore"
}
```

> Either `phone` or `email` is required (or both).

---

### 2. Login to get a token

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "identifier": "9876543210",
  "password": "yourpassword"
}
```

`identifier` = the phone number **or** email used during registration.

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

### 3. Use the token in all subsequent requests

Add this header to every protected API call:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**In JavaScript / fetch:**
```js
const response = await fetch('http://127.0.0.1:8000/api/v1/cows', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
});
```

**In axios:**
```js
axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
```

Tokens expire after **7 days** (`ACCESS_TOKEN_EXPIRE_MINUTES=10080`). When expired, call login again to get a fresh token.

---

## User Roles

| Role | Who | Created by |
|------|-----|------------|
| `farmer` | Dairy farmers | Self-register via `POST /api/v1/auth/register` |
| `inspector` | Field inspectors | Authority admin via `POST /api/v1/users/staff` |
| `doctor` | Veterinary doctors | Authority admin via `POST /api/v1/users/staff` |
| `authority` | Admins | Authority admin via `POST /api/v1/users/staff` |

Most endpoints are role-protected — the API will return `403 Forbidden` if you access an endpoint your role does not have permission for.
