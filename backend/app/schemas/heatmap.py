"""Pydantic schemas for the GIS heatmap API endpoints."""

from typing import List, Literal

from pydantic import BaseModel


class HeatmapPoint(BaseModel):
    """A single geo-located data point for heatmap rendering."""

    lat: float
    lng: float
    # Normalised intensity 0.0 (cold/safe) → 1.0 (hot/critical).
    # Derived from risk score (0–100) or complaint priority.
    weight: float
    label: str  # village / place name or cow identifier
    kind: Literal["risk", "complaint", "outbreak"]
    severity: str  # "no_risk" | "low" | "moderate" | "high" | "warning" | "critical"


class HeatmapData(BaseModel):
    """Full response for a heatmap query."""

    points: List[HeatmapPoint]
    # Suggested map center — average of all point coordinates
    center_lat: float
    center_lng: float
    # Approximate geographic spread in km (used for initial zoom level)
    bounds_radius_km: float
    total_risk_points: int
    total_complaint_points: int
