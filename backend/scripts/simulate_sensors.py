"""Simulate 14 days of realistic IoT sensor telemetry for KAMADHENU.

Demonstrates:
  1. Healthy baseline herd cows (KA002, KA003)
  2. Demo cow KA024 transitioning from healthy (Days 1-8) -> subclinical (Days 9-11) -> acute clinical mastitis (Days 12-14) in the Front-Left (FL) quarter
  3. Barn environmental telemetry (diurnal temperature, elevated moisture/humidity as risk factor)

Usage:
  python scripts/simulate_sensors.py
  python scripts/simulate_sensors.py --reset
"""

import argparse
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, delete, select

from app.core.security import hash_password
from app.database import create_db_and_tables, engine
from app.models.cow import Bovine
from app.models.sensor import (
    CMTResult,
    EnvironmentReading,
    MilkQuarter,
    MilkReading,
    WearableReading,
)
from app.models.user import User, UserRole


def ensure_demo_farmer_and_cows(session: Session) -> tuple[User, Bovine, list[Bovine]]:
    """Ensure a demo farmer and cows exist."""
    # 1. Farmer
    farmer_phone = "9876543210"
    farmer = session.exec(select(User).where(User.phone == farmer_phone)).first()
    if not farmer:
        farmer = User(
            name="Ramesh Gowda",
            phone=farmer_phone,
            email="ramesh.farmer@kamadhenu.in",
            hashed_password=hash_password("password123"),
            role=UserRole.farmer,
            place="Mandya, Karnataka",
            number_of_animals=3,
            latitude=12.5218,
            longitude=76.8951,
        )
        session.add(farmer)
        session.commit()
        session.refresh(farmer)
        print(f"[+] Created Demo Farmer: {farmer.name} ({farmer.phone})")
    else:
        print(f"[*] Found Demo Farmer: {farmer.name} ({farmer.phone})")

    # 2. Demo Cow KA024 (Primary Mastitis Target)
    ka024 = session.exec(select(Bovine).where(Bovine.pashu_aadhar == "KA024")).first()
    if not ka024:
        ka024 = Bovine(
            pashu_aadhar="KA024",
            tag_number="TAG-024",
            barcode="BC-KA-024",
            name="Ganga",
            species="cattle",
            breed="HF Cross",
            age_years=4.5,
            lactation_number=3,
            calf_number=3,
            farmer_id=farmer.id,
            latitude=12.5220,
            longitude=76.8953,
        )
        session.add(ka024)
        session.commit()
        session.refresh(ka024)
        print(f"[+] Created Target Cow: {ka024.name} (Pashu Aadhaar: {ka024.pashu_aadhar})")
    else:
        print(f"[*] Found Target Cow: {ka024.name} (Pashu Aadhaar: {ka024.pashu_aadhar})")

    # 3. Healthy Herd Cows
    healthy_cows = []
    for tag, name, breed, age, lact in [
        ("KA002", "Gauri", "Jersey Cross", 3.0, 2),
        ("KA003", "Lakshmi", "Sahiwal", 5.0, 4),
    ]:
        cow = session.exec(select(Bovine).where(Bovine.pashu_aadhar == tag)).first()
        if not cow:
            cow = Bovine(
                pashu_aadhar=tag,
                tag_number=f"TAG-{tag}",
                barcode=f"BC-{tag}",
                name=name,
                species="cattle",
                breed=breed,
                age_years=age,
                lactation_number=lact,
                calf_number=lact,
                farmer_id=farmer.id,
                latitude=12.5222,
                longitude=76.8950,
            )
            session.add(cow)
            session.commit()
            session.refresh(cow)
            print(f"[+] Created Healthy Herd Cow: {cow.name} ({cow.pashu_aadhar})")
        healthy_cows.append(cow)

    return farmer, ka024, healthy_cows


