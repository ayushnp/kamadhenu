import argparse
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, or_, select
from app.core.security import hash_password
from app.database import create_db_and_tables, engine
from app.models.user import User, UserRole


def create_authority(name, phone, password, email=None, employee_id=None, department=None, jurisdiction=None):
    create_db_and_tables()
    with Session(engine) as session:
        conditions = [User.phone == phone]
        if email:
            conditions.append(User.email == email)
        if employee_id:
            conditions.append(User.employee_id == employee_id)

        existing = session.exec(select(User).where(or_(*conditions))).first()
        if existing:
            print(f"\n❌ User already exists: {existing.name} ({existing.role})")
            sys.exit(1)

        user = User(
            name=name, phone=phone, email=email,
            hashed_password=hash_password(password),
            role=UserRole.authority,
            employee_id=employee_id,
            department=department or "State Animal Husbandry Department",
            jurisdiction=jurisdiction or "State HQ",
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        print(f"\n✅ Authority created! Login with phone: {user.phone}\n")


name = input("Name: ").strip()
phone = input("Phone: ").strip()
password = input("Password: ").strip()
email = input("Email (optional, Enter to skip): ").strip() or None
employee_id = input("Employee ID (optional, Enter to skip): ").strip() or None

create_authority(name, phone, password, email, employee_id)
