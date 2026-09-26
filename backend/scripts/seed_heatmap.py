"""
seed_heatmap.py — Populate the DB with realistic Karnataka heatmap test data.

Creates:
  • 1 authority user  (login: 9900000001 / heatmap123)
  • 15 farmers spread across Mandya district villages (with GPS)
  • 30 cows owned by those farmers (with GPS)
  • 30 RiskScore records (mix of no_risk → high)
  • 12 open Complaints with GPS coords (mix of priorities)

Usage (from backend/):
    .\.venv\Scripts\python.exe scripts/seed_heatmap.py

Run again to skip already-seeded data (idempotent phone-based checks).
"""

import json
import sys
import uuid

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from datetime import datetime, timedelta, timezone
from pathlib import Path
from random import choice, randint, uniform

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select

from app.core.security import hash_password
from app.database import create_db_and_tables, engine
from app.models.complaint import Complaint, ComplaintPriority, ComplaintStatus
from app.models.cow import Bovine
from app.models.risk import RiskScore
from app.models.user import User, UserRole

# ── Mandya district villages — real GPS coordinates ────────────────────────
VILLAGES = [
    {"name": "Mandya",           "lat": 12.5218,  "lng": 76.8952},
    {"name": "Maddur",           "lat": 12.5843,  "lng": 77.0434},
    {"name": "Malavalli",        "lat": 12.3904,  "lng": 77.0617},
    {"name": "Srirangapatna",    "lat": 12.4234,  "lng": 76.6960},
    {"name": "Nagamangala",      "lat": 12.8186,  "lng": 76.7559},
    {"name": "Pandavapura",      "lat": 12.4866,  "lng": 76.6680},
    {"name": "Kirugavalu",       "lat": 12.5660,  "lng": 76.7050},
    {"name": "Bellur",           "lat": 12.4560,  "lng": 76.9220},
    {"name": "Koppa",            "lat": 12.5400,  "lng": 76.8300},
    {"name": "Hosaholalu",       "lat": 12.4800,  "lng": 76.9500},
    {"name": "KR Pete",          "lat": 12.9559,  "lng": 76.2592},
    {"name": "Melukote",         "lat": 12.6600,  "lng": 76.6500},
    {"name": "Shivapura",        "lat": 12.5100,  "lng": 77.0000},
    {"name": "Mysore Road",      "lat": 12.5500,  "lng": 76.8700},
    {"name": "Bindiganavile",    "lat": 12.3500,  "lng": 76.9400},
]

# ── Risk score distribution — designed for a visible heatmap ───────────────
#  (category, score_range_min, score_range_max)
RISK_PROFILES = [
    ("high",     75.0, 97.0),   # 8 cows — bright red on map
    ("moderate", 45.0, 70.0),   # 10 cows — orange
    ("low",      15.0, 44.0),   # 7 cows  — yellow
    ("no_risk",   0.0, 14.0),   # 5 cows  — green
]

RISK_WEIGHTS = [8, 10, 7, 5]     # how many cows in each category

COMPLAINT_PRIORITIES = [
    ComplaintPriority.critical,
    ComplaintPriority.critical,
    ComplaintPriority.high,
    ComplaintPriority.high,
    ComplaintPriority.high,
    ComplaintPriority.medium,
    ComplaintPriority.medium,
    ComplaintPriority.medium,
    ComplaintPriority.medium,
    ComplaintPriority.low,
    ComplaintPriority.low,
    ComplaintPriority.low,
]

BREEDS = ["HF", "Jersey", "Sahiwal", "Murrah", "Gir", "HF Cross", "Deoni"]
DISEASES = ["Mastitis", "FMD", "Lumpy Skin", "BQ", "HS", "Brucellosis"]

COW_SYMPTOMS = [
    "Reduced milk yield with clots, swollen udder, fever 103°F",
    "Lameness in right foreleg, high temperature, drooling",
    "Skin nodules all over body, nasal discharge, fever",
    "Reluctant to move, hindquarters swelling, high fever",
    "Abortion, retained placenta, milk drop",
    "Loss of appetite, dullness, rumen stasis",
]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def jitter(lat: float, lng: float, radius_deg: float = 0.04):
    """Scatter a GPS point within a radius to spread cows across a village."""
    return (
        lat + uniform(-radius_deg, radius_deg),
        lng + uniform(-radius_deg, radius_deg),
    )


