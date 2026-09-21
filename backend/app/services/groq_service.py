"""Groq LLM service for synthesizing XGBoost and SHAP mastitis predictions
into actionable farmer guidance.
"""

import json
import logging
import time
from typing import Dict, List, Optional, Tuple

import httpx

from app.config import settings
from app.models.cow import Bovine
from app.schemas.risk import AIGuidance, RiskFactor

logger = logging.getLogger(__name__)

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
CACHE_TTL_SECONDS = 4 * 3600  # 4 hours

# In-memory cache: key -> (timestamp, AIGuidance)
_GUIDANCE_CACHE: Dict[str, Tuple[float, AIGuidance]] = {}


def _build_fallback_guidance(
    cow: Optional[Bovine],
    score: float,
    category: str,
    factors: List[RiskFactor],
    lang: str = "en",
) -> AIGuidance:
    """Generate expert-crafted clinical guidance directly from XGBoost & SHAP factors
    when Groq API key is absent or offline.
    """
    cow_name = (cow.name or cow.tag_number or "This animal") if cow else "This cow"

    # Identify primary drivers from SHAP factors
    factor_labels = [f.label.lower() for f in factors]
    has_ec_spike = any("conductivity" in l or "ec" in l for l in factor_labels)
    has_rumination_drop = any("rumination" in l for l in factor_labels)
    has_temp_rise = any("temperature" in l or "temp" in l for l in factor_labels)
    has_bedding_issue = any("bedding" in l or "moisture" in l for l in factor_labels)
    has_thi_stress = any("heat" in l or "thi" in l for l in factor_labels)

    if category == "high":
        verdict = f"Critical Alert: High probability of acute or severe mastitis in {cow_name} ({score:.0f}/100)."
        immediate_actions = [
            f"Isolate {cow_name} immediately into a clean, dry quarantine stall to prevent cross-contamination.",
            "Perform a California Mastitis Test (CMT) on all 4 quarters to pinpoint the infected quarter.",
            "Do NOT mix milk from this cow with the bulk milk tank.",
            "Contact your veterinary officer or paravet right away for intramammary antibiotic or anti-inflammatory treatment.",
            "Milk this animal last during milking sessions, and thoroughly disinfect the milking cluster.",
        ]
        hygiene_tips = [
            "Apply agricultural lime powder (500g) over the stall floor to suppress environmental pathogens (Streptococcus/E. coli).",
            "Dip all 4 teats with 0.5% iodine barrier teat dip immediately before and after milking.",
        ]
        urgency = "immediate"
        call_vet = True
        explanation = (
            f"The XGBoost predictive model flagged a high risk score of {score:.0f}/100. "
            "Key SHAP contributors indicate severe physiological deviations: "
            + "; ".join([f.label for f in factors[:3]])
            + ". Immediate intervention is vital to prevent permanent quarter loss."
        )

    elif category == "moderate":
        verdict = f"Warning: Moderate risk of subclinical mastitis in {cow_name} ({score:.0f}/100)."
        immediate_actions = [
            "Perform a manual strip-cup test and CMT on all 4 quarters at the next milking session.",
            "Check for any heat, firmness, or swelling at the base of the udder.",
            "Observe rumination behavior and milk yield over the next 24 hours.",
            "Schedule a routine veterinary visit if symptoms or conductivity persist.",
        ]
        hygiene_tips = [
            "Replace wet bedding with dry paddy straw or sawdust; keep the resting floor dry.",
            "Ensure milkers wash hands and clean teat cups with warm chlorinated sanitizing solution between cows.",
        ]
        urgency = "within_24h"
        call_vet = False
        explanation = (
            f"Subclinical indicators were detected with a risk score of {score:.0f}/100. "
            f"Primary SHAP factors: {factors[0].label if factors else 'Elevated milk parameters'}. "
            "The infection is in early stages and can often be resolved with prompt hygiene correction."
        )

    elif category == "low":
        verdict = f"Watchlist: Mild fluctuations detected in {cow_name} ({score:.0f}/100)."
        immediate_actions = [
            "Continue regular daily milking and keep cow under observation.",
            "Check milk filter for any tiny clots, flakes, or watery secretions.",
            "Re-check somatic cell count and conductivity readings in 48 hours.",
        ]
        hygiene_tips = [
            "Maintain clean drinking water troughs and routine post-milking teat dipping.",
            "Keep cows standing for at least 30 minutes after milking while teat sphincters close.",
        ]
        urgency = "routine_monitoring"
        call_vet = False
        explanation = (
            f"Risk score is {score:.0f}/100. Vitals remain mostly stable with minor variations: "
            + (factors[0].label if factors else "Normal baseline")
            + ". Routine biosecurity is sufficient."
        )

    else:
        verdict = f"Optimal Health: {cow_name} shows clean milk and normal physiological parameters."
        immediate_actions = [
            "No medical action required.",
            "Continue standard milking protocol and balanced feed ration.",
        ]
        hygiene_tips = [
            "Maintain existing dry barn hygiene, pre-dip, and post-dip teat sanitization.",
        ]
        urgency = "routine_monitoring"
        call_vet = False
        explanation = "All biometric sensors, milk conductivity, and rumination metrics are within healthy baseline limits."

    # Add specific tips based on SHAP factors
    if has_bedding_issue:
        hygiene_tips.append("Bedding moisture is elevated — replace damp bedding twice daily to prevent environmental mastitis.")
    if has_thi_stress:
        hygiene_tips.append("Heat stress (THI) is high — provide shade, clean cool water, and operate barn ventilation fans.")
    if has_rumination_drop and urgency != "immediate":
        immediate_actions.append("Rumination has slowed — provide digestible dry fodder and monitor body temperature.")

    return AIGuidance(
        verdict=verdict,
        immediate_actions=immediate_actions,
        hygiene_and_bedding_tips=hygiene_tips,
        urgency=urgency,
        call_vet=call_vet,
        explanation_plain=explanation,
        model_name="XGBoost + SHAP Rule Engine",
    )


