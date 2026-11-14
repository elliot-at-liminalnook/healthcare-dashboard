"""Queries and writes for patient notes."""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Patient, PatientNote
from app.schemas.note import NoteCreate


async def list_notes(session: AsyncSession, patient: Patient) -> Sequence[PatientNote]:
    """All of a patient's notes, newest first."""
    notes = await session.scalars(
        select(PatientNote)
        .where(PatientNote.patient_id == patient.id)
        .order_by(PatientNote.timestamp.desc(), PatientNote.id)
    )
    return notes.all()


async def get_note(
    session: AsyncSession, patient: Patient, note_id: uuid.UUID
) -> PatientNote | None:
    """A note, but only if it belongs to this patient."""
    return await session.scalar(
        select(PatientNote).where(PatientNote.id == note_id, PatientNote.patient_id == patient.id)
    )


async def create_note(session: AsyncSession, patient: Patient, data: NoteCreate) -> PatientNote:
    note = PatientNote(patient_id=patient.id, **data.model_dump())
    session.add(note)
    await session.commit()
    await session.refresh(note)
    return note


async def delete_note(session: AsyncSession, note: PatientNote) -> None:
    await session.delete(note)
    await session.commit()
