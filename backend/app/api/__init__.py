"""Master API router — aggregates all sub-routers."""

from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.complaints import router as complaints_router
from app.api.cow_health import router as cow_health_router
from app.api.cows import router as cows_router
from app.api.users import router as users_router
from app.api.vaccinations import router as vaccinations_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(cows_router)
api_router.include_router(cow_health_router)
api_router.include_router(vaccinations_router)
api_router.include_router(complaints_router)
