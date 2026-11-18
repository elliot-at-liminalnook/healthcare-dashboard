"""Patient queries and writes. Route handlers call these; nothing here knows about HTTP."""

import enum
import uuid
from collections.abc import Sequence

from sqlalchemy import ColumnElement, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.exc import StaleDataError

from app.models import Patient, PatientStatus
from app.schemas.patient import PatientReplace, PatientWrite


class PatientChangedError(Exception):
    """The patient was changed after the copy being saved was read."""

    def __init__(self, current: Patient | None) -> None:
        super().__init__("The patient has been changed since it was loaded")
        # The record as it is now, or None if it has been deleted.
        self.current = current


class PatientSort(enum.StrEnum):
    NAME = "name"
    AGE = "age"
    LAST_VISIT = "last_visit"
    STATUS = "status"


class SortOrder(enum.StrEnum):
    ASC = "asc"
    DESC = "desc"


# Sorting by status means by urgency, not alphabetically.
_STATUS_URGENCY = case(
    {PatientStatus.CRITICAL: 0, PatientStatus.ACTIVE: 1, PatientStatus.INACTIVE: 2},
    value=Patient.status,
)


def _order_by(sort_by: PatientSort, sort_order: SortOrder) -> list[ColumnElement]:
    descending = sort_order is SortOrder.DESC
    match sort_by:
        case PatientSort.NAME:
            columns = [func.lower(Patient.last_name), func.lower(Patient.first_name)]
        case PatientSort.AGE:
            # Youngest first means latest birth date first.
            columns = [Patient.date_of_birth]
            descending = not descending
        case PatientSort.LAST_VISIT:
            columns = [Patient.last_visit]
        case PatientSort.STATUS:
            columns = [_STATUS_URGENCY]
    ordered = [column.desc() if descending else column.asc() for column in columns]
    # Patients never seen sort last either way; the id makes paging stable.
    return [clause.nulls_last() for clause in ordered] + [Patient.id]


def _matches_search(search: str) -> list[ColumnElement[bool]]:
    """Every word must appear in the first or last name, so "ann lee" finds "Annabel Lee"."""
    return [
        or_(
            Patient.first_name.icontains(word, autoescape=True),
            Patient.last_name.icontains(word, autoescape=True),
        )
        for word in search.split()
    ]


async def list_patients(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    status: PatientStatus | None = None,
    sort_by: PatientSort = PatientSort.NAME,
    sort_order: SortOrder = SortOrder.ASC,
) -> tuple[Sequence[Patient], int]:
    """Return one page of patients and the total number that match the filters."""
    filters: list[ColumnElement[bool]] = []
    if search:
        filters.extend(_matches_search(search))
    if status:
        filters.append(Patient.status == status)

    total = await session.scalar(select(func.count()).select_from(Patient).where(*filters))
    patients = await session.scalars(
        select(Patient)
        .where(*filters)
        .order_by(*_order_by(sort_by, sort_order))
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    return patients.all(), total or 0


async def get_patient(session: AsyncSession, patient_id: uuid.UUID) -> Patient | None:
    return await session.get(Patient, patient_id)


async def create_patient(session: AsyncSession, data: PatientWrite) -> Patient:
    patient = Patient(**data.model_dump())
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


async def replace_patient(session: AsyncSession, patient: Patient, data: PatientReplace) -> Patient:
    """Replace a patient's fields, unless the record has moved on from `data.version`."""
    if data.version != patient.version:
        raise PatientChangedError(patient)
    for field, value in data.model_dump(exclude={"version"}).items():
        setattr(patient, field, value)
    try:
        await session.commit()
    except StaleDataError:
        # Another save landed between reading the patient and writing it.
        await session.rollback()
        current = await session.get(Patient, patient.id, populate_existing=True)
        raise PatientChangedError(current) from None
    await session.refresh(patient)
    return patient


async def delete_patient(session: AsyncSession, patient: Patient) -> None:
    """Delete a patient. Their notes go with them (ON DELETE CASCADE)."""
    await session.delete(patient)
    await session.commit()
