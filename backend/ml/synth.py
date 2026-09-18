"""Parametric synthetic training data generator for mastitis risk prediction.

Generates ~25,000 labeled feature-vector rows representing virtual cows across:
  - 5 breeds with breed-specific sensor baselines
  - 6 disease trajectory types (healthy, gradual, rapid, subclinical, recurrent, env-triggered)
  - 4 seasons (affects environmental features)
  - Varying parity (1-6), DIM (1-305), age (2-10)
  - Forward-looking labels: features at day D -> what happens at day D+7 to D+14

Labels:
  0 = no_risk   (days_until_clinical > 14, or healthy cow)
  1 = low       (7 < days_until_clinical <= 14)  <- early warning window
  2 = moderate  (3 < days_until_clinical <= 7)
  3 = high      (0 <= days_until_clinical <= 3)

Usage:
  python ml/synth.py                 # generates ml/data/training_data.csv
  python ml/synth.py --rows 50000   # generate more rows
"""

import argparse
import math
import os
import random
import sys
from pathlib import Path

import pandas as pd

# ─── Breed-specific sensor baselines (from veterinary literature) ──────────────

BREED_BASELINES = {
    "HF": {
        "activity": 125.0, "rumination": 18.0, "body_temp": 38.60,
        "lying_time": 18.0, "ec": 4.90, "ph": 6.62,
        "turbidity": 100.0, "scc": 110000,
    },
    "Jersey": {
        "activity": 115.0, "rumination": 20.0, "body_temp": 38.50,
        "lying_time": 20.0, "ec": 4.70, "ph": 6.60,
        "turbidity": 95.0, "scc": 120000,
    },
    "Sahiwal": {
        "activity": 110.0, "rumination": 22.0, "body_temp": 38.40,
        "lying_time": 22.0, "ec": 4.50, "ph": 6.58,
        "turbidity": 90.0, "scc": 90000,
    },
    "HF_Cross": {
        "activity": 120.0, "rumination": 19.0, "body_temp": 38.55,
        "lying_time": 19.0, "ec": 4.80, "ph": 6.61,
        "turbidity": 98.0, "scc": 105000,
    },
    "Murrah": {   # buffalo
        "activity": 95.0, "rumination": 28.0, "body_temp": 38.30,
        "lying_time": 25.0, "ec": 5.10, "ph": 6.65,
        "turbidity": 105.0, "scc": 95000,
    },
}

SEASONS = ["summer", "monsoon", "winter", "spring"]

DISEASE_TYPES = [
    "healthy",             # never gets sick
    "gradual_onset",       # 14-day slow progression
    "rapid_onset",         # 5-day fast onset (E.coli / trauma)
    "subclinical_only",    # SCC rises, never reaches full clinical
    "recurrent",           # had mastitis before; faster onset
    "env_triggered",       # only gets sick when humidity+moisture spikes
]

# Counts of virtual cows per disease type
DISEASE_COUNTS = {
    "healthy":          300,
    "gradual_onset":    250,
    "rapid_onset":      150,
    "subclinical_only": 150,
    "recurrent":        100,
    "env_triggered":    100,
    "near_miss":        100,   # EC spikes then recovers (trains false-positive resistance)
}

# ─── Noise helper ─────────────────────────────────────────────────────────────

def noisy(val: float, pct: float = 0.10) -> float:
    """Apply ±pct Gaussian noise so XGBoost doesn't overfit exact thresholds."""
    return val * random.gauss(1.0, pct / 3.0)


# ─── Environmental helpers ────────────────────────────────────────────────────

SEASON_ENV = {
    "summer":  {"temp": 32.0, "rh": 58.0, "moisture": 30.0},
    "monsoon": {"temp": 27.0, "rh": 86.0, "moisture": 62.0},
    "winter":  {"temp": 18.0, "rh": 70.0, "moisture": 28.0},
    "spring":  {"temp": 24.0, "rh": 65.0, "moisture": 32.0},
}

def season_env(season: str, noisy_pct: float = 0.08) -> tuple:
    e = SEASON_ENV[season]
    t   = noisy(e["temp"],     noisy_pct)
    rh  = min(99.0, noisy(e["rh"],  noisy_pct))
    mois = min(99.0, noisy(e["moisture"], noisy_pct))
    return t, rh, mois

def compute_thi(t: float, rh: float) -> float:
    return t - 0.55 * (1.0 - rh / 100.0) * (t - 14.4)