def clear_sensor_data(session: Session, cow_ids: list[uuid.UUID], farmer_id: uuid.UUID) -> None:
    """Purge existing telemetry for a fresh simulation run."""
    print("[*] Cleaning previous simulation sensor data...")
    for cid in cow_ids:
        session.exec(delete(WearableReading).where(WearableReading.cow_id == cid))
        session.exec(delete(MilkReading).where(MilkReading.cow_id == cid))
    session.exec(delete(EnvironmentReading).where(EnvironmentReading.farmer_id == farmer_id))
    session.commit()
    print("[OK] Previous sensor data cleaned.")


def simulate_wearable_for_cow(
    session: Session,
    cow: Bovine,
    start_time: datetime,
    is_mastitis_target: bool = False,
) -> int:
    """Generate 14 days of wearable telemetry every 2 hours (168 records per cow)."""
    records = []
    now = datetime.now(timezone.utc)

    for hour_idx in range(0, 14 * 24, 2):
        t = start_time + timedelta(hours=hour_idx)
        if t > now:
            break
        day_num = (hour_idx // 24) + 1  # Day 1 to 14

        # Diurnal pattern
        hour_of_day = t.hour
        is_night = hour_of_day in [22, 0, 2, 4]

        if not is_mastitis_target:
            # ─── Healthy Control Cow ──────────────────────────────────────────
            rumination = random.uniform(38.0, 44.0) if is_night else random.uniform(14.0, 22.0)
            activity = random.uniform(20.0, 40.0) if is_night else random.uniform(110.0, 135.0)
            temp = round(random.uniform(38.4, 38.7), 2)
            lying = random.uniform(40.0, 55.0) if is_night else random.uniform(10.0, 25.0)
        else:
            # ─── Target Cow KA024: 3-Phase Progression ────────────────────────
            if day_num <= 8:
                # Phase 1: Healthy baseline
                rumination = random.uniform(38.0, 44.0) if is_night else random.uniform(14.0, 22.0)
                activity = random.uniform(20.0, 40.0) if is_night else random.uniform(110.0, 135.0)
                temp = round(random.uniform(38.4, 38.7), 2)
                lying = random.uniform(40.0, 55.0) if is_night else random.uniform(10.0, 25.0)
            elif day_num <= 11:
                # Phase 2: Early Subclinical Mastitis
                # Rumination drops ~20%, body temp elevates slightly
                rumination = random.uniform(26.0, 32.0) if is_night else random.uniform(10.0, 15.0)
                activity = random.uniform(15.0, 30.0) if is_night else random.uniform(85.0, 105.0)
                temp = round(random.uniform(38.8, 39.0), 2)
                lying = random.uniform(45.0, 58.0) if is_night else random.uniform(15.0, 30.0)
            else:
                # Phase 3: Acute Clinical Mastitis (Days 12-14)
                # Severe drop in rumination (>45%), fever (>39.4°C), severe lethargy
                rumination = random.uniform(12.0, 18.0) if is_night else random.uniform(4.0, 8.0)
                activity = random.uniform(10.0, 20.0) if is_night else random.uniform(50.0, 72.0)
                temp = round(random.uniform(39.3, 39.7), 2)
                lying = random.uniform(50.0, 60.0) if is_night else random.uniform(35.0, 48.0)

        records.append(
            WearableReading(
                cow_id=cow.id,
                recorded_at=t,
                activity_index=round(activity, 1),
                rumination_minutes=round(rumination, 1),
                body_temperature=temp,
                lying_time_minutes=round(lying, 1),
                latitude=cow.latitude,
                longitude=cow.longitude,
            )
        )

    session.add_all(records)
    session.commit()
    return len(records)


def simulate_milk_for_cow(
    session: Session,
    cow: Bovine,
    start_time: datetime,
    is_mastitis_target: bool = False,
) -> int:
    """Generate 14 days of milk tests: 2 sessions per day (06:00, 18:00) across 4 quarters (112 records per cow)."""
    records = []
    now = datetime.now(timezone.utc)
    quarters = [MilkQuarter.FL, MilkQuarter.FR, MilkQuarter.RL, MilkQuarter.RR]

    for day_idx in range(14):
        day_date = (start_time + timedelta(days=day_idx)).date()
        day_num = day_idx + 1

        for hour in [6, 18]:  # Morning and evening milking
            t = datetime(day_date.year, day_date.month, day_date.day, hour, 30, tzinfo=timezone.utc)
            if t > now:
                break

            for q in quarters:
                if not is_mastitis_target:
                    # ─── Healthy Cow ──────────────────────────────────────────
                    ec = round(random.uniform(4.4, 4.9), 2)
                    ph = round(random.uniform(6.52, 6.68), 2)
                    turb = round(random.uniform(85.0, 115.0), 1)
                    m_temp = round(random.uniform(38.2, 38.5), 1)
                    cmt = CMTResult.negative
                    scc = random.randint(70000, 130000)
                else:
                    # ─── Target Cow KA024: FL quarter infection ───────────────
                    if q == MilkQuarter.FL:
                        if day_num <= 8:
                            # Healthy
                            ec = round(random.uniform(4.5, 5.0), 2)
                            ph = round(random.uniform(6.55, 6.68), 2)
                            turb = round(random.uniform(90.0, 120.0), 1)
                            m_temp = round(random.uniform(38.2, 38.5), 1)
                            cmt = CMTResult.negative
                            scc = random.randint(80000, 140000)
                        elif day_num <= 11:
                            # Subclinical Mastitis in FL
                            ec = round(random.uniform(5.8, 6.3), 2)
                            ph = round(random.uniform(6.82, 6.95), 2)
                            turb = round(random.uniform(180.0, 260.0), 1)
                            m_temp = round(random.uniform(38.6, 38.9), 1)
                            cmt = CMTResult.one_plus if day_num == 11 else CMTResult.trace
                            scc = random.randint(320000, 480000)
                        else:
                            # Acute Clinical Mastitis in FL
                            ec = round(random.uniform(6.9, 7.6), 2)
                            ph = round(random.uniform(7.05, 7.35), 2)  # Highly alkaline
                            turb = round(random.uniform(420.0, 580.0), 1)  # Flocculent/clots
                            m_temp = round(random.uniform(39.1, 39.5), 1)  # Inflamed udder
                            cmt = CMTResult.two_plus if day_num == 12 else CMTResult.three_plus
                            scc = random.randint(850000, 1400000)
                    else:
                        # Other quarters (FR, RL, RR) stay largely normal with mild sympathetic shift
                        if day_num <= 11:
                            ec = round(random.uniform(4.5, 5.0), 2)
                            ph = round(random.uniform(6.55, 6.70), 2)
                            cmt = CMTResult.negative
                            scc = random.randint(90000, 150000)
                        else:
                            ec = round(random.uniform(5.1, 5.4), 2)
                            ph = round(random.uniform(6.68, 6.78), 2)
                            cmt = CMTResult.trace
                            scc = random.randint(180000, 250000)
                        turb = round(random.uniform(90.0, 130.0), 1)
                        m_temp = round(random.uniform(38.3, 38.6), 1)

                records.append(
                    MilkReading(
                        cow_id=cow.id,
                        quarter=q,
                        recorded_at=t,
                        electrical_conductivity=ec,
                        ph=ph,
                        turbidity=turb,
                        milk_temperature=m_temp,
                        cmt_result=cmt,
                        scc=scc,
                    )
                )

    session.add_all(records)
    session.commit()
    return len(records)


def simulate_environment(session: Session, farmer: User, start_time: datetime) -> int:
    """Generate 14 days of barn environmental data every 3 hours (112 records)."""
    records = []
    now = datetime.now(timezone.utc)

    for hour_idx in range(0, 14 * 24, 3):
        t = start_time + timedelta(hours=hour_idx)
        if t > now:
            break
        day_num = (hour_idx // 24) + 1
        hour = t.hour

        # Base diurnal temperature
        if 11 <= hour <= 16:
            base_temp = random.uniform(30.0, 34.0)
            base_humidity = random.uniform(55.0, 68.0)
        else:
            base_temp = random.uniform(22.0, 26.0)
            base_humidity = random.uniform(70.0, 85.0)

        # Days 10-14: Wet rainy weather / high bedding moisture event (environmental trigger)
        if day_num >= 10:
            moisture = round(random.uniform(58.0, 72.0), 1)
            humidity = round(min(base_humidity + 12.0, 95.0), 1)
            ammonia = round(random.uniform(18.0, 26.0), 1)
            hygiene = 3 if day_num == 10 else 4
        else:
            moisture = round(random.uniform(26.0, 36.0), 1)
            humidity = round(base_humidity, 1)
            ammonia = round(random.uniform(8.0, 14.0), 1)
            hygiene = 1 if day_num <= 5 else 2

        records.append(
            EnvironmentReading(
                farmer_id=farmer.id,
                recorded_at=t,
                ambient_temperature=round(base_temp, 1),
                humidity=humidity,
                bedding_moisture=moisture,
                ammonia_ppm=ammonia,
                hygiene_score=hygiene,
            )
        )

    session.add_all(records)
    session.commit()
    return len(records)


def main():
    parser = argparse.ArgumentParser(description="Seed realistic IoT telemetry for KAMADHENU demo.")
    parser.add_argument("--reset", action="store_true", help="Clear previous simulation readings before populating.")
    args = parser.parse_args()

    create_db_and_tables()

    with Session(engine) as session:
        farmer, ka024, healthy_cows = ensure_demo_farmer_and_cows(session)
        all_cows = [ka024] + healthy_cows
        all_cow_ids = [c.id for c in all_cows]

        if args.reset:
            clear_sensor_data(session, all_cow_ids, farmer.id)

        start_time = datetime.now(timezone.utc) - timedelta(days=14)
        print(f"\n[>>] Generating 14-day telemetry starting from: {start_time.strftime('%Y-%m-%d %H:%M UTC')}...")

        total_wearable = 0
        total_milk = 0

        # Simulate Target Cow KA024
        print(f"\n[+] Simulating Collar & Milk Telemetry for Target Cow: {ka024.name} (KA024)...")
        w_cnt = simulate_wearable_for_cow(session, ka024, start_time, is_mastitis_target=True)
        m_cnt = simulate_milk_for_cow(session, ka024, start_time, is_mastitis_target=True)
        total_wearable += w_cnt
        total_milk += m_cnt
        print(f"   -> KA024: {w_cnt} wearable points, {m_cnt} quarter milk tests.")

        # Simulate Healthy Control Cows
        for cow in healthy_cows:
            print(f"[+] Simulating Collar & Milk Telemetry for Healthy Cow: {cow.name} ({cow.pashu_aadhar})...")
            w_cnt = simulate_wearable_for_cow(session, cow, start_time, is_mastitis_target=False)
            m_cnt = simulate_milk_for_cow(session, cow, start_time, is_mastitis_target=False)
            total_wearable += w_cnt
            total_milk += m_cnt
            print(f"   -> {cow.pashu_aadhar}: {w_cnt} wearable points, {m_cnt} quarter milk tests.")

        # Simulate Barn Environment
        print(f"\n[+] Simulating Barn Environmental Telemetry for Farmer {farmer.name}...")
        env_cnt = simulate_environment(session, farmer, start_time)
        print(f"   -> Barn: {env_cnt} environmental readings.")

        print("\n" + "=" * 65)
        print("SIMULATION DATA SEEDING COMPLETE!")
        print("=" * 65)
        print(f"* Demo Farmer:            {farmer.name} | Phone: {farmer.phone} | Password: password123")
        print(f"* Target Mastitis Cow:    {ka024.name} | Pashu Aadhaar: {ka024.pashu_aadhar} | ID: {ka024.id}")
        print(f"* Healthy Control Cows:   {', '.join(c.pashu_aadhar for c in healthy_cows)}")
        print(f"* Total Wearable Readings: {total_wearable}")
        print(f"* Total Milk Quarter Tests:{total_milk}")
        print(f"* Total Barn Readings:    {env_cnt}")
        print("\nInspect the generated telemetry via API:")
        print(f"  GET /api/v1/sensors/cows/{ka024.id}/summary?days=14")
        print(f"  GET /api/v1/sensors/cows/{ka024.id}/milk?days=14")
        print(f"  GET /api/v1/sensors/farm/environment?days=7")
        print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
