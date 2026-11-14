import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from httpx2 import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Patient, PatientNote, PatientStatus
from app.schemas.patient import age_on

pytestmark = pytest.mark.anyio


def make_patient(**overrides: object) -> Patient:
    fields = {
        "first_name": "Ada",
        "last_name": "Lovelace",
        "date_of_birth": date(1980, 5, 17),
        "status": PatientStatus.ACTIVE,
    } | overrides
    return Patient(**fields)


async def add(session: AsyncSession, *patients: Patient) -> None:
    session.add_all(patients)
    await session.commit()


VALID_BODY = {
    "first_name": "  Grace ",
    "last_name": "Hopper",
    "date_of_birth": "1975-12-09",
    "email": "grace.hopper@example.com",
    "phone": "(206) 555-0100",
    "blood_type": "O-",
    "allergies": ["Penicillin"],
    "conditions": ["Asthma"],
    "status": "active",
}


# --- List -------------------------------------------------------------------


async def test_list_is_paginated_and_reports_the_total(
    client: AsyncClient, session: AsyncSession
) -> None:
    await add(session, *(make_patient(last_name=f"Patient{n:02d}") for n in range(25)))

    first = (await client.get("/patients", params={"page_size": 10})).json()
    last = (await client.get("/patients", params={"page_size": 10, "page": 3})).json()

    assert (first["total"], first["page"], first["page_size"]) == (25, 1, 10)
    assert [item["last_name"] for item in first["items"]] == [f"Patient{n:02d}" for n in range(10)]
    assert [item["last_name"] for item in last["items"]] == [
        f"Patient{n:02d}" for n in (20, 21, 22, 23, 24)
    ]


async def test_list_items_carry_only_the_list_fields(
    client: AsyncClient, session: AsyncSession
) -> None:
    born = date(1990, 6, 15)
    await add(session, make_patient(date_of_birth=born, email="ada@example.com"))

    [item] = (await client.get("/patients")).json()["items"]

    assert item["age"] == age_on(born, date.today())
    assert set(item) == {
        "id", "first_name", "last_name", "date_of_birth", "age", "status", "last_visit"
    }  # fmt: skip


async def test_search_matches_every_word_against_either_name(
    client: AsyncClient, session: AsyncSession
) -> None:
    await add(
        session,
        make_patient(first_name="Annabel", last_name="Lee"),
        make_patient(first_name="Ann", last_name="Smith"),
        make_patient(first_name="Bruce", last_name="Lee"),
    )

    async def names(search: str) -> list[str]:
        response = await client.get("/patients", params={"search": search})
        return [f"{item['first_name']} {item['last_name']}" for item in response.json()["items"]]

    assert await names("ann") == ["Annabel Lee", "Ann Smith"]
    assert await names("LEE ann") == ["Annabel Lee"]
    assert await names("zzz") == []
    assert await names("%") == []  # wildcards are matched literally


async def test_filter_by_status(client: AsyncClient, session: AsyncSession) -> None:
    await add(
        session,
        make_patient(last_name="A", status=PatientStatus.CRITICAL),
        make_patient(last_name="B", status=PatientStatus.INACTIVE),
    )

    body = (await client.get("/patients", params={"status": "critical"})).json()

    assert body["total"] == 1
    assert body["items"][0]["last_name"] == "A"


async def test_sorting(client: AsyncClient, session: AsyncSession) -> None:
    await add(
        session,
        make_patient(
            last_name="Old", date_of_birth=date(1940, 1, 1), last_visit=date(2024, 1, 1),
            status=PatientStatus.INACTIVE,
        ),
        make_patient(
            last_name="Young", date_of_birth=date(2015, 1, 1), last_visit=date(2025, 6, 1),
            status=PatientStatus.CRITICAL,
        ),
        make_patient(last_name="Unseen", date_of_birth=date(1985, 1, 1), last_visit=None),
    )  # fmt: skip

    async def order(sort_by: str, sort_order: str = "asc") -> list[str]:
        params = {"sort_by": sort_by, "sort_order": sort_order}
        response = await client.get("/patients", params=params)
        return [item["last_name"] for item in response.json()["items"]]

    assert await order("name") == ["Old", "Unseen", "Young"]
    assert await order("name", "desc") == ["Young", "Unseen", "Old"]
    assert await order("age") == ["Young", "Unseen", "Old"]
    assert await order("age", "desc") == ["Old", "Unseen", "Young"]
    # Patients never seen come last in both directions.
    assert await order("last_visit") == ["Old", "Young", "Unseen"]
    assert await order("last_visit", "desc") == ["Young", "Old", "Unseen"]
    # Status sorts by urgency: critical, active, inactive.
    assert await order("status") == ["Young", "Unseen", "Old"]


@pytest.mark.parametrize(
    "params",
    [{"page": 0}, {"page_size": 0}, {"page_size": 101}, {"sort_by": "ssn"}, {"status": "unknown"}],
)
async def test_list_rejects_invalid_parameters(client: AsyncClient, params: dict) -> None:
    assert (await client.get("/patients", params=params)).status_code == 422


# --- Read -------------------------------------------------------------------


