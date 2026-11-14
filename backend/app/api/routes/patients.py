import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.db import SessionDep
from app.models import Patient, PatientStatus
from app.schemas.patient import Page, PatientListItem, PatientRead, PatientWrite
from app.services import patients as patient_service
from app.services.patients import PatientSort, SortOrder

router = APIRouter(prefix="/patients", tags=["patients"])

NOT_FOUND = {status.HTTP_404_NOT_FOUND: {"description": "Patient not found"}}


async def patient_or_404(patient_id: uuid.UUID, session: SessionDep) -> Patient:
    patient = await patient_service.get_patient(session, patient_id)
    if patient is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    return patient


PatientDep = Annotated[Patient, Depends(patient_or_404)]


@router.get("")
async def list_patients(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[
        str | None, Query(max_length=100, description="Words to find in the patient's name")
    ] = None,
    status: Annotated[PatientStatus | None, Query()] = None,
    sort_by: PatientSort = PatientSort.NAME,
    sort_order: SortOrder = SortOrder.ASC,
) -> Page[PatientListItem]:
    patients, total = await patient_service.list_patients(
        session,
        page=page,
        page_size=page_size,
        search=search,
        status=status,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return Page(
        items=[PatientListItem.model_validate(patient) for patient in patients],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=PatientRead)
async def create_patient(data: PatientWrite, session: SessionDep) -> Patient:
    return await patient_service.create_patient(session, data)


@router.get("/{patient_id}", responses=NOT_FOUND, response_model=PatientRead)
async def get_patient(patient: PatientDep) -> Patient:
    return patient


@router.put("/{patient_id}", responses=NOT_FOUND, response_model=PatientRead)
async def replace_patient(patient: PatientDep, data: PatientWrite, session: SessionDep) -> Patient:
    return await patient_service.replace_patient(session, patient, data)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
async def delete_patient(patient: PatientDep, session: SessionDep) -> None:
    await patient_service.delete_patient(session, patient)
