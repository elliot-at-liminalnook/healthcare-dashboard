"""The sample-data fixture must load into the models and stay internally consistent."""

import json
from datetime import UTC, date, datetime

from scripts.generate_fixture import PATIENT_COUNT, generate
from scripts.seed import FIXTURE, load_fixture


def test_fixture_loads_into_models() -> None:
    patients = load_fixture()

    assert len(patients) == PATIENT_COUNT
    assert len({patient.id for patient in patients}) == PATIENT_COUNT
    assert len({(patient.first_name, patient.last_name) for patient in patients}) == PATIENT_COUNT
    emails = [patient.email for patient in patients if patient.email]
    assert len(emails) == len(set(emails))


def test_fixture_dates_are_consistent() -> None:
    today = date.today()
    now = datetime.now(UTC)

    for patient in load_fixture():
        assert patient.date_of_birth <= today
        if patient.last_visit is None:
            assert patient.notes == []
            continue
        assert patient.date_of_birth <= patient.last_visit <= today
        for note in patient.notes:
            assert note.content.strip()
            assert note.timestamp <= now
            assert note.timestamp.date() >= patient.date_of_birth


def test_fixture_covers_the_cases_the_app_must_handle() -> None:
    patients = load_fixture()
    today = date.today()
    ages = [(today - patient.date_of_birth).days // 365 for patient in patients]

    assert min(ages) <= 1 and max(ages) >= 90
    assert {patient.status.value for patient in patients} == {"active", "inactive", "critical"}
    assert any(patient.blood_type is None for patient in patients)
    assert any(not patient.conditions for patient in patients)
    assert any(not patient.allergies for patient in patients)
    assert any(patient.email is None for patient in patients)
    assert any(patient.last_visit is None for patient in patients)
    assert any(len(patient.notes) >= 4 for patient in patients)


def test_committed_fixture_matches_the_generator() -> None:
    assert json.loads(FIXTURE.read_text()) == generate()
