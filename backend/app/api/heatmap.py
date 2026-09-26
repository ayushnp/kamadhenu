"""GIS Heatmap endpoints — authority/doctor/inspector only.

Returns geo-located risk and complaint data points for map overlay rendering.
Each point carries a normalised weight (0.0–1.0) so the mobile client can
drive a native Heatmap layer without any extra computation.
"""

import math
from datetime import datetime, timedelta, timezone
from typing import Annotated, List

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import select

from app.core.deps import CurrentUser, SessionDep
from app.models.complaint import Complaint, ComplaintPriority
from app.models.cow import Bovine
from app.models.risk import RiskScore
from app.models.user import User, UserRole
from app.schemas.heatmap import HeatmapData, HeatmapPoint

router = APIRouter(prefix="/heatmap", tags=["GIS Heatmap"])

# ── Helpers ──────────────────────────────────────────────────────────────────

_PRIORITY_WEIGHT = {
    ComplaintPriority.low: 0.2,
    ComplaintPriority.medium: 0.5,
    ComplaintPriority.high: 0.8,
    ComplaintPriority.critical: 1.0,
}

_CATEGORY_WEIGHT = {
    "no_risk": 0.05,
    "low": 0.3,
    "moderate": 0.6,
    "high": 1.0,
}

_ALLOWED_ROLES = {UserRole.authority, UserRole.doctor, UserRole.inspector}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two GPS coordinates."""
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lng2 - lng1)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _bounds_radius(points: List[HeatmapPoint], clat: float, clng: float) -> float:
    """Return the max distance (km) from center to any point — used for initial map zoom."""
    if not points:
        return 50.0
    return max(
        (_haversine_km(clat, clng, p.lat, p.lng) for p in points),
        default=50.0,
    )


# ── Main endpoint ─────────────────────────────────────────────────────────────

@router.get(
    "/risk-points",
    response_model=HeatmapData,
    summary="Get geo-located risk and complaint points for the heatmap (authority/doctor/inspector)",
)
def get_heatmap_points(
    user: CurrentUser,
    session: SessionDep,
    days: Annotated[int, Query(ge=1, le=90, description="Look-back window for risk scores")] = 14,
    include_complaints: Annotated[bool, Query(description="Include open complaint GPS points")] = True,
    min_weight: Annotated[float, Query(ge=0.0, le=1.0, description="Filter out points below this weight")] = 0.0,
) -> HeatmapData:
    """
    Return a list of geo-located heatmap data points aggregated from:

    1. **Risk layer** — latest RiskScore per cow joined to farmer GPS.
       Only cows whose farmer has stored GPS coordinates are included.
    2. **Complaint layer** — open/in-progress complaints that carry a GPS
       snapshot (animal_lat / animal_lng) captured at complaint creation.

    Access is restricted to authority, doctor, and inspector roles.
    """
    if user.role not in _ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Heatmap access is restricted to authority, doctor, and inspector roles.",
        )

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    points: List[HeatmapPoint] = []

    # ── 1. Risk layer ─────────────────────────────────────────────────────────
    # Fetch the most recent risk score per cow within the window.
    # We join Bovine and User(farmer) to get GPS coordinates.

    # Subquery approach: get the latest scored_at per cow_id
    # SQLModel/SQLite compatible — fetch all and group in Python
    all_risk = session.exec(
        select(RiskScore, Bovine, User)
        .join(Bovine, RiskScore.cow_id == Bovine.id)
        .join(User, Bovine.farmer_id == User.id)
        .where(
            RiskScore.scored_at >= cutoff,
            User.latitude.is_not(None),
            User.longitude.is_not(None),
        )
        .order_by(RiskScore.scored_at.desc())
    ).all()

    # Keep only the most recent score per cow
    seen_cows: set = set()
    risk_count = 0
    for rs, cow, farmer in all_risk:
        if cow.id in seen_cows:
            continue
        seen_cows.add(cow.id)

        weight = _CATEGORY_WEIGHT.get(rs.category, 0.05)
        if weight < min_weight:
            continue

        # Use cow GPS if available, fall back to farmer GPS
        lat = cow.latitude if cow.latitude is not None else farmer.latitude
        lng = cow.longitude if cow.longitude is not None else farmer.longitude

        label = farmer.place or farmer.name or "Unknown"
        points.append(
            HeatmapPoint(
                lat=lat,
                lng=lng,
                weight=weight,
                label=label,
                kind="risk",
                severity=rs.category,
            )
        )
        risk_count += 1

    # ── 2. Complaint layer ────────────────────────────────────────────────────
    complaint_count = 0
    if include_complaints:
        open_statuses = {"open", "assigned", "in_progress"}
        complaints = session.exec(
            select(Complaint).where(
                Complaint.animal_lat.is_not(None),
                Complaint.animal_lng.is_not(None),
                Complaint.status.in_(open_statuses),
            )
        ).all()

        for c in complaints:
            weight = _PRIORITY_WEIGHT.get(c.priority, 0.5)
            if weight < min_weight:
                continue

            # Map complaint priority to severity label
            sev_map = {
                ComplaintPriority.low: "low",
                ComplaintPriority.medium: "moderate",
                ComplaintPriority.high: "high",
                ComplaintPriority.critical: "critical",
            }
            points.append(
                HeatmapPoint(
                    lat=c.animal_lat,
                    lng=c.animal_lng,
                    weight=weight,
                    label=f"Complaint #{c.complaint_number}",
                    kind="complaint",
                    severity=sev_map.get(c.priority, "moderate"),
                )
            )
            complaint_count += 1

    # ── Center & bounds ───────────────────────────────────────────────────────
    if points:
        clat = sum(p.lat for p in points) / len(points)
        clng = sum(p.lng for p in points) / len(points)
        radius_km = _bounds_radius(points, clat, clng)
    else:
        # Default to geographic center of Karnataka if no data
        clat, clng, radius_km = 15.3173, 75.7139, 200.0

    return HeatmapData(
        points=points,
        center_lat=clat,
        center_lng=clng,
        bounds_radius_km=max(radius_km, 5.0),
        total_risk_points=risk_count,
        total_complaint_points=complaint_count,
    )