# ─── Label assignment ─────────────────────────────────────────────────────────

def assign_label(days_until_clinical) -> int:
    """Forward-looking 7-14 day prediction label."""
    if days_until_clinical is None:
        return 0   # healthy cow
    if days_until_clinical > 14:
        return 0   # no_risk
    if days_until_clinical > 7:
        return 1   # low — EARLY WARNING ZONE (7-14 days before)
    if days_until_clinical > 3:
        return 2   # moderate (3-7 days before)
    return 3       # high (clinical onset <= 3 days)


# ─── Feature computation per disease phase ────────────────────────────────────

def compute_features(
    dtc: int | None,    # days_until_clinical (None = healthy)
    breed: str,
    season: str,
    parity: int,
    dim: int,
    age: float,
    prev_flag: int,
    disease_type: str,
    noise_pct: float = 0.10,
) -> dict:
    """Compute all 18 features for one daily snapshot.

    dtc = days until clinical onset (None for cows that never get sick).
    """
    b = BREED_BASELINES[breed]
    t, rh, mois = season_env(season, noise_pct)

    # ── Parity / DIM modifiers ────────────────────────────────────────────────
    # Higher parity: slightly elevated baseline EC and SCC
    parity_ec_adj  = 1.0 + (parity - 1) * 0.015
    parity_scc_adj = 1.0 + (parity - 1) * 0.08

    # Early lactation (DIM 1-30) amplifies risk signals
    dim_amp = 1.3 if dim <= 30 else (1.1 if dim <= 60 else 1.0)

    # ── Multipliers by disease phase ──────────────────────────────────────────
    if dtc is None or dtc > 14:
        # Healthy / far from onset
        act_m   = noisy(1.00, noise_pct)
        rum_m   = noisy(1.00, noise_pct)
        temp_a  = noisy(0.00, noise_pct * 0.5)
        lie_m   = noisy(1.00, noise_pct)
        ec_m    = noisy(1.00, noise_pct) * parity_ec_adj
        ph_a    = noisy(0.00, noise_pct * 0.3)
        turb_m  = noisy(1.00, noise_pct)
        cmt     = 0
        scc_m   = noisy(1.00, noise_pct) * parity_scc_adj

    elif dtc > 7:
        # Pre-clinical (7-14 days before) — EARLY WARNING
        act_m   = noisy(random.uniform(0.84, 0.95), noise_pct) * dim_amp
        rum_m   = noisy(random.uniform(0.83, 0.95), noise_pct) * dim_amp
        temp_a  = noisy(random.uniform(0.00, 0.25), noise_pct * 0.4)
        lie_m   = noisy(random.uniform(1.05, 1.18), noise_pct)
        ec_m    = noisy(random.uniform(1.06, 1.22), noise_pct) * parity_ec_adj
        ph_a    = noisy(random.uniform(0.04, 0.14), noise_pct * 0.3)
        turb_m  = noisy(random.uniform(1.10, 1.45), noise_pct)
        cmt     = 0
        scc_m   = noisy(random.uniform(1.30, 2.20), noise_pct) * parity_scc_adj

    elif dtc > 3:
        # Subclinical (3-7 days before)
        act_m   = noisy(random.uniform(0.65, 0.82), noise_pct) * dim_amp
        rum_m   = noisy(random.uniform(0.68, 0.82), noise_pct) * dim_amp
        temp_a  = noisy(random.uniform(0.25, 0.55), noise_pct * 0.4)
        lie_m   = noisy(random.uniform(1.18, 1.35), noise_pct)
        ec_m    = noisy(random.uniform(1.20, 1.48), noise_pct) * parity_ec_adj
        ph_a    = noisy(random.uniform(0.16, 0.30), noise_pct * 0.3)
        turb_m  = noisy(random.uniform(1.80, 2.90), noise_pct)
        cmt     = random.choices([1, 2], weights=[0.55, 0.45])[0]
        scc_m   = noisy(random.uniform(2.50, 5.00), noise_pct) * parity_scc_adj

    else:
        # Clinical onset (<= 3 days)
        act_m   = noisy(random.uniform(0.38, 0.63), noise_pct) * dim_amp
        rum_m   = noisy(random.uniform(0.38, 0.60), noise_pct) * dim_amp
        temp_a  = noisy(random.uniform(0.70, 1.65), noise_pct * 0.3)
        lie_m   = noisy(random.uniform(1.35, 1.65), noise_pct)
        ec_m    = noisy(random.uniform(1.45, 1.85), noise_pct) * parity_ec_adj
        ph_a    = noisy(random.uniform(0.30, 0.58), noise_pct * 0.3)
        turb_m  = noisy(random.uniform(3.50, 6.20), noise_pct)
        cmt     = random.choices([3, 4], weights=[0.45, 0.55])[0]
        scc_m   = noisy(random.uniform(7.00, 16.00), noise_pct) * parity_scc_adj

    # Subclinical-only: cap at moderate, never full clinical markers
    if disease_type == "subclinical_only":
        cmt     = min(cmt, 2)
        scc_m   = min(scc_m, 5.0)
        ec_m    = min(ec_m, b["ec"] * 1.42)

    # Env-triggered: amplify environmental features during disease phase
    if disease_type == "env_triggered" and dtc is not None and dtc <= 14:
        rh   = min(99.0, rh + random.uniform(10, 20))
        mois = min(99.0, mois + random.uniform(12, 25))

    # Recurrent: onset is faster (worse multipliers earlier)
    if disease_type == "recurrent" and dtc is not None and 7 < dtc <= 14:
        act_m  *= 0.92
        rum_m  *= 0.91
        ec_m   *= 1.06
        scc_m  *= 1.15

    # ── Compute actual feature values ─────────────────────────────────────────
    act_r   = b["activity"]    * act_m
    rum_r   = b["rumination"]  * rum_m
    body_t  = b["body_temp"]   + temp_a
    lie_r   = b["lying_time"]  * lie_m

    ec_r    = b["ec"]        * ec_m
    ec_b    = b["ec"]        * parity_ec_adj
    ec_pct  = (ec_r - ec_b) / ec_b * 100.0

    # Quarter asymmetry: affected quarter has higher EC, others stay baseline
    if dtc is not None and dtc <= 14:
        worst_q_ec = ec_r
        best_q_ec  = b["ec"] * parity_ec_adj * noisy(1.0, 0.05)
        asymmetry  = max(0.0, worst_q_ec - best_q_ec)
    else:
        asymmetry  = noisy(0.10, noise_pct)

    ph_r    = b["ph"]        + ph_a
    turb_r  = b["turbidity"] * turb_m
    scc_r   = b["scc"]       * scc_m
    scc_log = math.log10(max(scc_r, 10000))

    thi_val = compute_thi(t, rh)

    # ── Baselines (simulated 7-day prior window) ───────────────────────────────
    act_b_val  = b["activity"]   * parity_ec_adj * noisy(1.0, 0.05)
    rum_b_val  = b["rumination"] * noisy(1.0, 0.05)
    lie_b_val  = b["lying_time"] * noisy(1.0, 0.05)

    act_pct  = (act_r  - act_b_val)  / act_b_val  * 100.0
    rum_pct  = (rum_r  - rum_b_val)  / rum_b_val  * 100.0
    lie_pct  = (lie_r  - lie_b_val)  / lie_b_val  * 100.0

    return {
        "activity_pct_change":    round(act_pct,  4),
        "rumination_pct_change":  round(rum_pct,  4),
        "body_temp_max":          round(body_t,   4),
        "lying_time_pct_change":  round(lie_pct,  4),
        "max_ec":                 round(ec_r,     4),
        "ec_pct_change":          round(ec_pct,   4),
        "quarter_ec_asymmetry":   round(asymmetry, 4),
        "max_ph":                 round(ph_r,     4),
        "max_turbidity":          round(turb_r,   4),
        "cmt_score":              float(cmt),
        "max_scc_log":            round(scc_log,  4),
        "avg_humidity":           round(rh,       4),
        "avg_bedding_moisture":   round(mois,     4),
        "thi":                    round(thi_val,  4),
        "lactation_number":       float(parity),
        "age_years":              round(age,      2),
        "prev_mastitis_flag":     float(prev_flag),
        "days_in_milk":           float(dim),
    }


