"""Request and response shapes for patient notes and the patient summary."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, StringConstraints
from pydantic_core import PydanticCustomError

from app.models import BloodType

MAX_NOTE_LENGTH = 5000
# Tolerance for clocks that run slightly ahead of the server's.
CLOCK_SKEW = timedelta(minutes=5)


def _not_in_future(value: datetime) -> datetime:
    if value > datetime.now(UTC) + CLOCK_SKEW:
        raise PydanticCustomError("datetime_in_future", "Cannot be in the future")
    return value


class NoteCreate(BaseModel):
    # When the note was taken. A UTC offset is required, so the instant is unambiguous.
    timestamp: Annotated[AwareDatetime, AfterValidator(_not_in_future)]
    content: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_NOTE_LENGTH)
    ]


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    timestamp: datetime
    content: str
    created_at: datetime


class PatientSummary(BaseModel):
    """A readable summary of a patient, with the facts it was built from."""

    patient_id: uuid.UUID
    name: str
    age: int
    blood_type: BloodType | None
    conditions: list[str]
    allergies: list[str]
    note_count: int
    # Paragraphs separated by blank lines: who the patient is, their key
    # clinical information, and a narrative of their notes.
    summary: str
    # Which summariser wrote the text; "template" uses no external service.
    generated_by: Literal["template"]
    generated_at: datetime