def generate_farmer_guidance(
    cow: Optional[Bovine],
    score: float,
    category: str,
    factors: List[RiskFactor],
    lang: str = "en",
    force_refresh: bool = False,
) -> AIGuidance:
    """Generate structured, actionable farmer guidance powered by Groq LLM (Llama-3.3)
    interpreting XGBoost and SHAP output, with in-memory TTL caching and graceful fallback.
    """
    cow_id_str = str(cow.id) if (cow and getattr(cow, "id", None)) else "generic"
    top_factors_sig = "|".join(f"{f.label}:{f.weight}" for f in factors[:3])
    cache_key = f"{cow_id_str}:{round(score, 1)}:{category}:{lang}:{top_factors_sig}"

    if not force_refresh and cache_key in _GUIDANCE_CACHE:
        timestamp, cached_guidance = _GUIDANCE_CACHE[cache_key]
        if (time.time() - timestamp) < CACHE_TTL_SECONDS:
            logger.info("Serving Groq AI guidance from memory cache for cow %s", cow_id_str)
            return cached_guidance

    api_key = (settings.GROQ_API_KEY or "").strip()
    if not api_key:
        logger.info("GROQ_API_KEY not configured; using XGBoost + SHAP domain-expert guidance.")
        fallback = _build_fallback_guidance(cow, score, category, factors, lang)
        _GUIDANCE_CACHE[cache_key] = (time.time(), fallback)
        return fallback

    # Format context for Groq
    cow_info = {
        "name": cow.name if cow else None,
        "pashu_aadhar": cow.pashu_aadhar if cow else None,
        "species": cow.species if cow else "cattle",
        "breed": cow.breed if cow else None,
        "lactation_number": cow.lactation_number if cow else 1,
        "age_years": cow.age_years if cow else None,
    }

    shap_factors_summary = "\n".join(
        [f"- {f.label} (Impact: {f.weight.upper()}, Feature value: {f.value})" for f in factors]
    )

    system_prompt = (
        "You are Kamadhenu AI, an expert veterinary clinical advisor and dairy specialist. "
        "You synthesize XGBoost machine learning predictions and SHAP (SHapley Additive exPlanations) "
        "feature attributions into clear, highly practical, step-by-step guidance for a dairy farmer.\n\n"
        "Return ONLY a valid JSON object with the following exact keys:\n"
        "{\n"
        '  "verdict": "Clear 1-sentence assessment with severity",\n'
        '  "immediate_actions": ["Step 1", "Step 2", "Step 3"],\n'
        '  "hygiene_and_bedding_tips": ["Tip 1", "Tip 2"],\n'
        '  "urgency": "immediate" | "within_24h" | "routine_monitoring",\n'
        '  "call_vet": true | false,\n'
        '  "explanation_plain": "2-3 sentences explaining in simple language how the SHAP features led to this conclusion"\n'
        "}\n\n"
        "Do not wrap in markdown quotes if possible, output pure JSON."
    )

    user_prompt = (
        f"ANIMAL PROFILE:\n{json.dumps(cow_info, indent=2)}\n\n"
        f"XGBOOST RISK PREDICTION:\n"
        f"- Risk Score: {score:.1f} / 100\n"
        f"- Category: {category.upper()}\n\n"
        f"TOP SHAP CONTRIBUTING FACTORS:\n{shap_factors_summary}\n\n"
        f"Language requested: {lang}\n"
        "Generate the clinical and farm hygiene guidance now."
    )

    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.GROQ_MODEL or "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 800,
            "response_format": {"type": "json_object"},
        }

        # Use verify=False to avoid Windows/corporate proxy self-signed certificate failures
        with httpx.Client(timeout=8.0, verify=False) as client:
            resp = client.post(GROQ_ENDPOINT, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)

            guidance = AIGuidance(
                verdict=str(parsed.get("verdict", f"Mastitis Risk Assessment: {category.upper()}")),
                immediate_actions=list(parsed.get("immediate_actions", [])),
                hygiene_and_bedding_tips=list(parsed.get("hygiene_and_bedding_tips", [])),
                urgency=str(parsed.get("urgency", "routine_monitoring")),
                call_vet=bool(parsed.get("call_vet", category in ["high", "moderate"])),
                explanation_plain=str(parsed.get("explanation_plain", "")),
                model_name=f"Groq {settings.GROQ_MODEL} + XGBoost & SHAP",
            )
            _GUIDANCE_CACHE[cache_key] = (time.time(), guidance)
            return guidance
    except Exception as e:
        logger.warning("Groq API call failed or timed out (%s); falling back to rule engine.", e)
        fallback = _build_fallback_guidance(cow, score, category, factors, lang)
        _GUIDANCE_CACHE[cache_key] = (time.time(), fallback)
        return fallback
