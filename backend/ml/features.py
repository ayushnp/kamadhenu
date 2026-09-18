"""Feature extraction for mastitis risk prediction.

Computes all 18 numeric features from the last N days of DB readings:
  Group A (4): wearable collar — activity, rumination, body temp, lying time
  Group B (7): milk quality — EC, EC change, quarter asymmetry, pH, turbidity, CMT, SCC
  Group C (3): environment — humidity, bedding moisture, THI
  Group D (4): animal profile — lactation, age, prev mastitis flag, days in milk

All features have safe defaults so the engine never crashes on missing data.
"""

import math
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, select

from app.models.cow import Bovine
from app.models.cow_health import BovineHealthRecord
from app.models.sensor import CMTResult, EnvironmentReading, MilkReading, WearableReading
from app.models.user import User

# ─── Constants ────────────────────────────────────────────────────────────────

FEATURE_COLS = [
    "activity_pct_change",
    "rumination_pct_change",
    "body_temp_max",
    "lying_time_pct_change",
    "max_ec",
    "ec_pct_change",
    "quarter_ec_asymmetry",
    "max_ph",
    "max_turbidity",
    "cmt_score",
    "max_scc_log",
    "avg_humidity",
    "avg_bedding_moisture",
    "thi",
    "lactation_number",
    "age_years",
    "prev_mastitis_flag",
    "days_in_milk",
]

CMT_MAP = {
    CMTResult.negative: 0,
    CMTResult.trace: 1,
    CMTResult.one_plus: 2,
    CMTResult.two_plus: 3,
    CMTResult.three_plus: 4,
    None: 0,
}


# ─── Public API ───────────────────────────────────────────────────────────────

