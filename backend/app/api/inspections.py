"""Farm & Barn Inspection API endpoints."""

import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select

from app.core.deps import CurrentUser, SessionDep, require_role
from app.models.alert import AlertSeverity, AlertType
from app.models.cow import Bovine
from app.models.inspection import (
    FarmInspection,
    FarmInspectionCreate,
    FarmInspectionRead,
    InspectionStatus,
)
from app.models.user import User, UserRole
from app.services.notification_service import create_alert

router = APIRouter(prefix="/inspections", tags=["Inspections"])

InspectorOrAuthority = Annotated[
    User,
    Depends(require_role(UserRole.inspector, UserRole.authority)),
]


def _build_read_model(inspection: FarmInspection, session: SessionDep) -> FarmInspectionRead:
    farmer = session.get(User, inspection.farmer_id)
    inspector = session.get(User, inspection.inspector_id)

    return FarmInspectionRead(
        id=inspection.id,
        farmer_id=inspection.farmer_id,
        farmer_name=farmer.name if farmer else "Farmer",
        farmer_place=farmer.place if farmer else None,
        farmer_phone=farmer.phone if farmer else None,
        inspector_id=inspection.inspector_id,
        inspector_name=inspector.name if inspector else "Inspector",
        complaint_id=inspection.complaint_id,
        inspected_at=inspection.inspected_at,
        status=inspection.status,
        overall_score=inspection.overall_score,
        biosecurity_score=inspection.biosecurity_score,
        ventilation_score=inspection.ventilation_score,
        bedding_hygiene_score=inspection.bedding_hygiene_score,
        water_feed_score=inspection.water_feed_score,
        milking_hygiene_score=inspection.milking_hygiene_score,
        animal_welfare_score=inspection.animal_welfare_score,
        ammonia_ppm_observed=inspection.ammonia_ppm_observed,
        bedding_moisture_observed=inspection.bedding_moisture_observed,
        summary=inspection.summary,
        deficiencies=inspection.deficiencies,
        recommendations=inspection.recommendations,
        follow_up_required=inspection.follow_up_required,
        follow_up_date=inspection.follow_up_date,
        created_at=inspection.created_at,
    )


@router.post(
    "/",
    response_model=FarmInspectionRead,
    status_code=201,
    summary="[Inspector/Authority] Submit a farm & barn inspection report",
)
def create_inspection(
    payload: FarmInspectionCreate,
    current_user: InspectorOrAuthority,
    session: SessionDep,
) -> FarmInspectionRead:
    farmer = session.get(User, payload.farmer_id)
    if not farmer or str(farmer.role) != UserRole.farmer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer account not found",
        )

    inspection = FarmInspection(
        farmer_id=payload.farmer_id,
        inspector_id=current_user.id,
        complaint_id=payload.complaint_id,
        status=payload.status,
        overall_score=payload.overall_score,
        biosecurity_score=payload.biosecurity_score,
        ventilation_score=payload.ventilation_score,
        bedding_hygiene_score=payload.bedding_hygiene_score,
        water_feed_score=payload.water_feed_score,
        milking_hygiene_score=payload.milking_hygiene_score,
        animal_welfare_score=payload.animal_welfare_score,
        ammonia_ppm_observed=payload.ammonia_ppm_observed,
        bedding_moisture_observed=payload.bedding_moisture_observed,
        summary=payload.summary,
        deficiencies=payload.deficiencies,
        recommendations=payload.recommendations,
        follow_up_required=payload.follow_up_required,
        follow_up_date=payload.follow_up_date,
    )
    session.add(inspection)
    session.commit()
    session.refresh(inspection)

    # Deliver alert notification directly to the farmer
    grade_str = (
        "Grade A (Compliant)"
        if payload.status == InspectionStatus.passed
        else "Grade B (Conditional)"
        if payload.status == InspectionStatus.conditional_pass
        else "Grade C (Non-Compliant)"
    )
    sev = (
        AlertSeverity.critical
        if payload.status == InspectionStatus.failed
        else AlertSeverity.warning
        if payload.status == InspectionStatus.conditional_pass
        else AlertSeverity.info
    )

    try:
        create_alert(
            session=session,
            user_id=farmer.id,
            title=f"📋 Barn Inspection Filed: {grade_str}",
            message=(
                f"Field Inspector {current_user.name} completed a farm hygiene inspection. "
                f"Overall Score: {payload.overall_score}/100. Tap to review findings and recommendations."
            ),
            alert_type=AlertType.farm_inspection,
            severity=sev,
            data={
                "inspection_id": str(inspection.id),
                "status": payload.status.value,
                "overall_score": payload.overall_score,
                "inspector_name": current_user.name,
            },
        )
    except Exception:
        pass

    return _build_read_model(inspection, session)


@router.get(
    "/",
    response_model=List[FarmInspectionRead],
    summary="List farm inspections (role-filtered)",
)
def list_inspections(
    current_user: CurrentUser,
    session: SessionDep,
    farmer_id: Optional[uuid.UUID] = Query(default=None),
    status_filter: Optional[InspectionStatus] = Query(default=None, alias="status"),
) -> List[FarmInspectionRead]:
    stmt = select(FarmInspection)

    if str(current_user.role) == UserRole.farmer:
        stmt = stmt.where(FarmInspection.farmer_id == current_user.id)
    elif str(current_user.role) == UserRole.inspector:
        if farmer_id:
            stmt = stmt.where(FarmInspection.farmer_id == farmer_id)
        else:
            stmt = stmt.where(FarmInspection.inspector_id == current_user.id)
    elif str(current_user.role) == UserRole.authority:
        if farmer_id:
            stmt = stmt.where(FarmInspection.farmer_id == farmer_id)

    if status_filter:
        stmt = stmt.where(FarmInspection.status == status_filter)

    inspections = session.exec(stmt.order_by(FarmInspection.inspected_at.desc())).all()
    return [_build_read_model(insp, session) for insp in inspections]


@router.get(
    "/farmers",
    summary="[Inspector/Authority] List farmers eligible for inspection",
)
def list_farmers_for_inspection(
    current_user: InspectorOrAuthority,
    session: SessionDep,
) -> List[dict]:
    farmers = session.exec(
        select(User).where(User.role == UserRole.farmer, User.is_active == True)
    ).all()

    results = []
    for f in farmers:
        cow_count = len(session.exec(select(Bovine.id).where(Bovine.farmer_id == f.id)).all())
        results.append({
            "id": str(f.id),
            "name": f.name,
            "phone": f.phone,
            "place": f.place or "Mandya",
            "number_of_animals": f.number_of_animals or cow_count,
        })
    return results


@router.get(
    "/{inspection_id}",
    response_model=FarmInspectionRead,
    summary="Get single inspection report detail",
)
def get_inspection_detail(
    inspection_id: uuid.UUID,
    current_user: CurrentUser,
    session: SessionDep,
) -> FarmInspectionRead:
    inspection = session.get(FarmInspection, inspection_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection report not found")

    # Access control: Farmer can only view their own
    if str(current_user.role) == UserRole.farmer and inspection.farmer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return _build_read_model(inspection, session)
