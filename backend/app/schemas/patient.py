"""Request and response shapes for the patient API."""

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    StringConstraints,
    ValidationInfo,
    computed_field,
    field_validator,
)
from pydantic_core import PydanticCustomError

from app.models import BloodType, PatientStatus

OLDEST_PLAUSIBLE_AGE = 130


def age_on(date_of_birth: date, today: date) -> int:
    """Whole years between a birth date and `today`."""
    had_birthday = (today.month, today.day) >= (date_of_birth.month, date_of_birth.day)
    return today.year - date_of_birth.year - (0 if had_birthday else 1)


def _blank_to_none(value: object) -> object:
    """Forms submit untouched optional fields as empty strings; treat those as absent."""
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _text(max_length: int) -> type[str]:
    return Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)
    ]


def _optional[T](field_type: T) -> T | None:
    """An optional field where a blank string counts as absent."""
    return Annotated[field_type | None, BeforeValidator(_blank_to_none)]


# Validation rules are declared once as reusable types. Each failure carries a
# stable `type` code and a plain-language message, reported against its field.
def _not_in_future(value: date) -> date:
    if value > date.today():
        raise PydanticCustomError("date_in_future", "Cannot be in the future")
    return value


def _plausible_birth_date(value: date) -> date:
    if age_on(value, date.today()) > OLDEST_PLAUSIBLE_AGE:
        raise PydanticCustomError(
            "birth_date_too_old",
            "Cannot be more than {max_age} years ago",
            {"max_age": OLDEST_PLAUSIBLE_AGE},
        )
    return value


PastDate = Annotated[date, AfterValidator(_not_in_future)]
BirthDate = Annotated[PastDate, AfterValidator(_plausible_birth_date)]


class PatientWrite(BaseModel):
    """Body for creating a patient, or replacing one (PUT)."""

    first_name: _text(100)
    last_name: _text(100)
    date_of_birth: BirthDate
    email: _optional(EmailStr) = None
    phone: _optional(_text(32)) = None
    address_line1: _optional(_text(200)) = None
    address_line2: _optional(_text(200)) = None
    city: _optional(_text(100)) = None
    state: _optional(_text(100)) = None
    postal_code: _optional(_text(20)) = None

    blood_type: _optional(BloodType) = None
    allergies: list[_text(100)] = []
    conditions: list[_text(100)] = []
    status: PatientStatus = PatientStatus.ACTIVE
    last_visit: PastDate | None = None

    @field_validator("last_visit")
    @classmethod
    def last_visit_not_before_birth(cls, value: date | None, info: ValidationInfo) -> date | None:
        born = info.data.get("date_of_birth")  # absent if it failed its own validation
        if value is not None and born is not None and value < born:
            raise PydanticCustomError("visit_before_birth", "Cannot be before the date of birth")
        return value


class PatientListItem(BaseModel):
    """The fields the patient list shows. Contact and medical details are left out."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    date_of_birth: date
    status: PatientStatus
    last_visit: date | None

    @computed_field
    @property
    def age(self) -> int:
        return age_on(self.date_of_birth, date.today())


class PatientRead(PatientListItem):
    """A full patient record."""

    email: str | None
    phone: str | None
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    blood_type: BloodType | None
    allergies: list[str]
    conditions: list[str]
    created_at: datetime
    updated_at: datetime


class Page[T](BaseModel):
    """One page of results, with the total across all pages."""

    items: list[T]
    total: int
    page: int
    page_size: int