def extract_features(
    cow_id: uuid.UUID,
    session: Session,
    window_days: int = 7,
) -> dict:
    """Extract all 18 mastitis risk features for a given cow.

    Args:
        cow_id: UUID of the bovine animal.
        session: Active SQLModel database session.
        window_days: Number of days to look back for the recent window (default 7).
                     The baseline is the equal-length window immediately before that.

    Returns:
        Flat dict with all 18 feature names as keys and float values.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    recent_start = now - timedelta(days=window_days)
    baseline_start = now - timedelta(days=window_days * 2)

    if not cow_id:
        return _default_features()

    cow = session.get(Bovine, cow_id)
    if not cow:
        return _default_features()

    wearable_recent   = _get_wearable(cow_id, recent_start, now, session)
    wearable_baseline = _get_wearable(cow_id, baseline_start, recent_start, session)
    milk_recent       = _get_milk(cow_id, recent_start, now, session)
    milk_baseline     = _get_milk(cow_id, baseline_start, recent_start, session)
    env_recent        = _get_env(cow.farmer_id, recent_start, now, session)

    feats = {}

    # ── Group A: Wearable ──────────────────────────────────────────────────────
    feats.update(_wearable_features(wearable_recent, wearable_baseline))

    # ── Group B: Milk ─────────────────────────────────────────────────────────
    feats.update(_milk_features(milk_recent, milk_baseline))

    # ── Group C: Environment ──────────────────────────────────────────────────
    feats.update(_env_features(env_recent))

    # ── Group D: Animal Profile ───────────────────────────────────────────────
    feats.update(_profile_features(cow, cow_id, session))

    return feats


# ─── Group A — Wearable ───────────────────────────────────────────────────────

def _wearable_features(recent: list, baseline: list) -> dict:
    def mean(rows, attr, default):
        vals = [getattr(r, attr) for r in rows if getattr(r, attr) is not None]
        return sum(vals) / len(vals) if vals else default

    def pct_change(new_val, old_val, default=0.0):
        if old_val and abs(old_val) > 1e-9:
            return (new_val - old_val) / abs(old_val) * 100.0
        return default

    act_r  = mean(recent,   "activity_index",     120.0)
    act_b  = mean(baseline, "activity_index",     120.0)
    rum_r  = mean(recent,   "rumination_minutes",  18.0)
    rum_b  = mean(baseline, "rumination_minutes",  18.0)
    lie_r  = mean(recent,   "lying_time_minutes",  18.0)
    lie_b  = mean(baseline, "lying_time_minutes",  18.0)

    # body_temp_max: worst reading in last 48h
    now_utc = datetime.now(timezone.utc)
    cutoff_aware = now_utc - timedelta(hours=48)
    cutoff_naive = cutoff_aware.replace(tzinfo=None)

    def _is_recent_48h(rec_dt):
        if not rec_dt:
            return False
        cutoff = cutoff_naive if getattr(rec_dt, "tzinfo", None) is None else cutoff_aware
        return rec_dt >= cutoff

    temps_48h = [r.body_temperature for r in recent
                 if r.body_temperature is not None
                 and _is_recent_48h(r.recorded_at)]
    body_temp_max = max(temps_48h) if temps_48h else 38.55

    return {
        "activity_pct_change":   round(pct_change(act_r, act_b), 4),
        "rumination_pct_change": round(pct_change(rum_r, rum_b), 4),
        "body_temp_max":         round(body_temp_max, 4),
        "lying_time_pct_change": round(pct_change(lie_r, lie_b), 4),
    }


# ─── Group B — Milk ───────────────────────────────────────────────────────────

def _milk_features(recent: list, baseline: list) -> dict:
    # --- EC ---
    ec_recent  = [r.electrical_conductivity for r in recent  if r.electrical_conductivity is not None]
    ec_base    = [r.electrical_conductivity for r in baseline if r.electrical_conductivity is not None]
    max_ec     = max(ec_recent)  if ec_recent  else 4.8
    mean_ec_b  = sum(ec_base) / len(ec_base) if ec_base else 4.8
    ec_pct     = (max_ec - mean_ec_b) / mean_ec_b * 100 if mean_ec_b else 0.0

    # --- Quarter EC asymmetry (per-quarter max then spread) ---
    from collections import defaultdict
    q_ec: dict = defaultdict(list)
    for r in recent:
        if r.electrical_conductivity is not None:
            q_ec[r.quarter].append(r.electrical_conductivity)
    q_max_vals = [max(v) for v in q_ec.values()]
    asymmetry  = (max(q_max_vals) - min(q_max_vals)) if len(q_max_vals) >= 2 else 0.0

    # --- pH ---
    ph_vals  = [r.ph for r in recent if r.ph is not None]
    max_ph   = max(ph_vals) if ph_vals else 6.62

    # --- Turbidity ---
    turb_vals    = [r.turbidity for r in recent if r.turbidity is not None]
    max_turbidity = max(turb_vals) if turb_vals else 100.0

    # --- CMT (worst quarter) ---
    cmt_vals  = [CMT_MAP.get(r.cmt_result, 0) for r in recent]
    cmt_score = max(cmt_vals) if cmt_vals else 0

    # --- SCC log10 ---
    scc_vals    = [r.scc for r in recent if r.scc is not None and r.scc > 0]
    max_scc_log = math.log10(max(scc_vals)) if scc_vals else math.log10(100000)

    return {
        "max_ec":               round(max_ec, 4),
        "ec_pct_change":        round(ec_pct, 4),
        "quarter_ec_asymmetry": round(asymmetry, 4),
        "max_ph":               round(max_ph, 4),
        "max_turbidity":        round(max_turbidity, 4),
        "cmt_score":            float(cmt_score),
        "max_scc_log":          round(max_scc_log, 4),
    }


# ─── Group C — Environment ────────────────────────────────────────────────────

def _env_features(env_rows: list) -> dict:
    if not env_rows:
        return {
            "avg_humidity":        72.0,
            "avg_bedding_moisture": 32.0,
            "thi":                 65.0,
        }

    temps = [r.ambient_temperature for r in env_rows]
    rhs   = [r.humidity            for r in env_rows]
    mois  = [r.bedding_moisture     for r in env_rows]

    avg_temp  = sum(temps) / len(temps)
    avg_rh    = sum(rhs)   / len(rhs)
    avg_mois  = sum(mois)  / len(mois)

    # Temperature-Humidity Index (Thom 1959)
    thi = avg_temp - 0.55 * (1.0 - avg_rh / 100.0) * (avg_temp - 14.4)

    return {
        "avg_humidity":        round(avg_rh,   4),
        "avg_bedding_moisture": round(avg_mois, 4),
        "thi":                 round(thi,      4),
    }


# ─── Group D — Animal Profile ─────────────────────────────────────────────────

def _profile_features(cow: Bovine, cow_id: uuid.UUID, session: Session) -> dict:
    # Days in milk
    if cow.freshening_date:
        dim = (date.today() - cow.freshening_date).days
        dim = max(1, min(dim, 400))   # clamp to sane range
    else:
        dim = 120  # default: mid-lactation

    # Previous mastitis flag
    stmt = select(BovineHealthRecord).where(BovineHealthRecord.cow_id == cow_id)
    records = session.exec(stmt).all()
    prev_mastitis = int(any("mastitis" in (r.disease_name or "").lower() for r in records))

    return {
        "lactation_number":  float(cow.lactation_number or 2),
        "age_years":         float(cow.age_years or 4.0),
        "prev_mastitis_flag": float(prev_mastitis),
        "days_in_milk":      float(dim),
    }


# ─── DB Helpers ───────────────────────────────────────────────────────────────

def _get_wearable(cow_id, since, until, session):
    stmt = (
        select(WearableReading)
        .where(WearableReading.cow_id == cow_id)
        .where(WearableReading.recorded_at >= since)
        .where(WearableReading.recorded_at < until)
    )
    return list(session.exec(stmt).all())


def _get_milk(cow_id, since, until, session):
    stmt = (
        select(MilkReading)
        .where(MilkReading.cow_id == cow_id)
        .where(MilkReading.recorded_at >= since)
        .where(MilkReading.recorded_at < until)
    )
    return list(session.exec(stmt).all())


def _get_env(farmer_id, since, until, session):
    stmt = (
        select(EnvironmentReading)
        .where(EnvironmentReading.farmer_id == farmer_id)
        .where(EnvironmentReading.recorded_at >= since)
        .where(EnvironmentReading.recorded_at < until)
    )
    return list(session.exec(stmt).all())


def _default_features() -> dict:
    """Return healthy-range defaults when no data is available."""
    return {
        "activity_pct_change":    0.0,
        "rumination_pct_change":  0.0,
        "body_temp_max":          38.55,
        "lying_time_pct_change":  0.0,
        "max_ec":                 4.8,
        "ec_pct_change":          0.0,
        "quarter_ec_asymmetry":   0.0,
        "max_ph":                 6.62,
        "max_turbidity":          100.0,
        "cmt_score":              0.0,
        "max_scc_log":            5.0,
        "avg_humidity":           72.0,
        "avg_bedding_moisture":   32.0,
        "thi":                    65.0,
        "lactation_number":       2.0,
        "age_years":              4.0,
        "prev_mastitis_flag":     0.0,
        "days_in_milk":           120.0,
    }
