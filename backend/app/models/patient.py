import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PatientStatus(enum.StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    CRITICAL = "critical"


class BloodType(enum.StrEnum):
    A_POSITIVE = "A+"
    A_NEGATIVE = "A-"
    B_POSITIVE = "B+"
    B_NEGATIVE = "B-"
    AB_POSITIVE = "AB+"
    AB_NEGATIVE = "AB-"
    O_POSITIVE = "O+"
    O_NEGATIVE = "O-"


def _enum_column(enum_class: type[enum.StrEnum], name: str) -> Enum:
    """Store an enum as text with a CHECK constraint, using the enum's values.
    Unlike a native Postgres enum, adding a value later is an ordinary migration."""
    return Enum(
        enum_class,
        name=name,
        native_enum=False,
        create_constraint=True,
        values_callable=lambda members: [member.value for member in members],
    )


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)

    # Personal information
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100), index=True)
    preferred_name: Mapped[str | None] = mapped_column(String(100))
    # Age is derived from this, never stored.
    date_of_birth: Mapped[date] = mapped_column(Date)
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(32))
    address_line1: Mapped[str | None] = mapped_column(String(200))
    address_line2: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    postal_code: Mapped[str | None] = mapped_column(String(20))

    # Medical information
    blood_type: Mapped[BloodType | None] = mapped_column(_enum_column(BloodType, "blood_type"))
    allergies: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list, server_default="{}")
    conditions: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list, server_default="{}")
    status: Mapped[PatientStatus] = mapped_column(
        _enum_column(PatientStatus, "patient_status"),
        default=PatientStatus.ACTIVE,
        server_default=PatientStatus.ACTIVE.value,
        index=True,
    )
    last_visit: Mapped[date | None] = mapped_column(Date)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    notes: Mapped[list[PatientNote]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="PatientNote.timestamp.desc()",
    )


class PatientNote(Base):
    __tablename__ = "patient_notes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    # When the note was taken, as supplied by the author (not when the row was inserted).
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    patient: Mapped[Patient] = relationship(back_populates="notes")
