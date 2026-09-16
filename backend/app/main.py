"""Kamadhenu FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.config import settings
from app.database import create_db_and_tables

# Import all models so SQLModel metadata is populated before table creation
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup: ensure tables exist. Shutdown: nothing to clean up."""
    create_db_and_tables()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description=(
        "AI-Based Predictive Modelling for Early Forecasting of Bovine Mastitis "
        "in Indian Dairy Farms — Backend API"
    ),
    contact={
        "name": "Kamadhenu Dev Team",
    },
    license_info={"name": "MIT"},
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# During development allow all origins; restrict in production via env var.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ───────────────────────────────────────────────────────────────────
app.include_router(api_router)


@app.get("/", tags=["Health"], summary="Health check")
def root() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.VERSION}
