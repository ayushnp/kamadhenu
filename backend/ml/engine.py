"""Mastitis risk inference engine.

Loads the trained XGBoost model (ml/models/mastitis_xgb.ubj) and runs inference
on a cow's current sensor data, returning:
  - A 0-100 risk score
  - A risk category (no_risk / low / moderate / high)
  - Top 5 SHAP-driven factors in plain English
  - A plain-English recommendation for the farmer

The model is cached in memory after first load (lazy singleton).

Usage (from FastAPI):
  from ml.engine import score_cow
  result = score_cow(cow_id, session, window_days=7)
"""

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import numpy as np
import pandas as pd
import shap
from xgboost import XGBClassifier

from ml.features import FEATURE_COLS, extract_features

# ─── Model path ───────────────────────────────────────────────────────────────
MODEL_PATH = Path(__file__).parent / "models" / "mastitis_xgb.ubj"

# ─── Lazy singleton ───────────────────────────────────────────────────────────
_model: Optional[XGBClassifier] = None
_explainer = None


def _load_model() -> XGBClassifier:
    global _model, _explainer
    if _model is None:
        if not MODEL_PATH.exists():
            raise RuntimeError(
                f"Model not found at {MODEL_PATH}. "
                "Run: python ml/train.py"
            )
        m = XGBClassifier()
        m.load_model(str(MODEL_PATH))
        _model = m
        # Build SHAP explainer once
        _explainer = shap.TreeExplainer(_model)
    return _model


# ─── Result dataclass ─────────────────────────────────────────────────────────

@dataclass
class RiskFactor:
    label: str
    weight: str    # "high" | "moderate" | "low"
    value: float


@dataclass
class RiskResult:
    score: float
    category: str
    factors: List[RiskFactor]
    engine_version: str
    window_days: int
    recommendation: str
    scored_at: datetime


RECOMMENDATIONS = {
    "no_risk":  "Continue routine monitoring. No action required.",
    "low":      "Monitor closely. Check milk quality and activity daily for the next week.",
    "moderate": "Perform a manual CMT test on all quarters and consult your veterinarian soon.",
    "high":     "Isolate the cow immediately and contact a veterinarian within 24 hours.",
}

CATEGORIES = ["no_risk", "low", "moderate", "high"]

# ─── Human-readable factor labels ─────────────────────────────────────────────

CMT_NAMES = {0: "Negative", 1: "Trace", 2: "1+", 3: "2+", 4: "3+"}


def _human_label(feat: str, value: float, shap_val: float) -> str:
    direction = "elevated" if shap_val > 0 else "reduced"

    if feat == "activity_pct_change":
        return f"Activity dropped {abs(value):.0f}% below baseline" if value < -5 else "Activity within normal range"
    elif feat == "rumination_pct_change":
        return f"Rumination dropped {abs(value):.0f}% below baseline" if value < -5 else "Rumination within normal range"
    elif feat == "body_temp_max":
        return f"Body temperature {direction} at {value:.1f} C"
    elif feat == "lying_time_pct_change":
        return f"Lying time increased {value:.0f}% above baseline (lethargy sign)" if value > 10 else "Lying time within normal range"
    elif feat == "max_ec":
        return f"Milk electrical conductivity {direction} ({value:.2f} mS/cm)"
    elif feat == "ec_pct_change":
        return f"Milk EC rose {value:.0f}% above 7-day baseline" if value > 0 else f"Milk EC declined {abs(value):.0f}% below baseline"
    elif feat == "quarter_ec_asymmetry":
        return f"EC difference between quarters: {value:.2f} mS/cm (suggests localised infection)" if value > 0.5 else "EC uniform across quarters"
    elif feat == "max_ph":
        return f"Milk pH {direction} at {value:.2f} (normal 6.4-6.8)"
    elif feat == "max_turbidity":
        return f"Milk turbidity elevated ({value:.0f} NTU) - possible clots/flakes" if value > 150 else f"Milk turbidity normal ({value:.0f} NTU)"
    elif feat == "cmt_score":
        return f"CMT result: {CMT_NAMES.get(int(value), str(value))} in worst quarter"
    elif feat == "max_scc_log":
        safe_val = min(max(value, 0.0), 8.0)
        scc_est = (10 ** safe_val) / 1000
        return f"Estimated SCC: ~{scc_est:.0f}k cells/mL"
    elif feat == "avg_humidity":
        return f"Barn humidity {direction} ({value:.0f}% RH)"
    elif feat == "avg_bedding_moisture":
        return f"Bedding moisture high ({value:.0f}%) - hygiene risk" if value > 45 else f"Bedding moisture acceptable ({value:.0f}%)"
    elif feat == "thi":
        return f"Heat-humidity stress elevated (THI {value:.0f})" if value > 72 else f"Thermal comfort normal (THI {value:.0f})"
    elif feat == "lactation_number":
        return f"Parity {int(value)} - {'higher' if value >= 3 else 'normal'} baseline risk"
    elif feat == "age_years":
        return f"Age {value:.1f} years"
    elif feat == "prev_mastitis_flag":
        return "Previous mastitis history - recurrence risk elevated" if value > 0.5 else "No prior mastitis history"
    elif feat == "days_in_milk":
        return f"Early lactation (DIM {int(value)}) - high-risk window" if value <= 30 else f"DIM {int(value)} - mid/late lactation"

    return f"{feat}: {value:.3f}"


