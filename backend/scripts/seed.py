"""Load the sample patients into the database, if it has no patients yet.

Runs on every container start; it does nothing once any patient exists, so
changes made through the app are never overwritten.

Usage (from `backend/`): python -m scripts.seed
"""

import asyncio
import json
import uuid
from datetime import date, datetime
from pathlib import Path

import structlog
from sqlalchemy import delete, func, select

from app.core.config import get_settings
from app.core.db import SessionLocal, engine
from app.core.logging import configure_logging
from app.models import BloodType, Patient, PatientNote, PatientStatus

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "patients.json"

logger = structlog.get_logger(__name__)


def patient_from_fixture(item: dict) -> Patient:
    """Build a Patient (with its notes) from one fixture entry."""
    fields = dict(item)
    notes = fields.pop("notes")
    last_visit = fields.pop("last_visit")
    blood_type = fields.pop("blood_type")
    return Patient(
        **fields
        | {
            "id": uuid.UUID(fields["id"]),
            "date_of_birth": date.fromisoformat(fields["date_of_birth"]),
            "last_visit": date.fromisoformat(last_visit) if last_visit else None,
            "blood_type": BloodType(blood_type) if blood_type else None,
            "status": PatientStatus(fields["status"]),
        },
        notes=[
            PatientNote(
                id=uuid.UUID(note["id"]),
                timestamp=datetime.fromisoformat(note["timestamp"]),
                content=note["content"],
            )
            for note in notes
        ],
    )


def load_fixture() -> list[Patient]:
    return [patient_from_fixture(item) for item in json.loads(FIXTURE.read_text())["patients"]]


async def seed(*, reset: bool = False) -> None:
    """Load the sample patients into an empty database.

    With `reset`, existing patients (and their notes) are removed first, which
    returns a public demo to its starting state.
    """
    async with SessionLocal() as session:
        if reset:
            await session.execute(delete(Patient))
        existing = await session.scalar(select(func.count()).select_from(Patient))
        if existing:
            logger.info("seed_skipped", reason="patients already exist", patients=existing)
            return

        patients = load_fixture()
        session.add_all(patients)
        await session.commit()
        logger.info(
            "seed_completed",
            patients=len(patients),
            notes=sum(len(patient.notes) for patient in patients),
        )
    await engine.dispose()


if __name__ == "__main__":
    configure_logging(get_settings().log_level)
    asyncio.run(seed())