def get_or_skip(session: Session, phone: str) -> User | None:
    return session.exec(select(User).where(User.phone == phone)).first()


def seed():
    create_db_and_tables()

    with Session(engine) as session:
        print("\n🌱  Kamadhenu — Heatmap Seed Script")
        print("─" * 45)

        # ── 1. Authority user ──────────────────────────────────────────────
        auth_phone = "9900000001"
        if not get_or_skip(session, auth_phone):
            authority = User(
                name="District Authority (Demo)",
                phone=auth_phone,
                hashed_password=hash_password("heatmap123"),
                role=UserRole.authority,
                employee_id="AUTH-DM-001",
                department="State Animal Husbandry Department",
                jurisdiction="Mandya District",
                latitude=12.5218,
                longitude=76.8952,
                is_active=True,
            )
            session.add(authority)
            session.commit()
            print(f"✅  Authority created  →  phone: {auth_phone}  /  pass: heatmap123")
        else:
            print(f"⏭️   Authority {auth_phone} already exists — skipped")

        # ── 2. Farmers (one per village, 15 total) ─────────────────────────
        farmers: list[User] = []
        for i, village in enumerate(VILLAGES):
            phone = f"990000{i + 10:04d}"
            existing = get_or_skip(session, phone)
            if existing:
                farmers.append(existing)
                print(f"⏭️   Farmer {existing.name} already exists — skipped")
                continue

            farmer = User(
                name=f"Farmer {village['name']}",
                phone=phone,
                hashed_password=hash_password("farmer123"),
                role=UserRole.farmer,
                place=village["name"],
                number_of_animals=randint(2, 8),
                latitude=village["lat"],
                longitude=village["lng"],
                is_active=True,
            )
            session.add(farmer)
            session.commit()
            session.refresh(farmer)
            farmers.append(farmer)
            print(f"✅  Farmer: {farmer.name:30s}  GPS: ({village['lat']:.4f}, {village['lng']:.4f})")

        # ── 3. Cows + Risk Scores ─────────────────────────────────────────
        # Build a flat list of (category, score) tuples in RISK_WEIGHTS order
        score_plan: list[tuple[str, float]] = []
        for (cat, mn, mx), count in zip(RISK_PROFILES, RISK_WEIGHTS):
            for _ in range(count):
                score_plan.append((cat, round(uniform(mn, mx), 1)))

        # Shuffle so the heatmap looks natural (not all red in one spot)
        from random import shuffle
        shuffle(score_plan)

        cows_created: list[tuple[Bovine, User]] = []
        cow_counter = 0

        for (category, score), farmer in zip(score_plan, farmers * 2):  # allow multiple cows per farmer
            village = next(v for v in VILLAGES if v["name"] == (farmer.place or "Mandya"))
            clat, clng = jitter(village["lat"], village["lng"])

            cow_phone_suffix = f"{cow_counter:04d}"
            tag = f"KA-04-{cow_phone_suffix}"

            # Check for existing cow by tag
            existing_cow = session.exec(
                select(Bovine).where(Bovine.tag_number == tag)
            ).first()
            if existing_cow:
                cows_created.append((existing_cow, farmer))
                cow_counter += 1
                continue

            cow = Bovine(
                farmer_id=farmer.id,
                tag_number=tag,
                name=choice(["Gauri", "Lakshmi", "Kamdhenu", "Nandini", "Bhavani", "Ganga", "Tulsi"]) + f"-{cow_counter}",
                breed=choice(BREEDS),
                species="cattle" if cow_counter % 5 != 0 else "buffalo",
                age_years=round(uniform(2.0, 8.0), 1),
                lactation_number=randint(1, 4),
                latitude=clat,
                longitude=clng,
                is_active=True,
            )
            session.add(cow)
            session.commit()
            session.refresh(cow)

            # Risk score — scored within the last 1–7 days so API window catches it
            days_ago = uniform(0.5, 6.5)
            scored_at = now_utc() - timedelta(days=days_ago)

            fake_factors = json.dumps([
                {"label": "Milk conductivity spike", "weight": "high",     "value": round(uniform(6.5, 9.0), 2)},
                {"label": "Rumination drop",         "weight": "moderate", "value": round(uniform(30.0, 80.0), 1)},
                {"label": "Body temperature",        "weight": "high",     "value": round(uniform(38.5, 41.0), 1)},
            ])

            rs = RiskScore(
                cow_id=cow.id,
                scored_at=scored_at,
                score=score,
                category=category,
                factors=fake_factors,
                engine_version="xgb-v1",
                window_days=7,
                created_at=scored_at,
            )
            session.add(rs)
            session.commit()

            cows_created.append((cow, farmer))
            cow_counter += 1
            icon = "🔴" if category == "high" else "🟠" if category == "moderate" else "🟡" if category == "low" else "🟢"
            print(f"  {icon}  Cow {tag:12s} [{category:8s} {score:5.1f}]  farmer: {farmer.place}")

        print(f"\n✅  {len(cows_created)} cows + risk scores seeded")

        # ── 4. Open Complaints (with GPS) ────────────────────────────────────
        complaint_number_base = 900  # start from 900 to avoid collision with real data
        complaints_created = 0

        for i, priority in enumerate(COMPLAINT_PRIORITIES):
            # Pick a cow + farmer pair for this complaint
            cow, farmer = cows_created[i % len(cows_created)]
            village = next((v for v in VILLAGES if v["name"] == (farmer.place or "Mandya")), VILLAGES[0])
            clat, clng = jitter(village["lat"], village["lng"], 0.02)

            comp_num = complaint_number_base + i

            # Skip if complaint number already exists
            existing_complaint = session.exec(
                select(Complaint).where(Complaint.complaint_number == comp_num)
            ).first()
            if existing_complaint:
                print(f"⏭️   Complaint #{comp_num} already exists — skipped")
                continue

            status = choice([
                ComplaintStatus.open,
                ComplaintStatus.open,
                ComplaintStatus.assigned,
                ComplaintStatus.in_progress,
            ])
            days_ago = uniform(0.1, 3.0)
            created = now_utc() - timedelta(days=days_ago)

            complaint = Complaint(
                complaint_number=comp_num,
                farmer_id=farmer.id,
                bovine_id=cow.id,
                status=status,
                priority=priority,
                description=f"Animal showing signs of distress. {choice(COW_SYMPTOMS)}",
                symptoms=choice(COW_SYMPTOMS),
                animal_lat=clat,
                animal_lng=clng,
                created_at=created,
                updated_at=created,
            )
            session.add(complaint)
            session.commit()
            complaints_created += 1

            icon = "🚨" if priority == ComplaintPriority.critical else "🔺" if priority == ComplaintPriority.high else "🔸"
            print(f"  {icon}  Complaint CMP-{comp_num:04d}  [{priority.value:8s}]  {status.value:11s}  {village['name']}")

        print(f"\n✅  {complaints_created} complaints seeded")

        # ── Summary ────────────────────────────────────────────────────────
        print("\n" + "─" * 45)
        print("🗺️   Heatmap test data ready!")
        print()
        print("  Login as authority to see the heatmap:")
        print(f"    Phone    : {auth_phone}")
        print(f"    Password : heatmap123")
        print()
        print("  The heatmap will show:")
        print(f"    🔴  {RISK_WEIGHTS[0]} HIGH-risk points  (bright red)")
        print(f"    🟠  {RISK_WEIGHTS[1]} MODERATE points   (orange)")
        print(f"    🟡  {RISK_WEIGHTS[2]} LOW-risk points   (yellow)")
        print(f"    🟢  {RISK_WEIGHTS[3]} SAFE points       (green)")
        print(f"    📍  {len(COMPLAINT_PRIORITIES)} complaint GPS pins")
        print()
        print("  All data is spread across Mandya district, Karnataka.")
        print("─" * 45 + "\n")


if __name__ == "__main__":
    seed()