def _weight_from_shap(shap_val: float, max_shap: float) -> str:
    ratio = abs(shap_val) / max(abs(max_shap), 1e-9)
    if ratio >= 0.5:
        return "high"
    if ratio >= 0.25:
        return "moderate"
    return "low"


# ─── Main scoring function ────────────────────────────────────────────────────

def score_cow(cow_id: uuid.UUID, session, window_days: int = 7) -> RiskResult:
    """Score a cow's mastitis risk using the trained XGBoost model.

    Args:
        cow_id: UUID of the bovine.
        session: Active SQLModel database session.
        window_days: Look-back window for feature extraction.

    Returns:
        RiskResult with score, category, SHAP factors, and recommendation.
    """
    model = _load_model()

    # 1. Extract 18 features from DB
    feats = extract_features(cow_id, session, window_days=window_days)
    X = pd.DataFrame([feats])[FEATURE_COLS].values.astype(float)

    # 2. Predict class probabilities
    proba = model.predict_proba(X)[0]   # shape (4,)

    # 3. Continuous risk score (weighted sum)
    score = float(0 * proba[0] + 25 * proba[1] + 55 * proba[2] + 100 * proba[3])
    score = round(min(100.0, max(0.0, score)), 1)

    # 4. Category
    predicted_class = int(np.argmax(proba))
    category = CATEGORIES[predicted_class]

    # 5. SHAP explanation
    shap_vals = _explainer.shap_values(X)
    if isinstance(shap_vals, list):
        class_shap = shap_vals[predicted_class][0]   # older shap list-of-arrays
    elif isinstance(shap_vals, np.ndarray) and shap_vals.ndim == 3:
        class_shap = shap_vals[0, :, predicted_class] # (samples, features, classes)
    else:
        class_shap = shap_vals[0]

    # Rank features by |SHAP| descending, take top 5
    top_idx = np.argsort(np.abs(class_shap))[::-1][:5]
    max_shap = float(np.max(np.abs(class_shap)))

    factors: List[RiskFactor] = []
    for idx in top_idx:
        feat_name = FEATURE_COLS[idx]
        feat_val  = float(feats[feat_name])
        shap_v    = float(class_shap[idx])
        factors.append(RiskFactor(
            label=_human_label(feat_name, feat_val, shap_v),
            weight=_weight_from_shap(shap_v, max_shap),
            value=round(feat_val, 4),
        ))

    return RiskResult(
        score=score,
        category=category,
        factors=factors,
        engine_version="xgb-v1",
        window_days=window_days,
        recommendation=RECOMMENDATIONS[category],
        scored_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