# ─── Cow simulation ───────────────────────────────────────────────────────────

def simulate_cow(cow_id: int, disease_type: str) -> list[dict]:
    """Simulate 20-35 daily snapshots for one virtual cow, returning labeled rows."""
    breed   = random.choice(list(BREED_BASELINES.keys()))
    season  = random.choice(SEASONS)
    parity  = random.randint(1, 6)
    dim     = random.randint(1, 305)
    age     = round(random.uniform(2.5, 10.0), 1)
    prev_flag = 1 if disease_type == "recurrent" else random.choices([0, 1], weights=[0.75, 0.25])[0]
    noise   = random.uniform(0.07, 0.13)

    rows = []

    if disease_type == "healthy":
        # 20-25 healthy daily snapshots — all label 0
        n_days = random.randint(20, 25)
        for day in range(n_days):
            feats = compute_features(None, breed, season, parity, dim + day, age, prev_flag, disease_type, noise)
            feats["label"] = 0
            feats["cow_sim_id"] = f"cow_{cow_id:04d}"
            rows.append(feats)

    elif disease_type == "near_miss":
        # EC/SCC spike on days 5-8 then recovers — all label 0
        n_days = 20
        for day in range(n_days):
            if 5 <= day <= 8:
                spike_dtc = 100   # "looks bad but no disease"
                feats = compute_features(spike_dtc, breed, season, parity, dim + day, age, prev_flag, "gradual_onset", noise)
                # But override label to 0 — this is a false positive training sample
                feats["label"] = 0
            else:
                feats = compute_features(None, breed, season, parity, dim + day, age, prev_flag, disease_type, noise)
                feats["label"] = 0
            feats["cow_sim_id"] = f"cow_{cow_id:04d}"
            rows.append(feats)

    else:
        # Disease onset cows
        if disease_type == "gradual_onset":
            total_days = random.randint(25, 35)
            onset_day  = random.randint(14, total_days - 5)
        elif disease_type == "rapid_onset":
            total_days = random.randint(15, 22)
            onset_day  = random.randint(8, total_days - 5)
        elif disease_type == "subclinical_only":
            total_days = random.randint(20, 28)
            onset_day  = random.randint(10, total_days - 5)
        elif disease_type == "recurrent":
            total_days = random.randint(18, 25)
            onset_day  = random.randint(8, total_days - 5)
        elif disease_type == "env_triggered":
            total_days = random.randint(22, 30)
            onset_day  = random.randint(12, total_days - 5)
        else:
            total_days = 25
            onset_day  = 14

        # clinical_day = onset_day + disease progression window
        progression = 3 if disease_type == "rapid_onset" else random.randint(3, 5)
        clinical_day = onset_day + progression

        # For subclinical_only, there is no real "clinical day" — use a high number
        if disease_type == "subclinical_only":
            clinical_day = total_days + 50   # never reached

        for day in range(total_days):
            dtc = clinical_day - day   # days until clinical from this day's perspective
            if dtc < 0:
                dtc = 0   # clinical phase continues
            feats = compute_features(dtc, breed, season, parity, dim + day, age, prev_flag, disease_type, noise)
            feats["label"] = assign_label(dtc if disease_type != "subclinical_only" else (None if day < onset_day else dtc))
            feats["cow_sim_id"] = f"cow_{cow_id:04d}"
            rows.append(feats)

    return rows


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate synthetic mastitis training data.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility.")
    parser.add_argument("--out", type=str, default="ml/data/training_data.csv")
    args = parser.parse_args()

    random.seed(args.seed)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print("Generating synthetic mastitis training data...")
    print(f"  Disease type distribution: {DISEASE_COUNTS}")

    all_rows = []
    cow_id   = 0

    for disease_type, count in DISEASE_COUNTS.items():
        type_rows = []
        for _ in range(count):
            cow_id += 1
            type_rows.extend(simulate_cow(cow_id, disease_type))
        n = len(type_rows)
        labels = [r["label"] for r in type_rows]
        print(f"  [{disease_type:<20}] {count:4d} cows -> {n:6d} rows  |  "
              f"labels: 0={labels.count(0)}, 1={labels.count(1)}, 2={labels.count(2)}, 3={labels.count(3)}")
        all_rows.extend(type_rows)

    df = pd.DataFrame(all_rows)

    total = len(df)
    label_dist = df["label"].value_counts().sort_index().to_dict()
    print(f"\nTotal rows: {total:,}")
    print(f"Label distribution:")
    for lbl, cnt in label_dist.items():
        name = ["no_risk", "low", "moderate", "high"][lbl]
        print(f"  {lbl} ({name:<10}): {cnt:6,}  ({cnt/total*100:.1f}%)")

    df.to_csv(out_path, index=False)
    print(f"\nSaved: {out_path}")
    print(f"Columns: {list(df.columns)}")


if __name__ == "__main__":
    main()
