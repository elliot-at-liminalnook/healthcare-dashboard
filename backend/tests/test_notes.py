import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from httpx2 import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models import BloodType, Patient, PatientNote, PatientStatus
from app.services.summary import TemplateSummarizer, get_summarizer

pytestmark = pytest.mark.anyio


def at(day: int, hour: int = 18) -> datetime:
    """A moment in March 2026 (18:00 UTC is 11:00 in the practice's time zone)."""
    return datetime(2026, 3, day, hour, tzinfo=UTC)


async def add_patient(session: AsyncSession, *notes: PatientNote, **overrides: object) -> Patient:
    fields = {
        "first_name": "Ada",
        "last_name": "Lovelace",
        "date_of_birth": date(1980, 5, 17),
        "status": PatientStatus.ACTIVE,
    } | overrides
    patient = Patient(**fields, notes=list(notes))
    session.add(patient)
    await session.commit()
    return patient


# --- Notes ------------------------------------------------------------------


async def test_notes_are_listed_newest_first(client: AsyncClient, session: AsyncSession) -> None:
    patient = await add_patient(
        session,
        PatientNote(timestamp=at(2), content="Second"),
        PatientNote(timestamp=at(9), content="Third"),
        PatientNote(timestamp=at(1), content="First"),
    )

    response = await client.get(f"/patients/{patient.id}/notes")

    assert response.status_code == 200
    assert [note["content"] for note in response.json()] == ["Third", "Second", "First"]


async def test_a_patient_only_sees_their_own_notes(
    client: AsyncClient, session: AsyncSession
) -> None:
    await add_patient(session, PatientNote(timestamp=at(1), content="Someone else's"))
    patient = await add_patient(session, last_name="Hopper")

    assert (await client.get(f"/patients/{patient.id}/notes")).json() == []


async def test_create_note(client: AsyncClient, session: AsyncSession) -> None:
    patient = await add_patient(session)
    body = {"timestamp": "2026-03-05T09:30:00-08:00", "content": "  BP 128/82. Feeling well.  "}

    response = await client.post(f"/patients/{patient.id}/notes", json=body)

    assert response.status_code == 201
    created = response.json()
    assert created["patient_id"] == str(patient.id)
    assert created["content"] == "BP 128/82. Feeling well."
    assert datetime.fromisoformat(created["timestamp"]) == datetime(2026, 3, 5, 17, 30, tzinfo=UTC)
    assert (await client.get(f"/patients/{patient.id}/notes")).json() == [created]


@pytest.mark.parametrize(
    ("body", "field", "message"),
    [
        (
            {"timestamp": "2026-03-05T09:30:00Z", "content": "   "},
            "content",
            "at least 1 character",
        ),
        ({"timestamp": "2026-03-05T09:30:00Z"}, "content", "Field required"),
        ({"content": "Text"}, "timestamp", "Field required"),
        ({"timestamp": "2026-03-05T09:30:00", "content": "Text"}, "timestamp", "timezone"),
        ({"timestamp": "2999-01-01T00:00:00Z", "content": "Text"}, "timestamp", "in the future"),
        ({"timestamp": "2026-03-05T09:30:00Z", "content": "x" * 5001}, "content", "at most 5000"),
    ],
)
async def test_create_note_reports_problems_against_their_field(
    client: AsyncClient, session: AsyncSession, body: dict, field: str, message: str
) -> None:
    patient = await add_patient(session)

    response = await client.post(f"/patients/{patient.id}/notes", json=body)

    assert response.status_code == 422
    [error] = response.json()["detail"]
    assert error["loc"] == ["body", field]
    assert message in error["msg"]


async def test_a_note_may_be_stamped_slightly_ahead_of_the_server_clock(
    client: AsyncClient, session: AsyncSession
) -> None:
    patient = await add_patient(session)
    soon = (datetime.now(UTC) + timedelta(minutes=2)).isoformat()

    response = await client.post(
        f"/patients/{patient.id}/notes", json={"timestamp": soon, "content": "Text"}
    )

    assert response.status_code == 201


async def test_delete_note(client: AsyncClient, session: AsyncSession) -> None:
    keep = PatientNote(timestamp=at(1), content="Keep")
    remove = PatientNote(timestamp=at(2), content="Remove")
    patient = await add_patient(session, keep, remove)

    response = await client.delete(f"/patients/{patient.id}/notes/{remove.id}")

    assert response.status_code == 204
    remaining = (await client.get(f"/patients/{patient.id}/notes")).json()
    assert [note["content"] for note in remaining] == ["Keep"]
    assert (await client.delete(f"/patients/{patient.id}/notes/{remove.id}")).status_code == 404


async def test_a_note_cannot_be_deleted_through_another_patient(
    client: AsyncClient, session: AsyncSession
) -> None:
    note = PatientNote(timestamp=at(1), content="Private")
    owner = await add_patient(session, note)
    other = await add_patient(session, last_name="Hopper")

    response = await client.delete(f"/patients/{other.id}/notes/{note.id}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Note not found"}
    assert len((await client.get(f"/patients/{owner.id}/notes")).json()) == 1


