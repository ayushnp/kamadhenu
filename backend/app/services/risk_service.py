import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.cow import Bovine
from app.models.risk import RiskScore
from app.models.user import User
from app.schemas.risk import AIGuidance, FarmRiskSummary, RiskFactor, RiskResponse
from app.services.groq_service import generate_farmer_guidance
from ml.engine import RiskResult

logger = logging.getLogger(__name__)


def save_risk_score(
    cow_id: uuid.UUID,
    result: RiskResult,
    session: Session,
    ai_guidance: Optional[str] = None,
) -> RiskScore:
    """Persist a RiskResult to the risk_scores table."""
    factors_json = json.dumps([
        {"label": f.label, "weight": f.weight, "value": f.value}
        for f in result.factors
    ])
    rs = RiskScore(
        cow_id=cow_id,
        scored_at=result.scored_at,
        score=result.score,
        category=result.category,
        factors=factors_json,
        ai_guidance=ai_guidance,
        engine_version=result.engine_version,
        window_days=result.window_days,
    )
    session.add(rs)
    session.commit()
    session.refresh(rs)
    return rs


def _rs_to_response(
    rs: RiskScore,
    cow: Optional[Bovine] = None,
    lang: str = "en",
    include_ai: bool = True,
    force_refresh: bool = False,
    session: Optional[Session] = None,
) -> RiskResponse:
    factors = [RiskFactor(**f) for f in json.loads(rs.factors or "[]")]
    rec_map = {
        "no_risk":  "Continue routine monitoring. No action required.",
        "low":      "Monitor closely. Check milk quality and activity daily for the next week.",
        "moderate": "Perform a manual CMT test on all quarters and consult your veterinarian soon.",
        "high":     "Isolate the cow immediately and contact a veterinarian within 24 hours.",
    }

    ai_guidance: Optional[AIGuidance] = None
    if include_ai:
        # 1. Try DB-persisted cache if not force_refresh
        if not force_refresh and rs.ai_guidance:
            try:
                cached_data = json.loads(rs.ai_guidance)
                ai_guidance = AIGuidance(**cached_data)
                logger.info("Retrieved AI guidance from DB cache for cow %s", rs.cow_id)
            except Exception:
                ai_guidance = None

        # 2. If not found or forced, generate via Groq LLM (which has memory TTL cache)
        if ai_guidance is None:
            ai_guidance = generate_farmer_guidance(
                cow, rs.score, rs.category, factors, lang=lang, force_refresh=force_refresh
            )
            # 3. Persist back to DB so subsequent requests are instant
            if session and ai_guidance:
                try:
                    rs.ai_guidance = ai_guidance.model_dump_json()
                    session.add(rs)
                    session.commit()
                    logger.info("Cached fresh AI guidance into DB for cow %s", rs.cow_id)
                except Exception as e:
                    logger.warning("Failed to persist ai_guidance into DB: %s", e)

    return RiskResponse(
        cow_id=rs.cow_id,
        scored_at=rs.scored_at,
        score=rs.score,
        category=rs.category,
        factors=factors,
        engine_version=rs.engine_version,
        window_days=rs.window_days,
        recommendation=rec_map.get(rs.category, ""),
        ai_guidance=ai_guidance,
    )


def _to_response(
    rs: RiskScore,
    cow_id: uuid.UUID,
    cow: Optional[Bovine] = None,
    lang: str = "en",
    include_ai: bool = True,
    force_refresh: bool = False,
    session: Optional[Session] = None,
) -> RiskResponse:
    return _rs_to_response(
        rs, cow=cow, lang=lang, include_ai=include_ai, force_refresh=force_refresh, session=session
    )


def get_latest_risk(cow_id: uuid.UUID, session: Session) -> Optional[RiskScore]:
    """Return the most recent risk score for a cow."""
    stmt = (
        select(RiskScore)
        .where(RiskScore.cow_id == cow_id)
        .order_by(RiskScore.scored_at.desc())
        .limit(1)
    )
    return session.exec(stmt).first()


def get_risk_history(cow_id: uuid.UUID, days: int, session: Session) -> List[RiskScore]:
    """Return risk score history for a cow over the last N days."""
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    stmt = (
        select(RiskScore)
        .where(RiskScore.cow_id == cow_id)
        .where(RiskScore.scored_at >= since)
        .order_by(RiskScore.scored_at.desc())
    )
    return list(session.exec(stmt).all())


def get_farm_risk_summary(farmer: User, session: Session) -> FarmRiskSummary:
    """Aggregate latest risk scores across all of a farmer's cows."""
    # Get all cows for this farmer
    cows_stmt = select(Bovine).where(Bovine.farmer_id == farmer.id).where(Bovine.is_active == True)
    cows = list(session.exec(cows_stmt).all())

    counts = {"no_risk": 0, "low": 0, "moderate": 0, "high": 0}
    high_risk_cows = []

    for cow in cows:
        latest = get_latest_risk(cow.id, session)
        if latest:
            cat = latest.category
            counts[cat] = counts.get(cat, 0) + 1
            if cat == "high":
                high_risk_cows.append({
                    "cow_id": str(cow.id),
                    "name": cow.name,
                    "pashu_aadhar": cow.pashu_aadhar,
                    "score": latest.score,
                    "category": latest.category,
                    "scored_at": latest.scored_at.isoformat(),
                })
        else:
            counts["no_risk"] += 1

    return FarmRiskSummary(
        total_cows=len(cows),
        no_risk=counts["no_risk"],
        low=counts["low"],
        moderate=counts["moderate"],
        high=counts["high"],
        high_risk_cows=sorted(high_risk_cows, key=lambda x: x["score"], reverse=True),
    )
