import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.routes.patients import NOT_FOUND, PatientDep
from app.core.db import SessionDep
from app.models import PatientNote
from app.schemas.note import NoteCreate, NoteRead, PatientSummary
from app.schemas.patient import age_on
from app.services import notes as note_service
from app.services.summary import Summarizer, get_summarizer

router = APIRouter(prefix="/patients/{patient_id}", tags=["notes"])


@router.get("/notes", responses=NOT_FOUND, response_model=list[NoteRead])
async def list_notes(patient: PatientDep, session: SessionDep) -> list[PatientNote]:
    return list(await note_service.list_notes(session, patient))


@router.post(
    "/notes", status_code=status.HTTP_201_CREATED, responses=NOT_FOUND, response_model=NoteRead
)
async def create_note(patient: PatientDep, data: NoteCreate, session: SessionDep) -> PatientNote:
    return await note_service.create_note(session, patient, data)


@router.delete(
    "/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={status.HTTP_404_NOT_FOUND: {"description": "Patient or note not found"}},
)
async def delete_note(patient: PatientDep, note_id: uuid.UUID, session: SessionDep) -> None:
    note = await note_service.get_note(session, patient, note_id)
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    await note_service.delete_note(session, note)


@router.get("/summary", responses=NOT_FOUND)
async def get_patient_summary(
    patient: PatientDep,
    session: SessionDep,
    summarizer: Annotated[Summarizer, Depends(get_summarizer)],
) -> PatientSummary:
    notes = await note_service.list_notes(session, patient)
    return PatientSummary(
        patient_id=patient.id,
        name=f"{patient.first_name} {patient.last_name}",
        age=age_on(patient.date_of_birth, date.today()),
        blood_type=patient.blood_type,
        conditions=patient.conditions,
        allergies=patient.allergies,
        note_count=len(notes),
        summary=summarizer.summarize(patient, notes),
        generated_by=summarizer.name,
        generated_at=datetime.now(UTC),
    )