@pytest.mark.parametrize("path", ["notes", "summary"])
async def test_unknown_patient_is_404(client: AsyncClient, path: str) -> None:
    response = await client.get(f"/patients/{uuid.uuid4()}/{path}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Patient not found"}


# --- Summary ----------------------------------------------------------------


async def test_summary_includes_identifiers_clinical_information_and_a_narrative(
    client: AsyncClient, session: AsyncSession
) -> None:
    patient = await add_patient(
        session,
        PatientNote(timestamp=at(9), content="Reports dizziness on standing. Dose reduced."),
        PatientNote(timestamp=at(2), content="BP 150/95. Started lisinopril 10 mg daily."),
        blood_type=BloodType.O_NEGATIVE,
        conditions=["Hypertension", "Asthma"],
        allergies=["Penicillin"],
    )

    response = await client.get(f"/patients/{patient.id}/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Ada Lovelace"
    assert body["blood_type"] == "O-"
    assert body["conditions"] == ["Hypertension", "Asthma"]
    assert body["allergies"] == ["Penicillin"]
    assert body["note_count"] == 2
    assert body["generated_by"] == "template"

    identity, clinical, narrative = body["summary"].split("\n\n")
    assert identity.startswith(f"Ada Lovelace is {body['age']} years old (born May 17, 1980)")
    assert "blood type O-" in identity
    assert clinical == "Recorded conditions: Hypertension and Asthma. Allergies: Penicillin."
    # The narrative runs in time order, whatever order the notes were entered in.
    assert narrative == (
        "There are 2 clinical notes, from March 2, 2026 to March 9, 2026. "
        "The record opens on March 2, 2026: BP 150/95. Started lisinopril 10 mg daily. "
        "Most recently, on March 9, 2026: Reports dizziness on standing. Dose reduced."
    )


async def test_summary_of_a_patient_with_nothing_on_file(
    client: AsyncClient, session: AsyncSession
) -> None:
    patient = await add_patient(session)

    body = (await client.get(f"/patients/{patient.id}/summary")).json()

    _, clinical, narrative = body["summary"].split("\n\n")
    assert "no blood type on file" in body["summary"]
    assert clinical == "No ongoing conditions are recorded. No allergies are recorded."
    assert narrative == "No clinical notes have been recorded yet."


async def test_summary_quotes_recent_notes_and_counts_the_ones_between(
    client: AsyncClient, session: AsyncSession
) -> None:
    notes = [PatientNote(timestamp=at(day), content=f"Visit {day}.") for day in range(1, 8)]
    patient = await add_patient(session, *notes)

    narrative = (
        (await client.get(f"/patients/{patient.id}/summary")).json()["summary"].split("\n\n")[2]
    )

    assert narrative == (
        "There are 7 clinical notes, from March 1, 2026 to March 7, 2026. "
        "The record opens on March 1, 2026: Visit 1. "
        "3 further notes follow, through March 4, 2026. "
        "On March 5, 2026: Visit 5. On March 6, 2026: Visit 6. "
        "Most recently, on March 7, 2026: Visit 7."
    )


async def test_summary_dates_use_the_practice_time_zone(
    client: AsyncClient, session: AsyncSession
) -> None:
    # 02:00 UTC on March 5 is still the evening of March 4 in Los Angeles.
    patient = await add_patient(session, PatientNote(timestamp=at(5, hour=2), content="Late."))

    body = (await client.get(f"/patients/{patient.id}/summary")).json()

    assert body["summary"].endswith("There is one clinical note, from March 4, 2026: Late.")


async def test_long_notes_are_cut_at_a_sentence_boundary() -> None:
    summarizer = TemplateSummarizer("America/Los_Angeles")
    patient = Patient(
        first_name="Ada",
        last_name="Lovelace",
        date_of_birth=date(1980, 5, 17),
        status=PatientStatus.ACTIVE,
        conditions=[],
        allergies=[],
    )
    long_note = PatientNote(timestamp=at(1), content="First sentence here. " + "More detail. " * 40)

    narrative = summarizer.summarize(patient, [long_note]).split("\n\n")[2]

    assert narrative.startswith("There is one clinical note, from March 1, 2026: First sentence")
    assert narrative.endswith("More detail.")
    assert len(narrative) < 330


async def test_the_summarizer_can_be_swapped(client: AsyncClient, session: AsyncSession) -> None:
    class Shouting:
        name = "template"

        def summarize(self, patient: Patient, notes: object) -> str:
            return f"{patient.last_name.upper()}!"

    patient = await add_patient(session)
    app.dependency_overrides[get_summarizer] = Shouting
    try:
        body = (await client.get(f"/patients/{patient.id}/summary")).json()
    finally:
        del app.dependency_overrides[get_summarizer]

    assert body["summary"] == "LOVELACE!"