async def test_get_returns_the_full_record(client: AsyncClient, session: AsyncSession) -> None:
    patient = make_patient(allergies=["Latex"], blood_type="AB+", city="Seattle")
    await add(session, patient)

    response = await client.get(f"/patients/{patient.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["allergies"] == ["Latex"]
    assert body["blood_type"] == "AB+"
    assert body["city"] == "Seattle"
    assert body["conditions"] == []


async def test_unknown_or_malformed_id(client: AsyncClient) -> None:
    missing = await client.get(f"/patients/{uuid.uuid4()}")
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Patient not found"}
    assert (await client.get("/patients/not-a-uuid")).status_code == 422


# --- Create -----------------------------------------------------------------


async def test_create_returns_201_and_the_stored_patient(client: AsyncClient) -> None:
    response = await client.post("/patients", json=VALID_BODY)

    assert response.status_code == 201
    created = response.json()
    assert created["first_name"] == "Grace"  # surrounding whitespace is trimmed
    assert created["blood_type"] == "O-"
    assert created["last_visit"] is None

    fetched = await client.get(f"/patients/{created['id']}")
    assert fetched.json() == created


async def test_create_applies_defaults_and_treats_blank_strings_as_absent(
    client: AsyncClient,
) -> None:
    body = {
        "first_name": "Min", "last_name": "Kim", "date_of_birth": "2001-02-03",
        "email": "", "phone": "   ", "blood_type": "",
    }  # fmt: skip

    created = (await client.post("/patients", json=body)).json()

    assert created["status"] == "active"
    assert (created["email"], created["phone"], created["blood_type"]) == (None, None, None)
    assert (created["allergies"], created["conditions"]) == ([], [])


@pytest.mark.parametrize(
    ("change", "field"),
    [
        ({"first_name": "   "}, "first_name"),
        ({"last_name": None}, "last_name"),
        ({"date_of_birth": "not-a-date"}, "date_of_birth"),
        ({"email": "not-an-email"}, "email"),
        ({"blood_type": "Z+"}, "blood_type"),
        ({"status": "sleeping"}, "status"),
        ({"allergies": ["ok", ""]}, "allergies"),
        ({"first_name": "x" * 101}, "first_name"),
    ],
)
async def test_create_rejects_invalid_fields(client: AsyncClient, change: dict, field: str) -> None:
    response = await client.post("/patients", json=VALID_BODY | change)

    assert response.status_code == 422
    assert field in {error["loc"][1] for error in response.json()["detail"]}


@pytest.mark.parametrize(
    ("change", "field", "error_type", "message"),
    [
        (
            {"date_of_birth": (date.today() + timedelta(days=1)).isoformat()},
            "date_of_birth",
            "date_in_future",
            "Cannot be in the future",
        ),
        (
            {"date_of_birth": "1850-01-01"},
            "date_of_birth",
            "birth_date_too_old",
            "Cannot be more than 130 years ago",
        ),
        (
            {"last_visit": (date.today() + timedelta(days=1)).isoformat()},
            "last_visit",
            "date_in_future",
            "Cannot be in the future",
        ),
        (
            {"last_visit": "1970-01-01"},
            "last_visit",
            "visit_before_birth",
            "Cannot be before the date of birth",
        ),
    ],
)
async def test_date_rules_are_reported_against_their_field(
    client: AsyncClient, change: dict, field: str, error_type: str, message: str
) -> None:
    response = await client.post("/patients", json=VALID_BODY | change)

    assert response.status_code == 422
    [error] = response.json()["detail"]
    assert error["loc"] == ["body", field]
    assert (error["type"], error["msg"]) == (error_type, message)


# --- Replace ----------------------------------------------------------------


async def test_put_replaces_every_field(client: AsyncClient, session: AsyncSession) -> None:
    patient = make_patient(email="old@example.com", allergies=["Latex"], city="Tacoma")
    await add(session, patient)

    response = await client.put(f"/patients/{patient.id}", json=VALID_BODY)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(patient.id)
    assert (body["first_name"], body["email"]) == ("Grace", "grace.hopper@example.com")
    assert body["allergies"] == ["Penicillin"]
    assert body["city"] is None  # omitted from the body, so cleared


async def test_put_validates_and_404s(client: AsyncClient, session: AsyncSession) -> None:
    patient = make_patient()
    await add(session, patient)

    invalid = await client.put(f"/patients/{patient.id}", json=VALID_BODY | {"email": "nope"})
    missing = await client.put(f"/patients/{uuid.uuid4()}", json=VALID_BODY)

    assert invalid.status_code == 422
    assert missing.status_code == 404


# --- Delete -----------------------------------------------------------------


async def test_delete_removes_the_patient_and_their_notes(
    client: AsyncClient, session: AsyncSession
) -> None:
    patient = make_patient()
    patient.notes.append(
        PatientNote(timestamp=datetime(2026, 1, 5, 17, tzinfo=UTC), content="Annual exam.")
    )
    await add(session, patient)

    response = await client.delete(f"/patients/{patient.id}")

    assert response.status_code == 204
    assert response.content == b""
    assert (await client.get(f"/patients/{patient.id}")).status_code == 404
    assert await session.get(PatientNote, patient.notes[0].id) is None
    assert (await client.delete(f"/patients/{patient.id}")).status_code == 404
