"""Patient summaries.

`Summarizer` is the seam: anything that can turn a patient and their notes into
text can be swapped in through `get_summarizer`, for example a language model.
`TemplateSummarizer` is the default. It is deterministic, needs no API key or
network, and never sends patient data anywhere.
"""

import re
from collections.abc import Sequence
from datetime import date, datetime
from typing import Protocol
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.models import Patient, PatientNote
from app.schemas.patient import age_on

# How many notes are quoted in full before older ones are only counted.
QUOTED_NOTES = 4
EXCERPT_LENGTH = 260


class Summarizer(Protocol):
    name: str

    def summarize(self, patient: Patient, notes: Sequence[PatientNote]) -> str:
        """Return the summary as paragraphs separated by blank lines."""
        ...


def _join(items: Sequence[str]) -> str:
    """["a", "b", "c"] -> "a, b and c"."""
    if len(items) <= 1:
        return "".join(items)
    return f"{', '.join(items[:-1])} and {items[-1]}"


def _long_date(value: date) -> str:
    return f"{value:%B} {value.day}, {value.year}"


def _excerpt(content: str) -> str:
    """The opening sentences of a note, up to a readable length."""
    text = " ".join(content.split())
    if len(text) <= EXCERPT_LENGTH:
        return text if text.endswith((".", "!", "?")) else f"{text}."
    sentences = re.split(r"(?<=[.!?])\s+", text)
    excerpt = ""
    for sentence in sentences:
        if len(excerpt) + len(sentence) > EXCERPT_LENGTH:
            break
        excerpt = f"{excerpt} {sentence}".strip()
    return excerpt or f"{text[:EXCERPT_LENGTH].rsplit(' ', 1)[0]}…"


class TemplateSummarizer:
    name = "template"

    def __init__(self, timezone: str) -> None:
        self._timezone = ZoneInfo(timezone)

    def summarize(self, patient: Patient, notes: Sequence[PatientNote]) -> str:
        return "\n\n".join(
            [self._identity(patient), self._clinical(patient), self._narrative(patient, notes)]
        )

    def _identity(self, patient: Patient) -> str:
        age = age_on(patient.date_of_birth, datetime.now(self._timezone).date())
        years = "1 year" if age == 1 else f"{age} years"
        blood = (
            f"blood type {patient.blood_type.value}"
            if patient.blood_type
            else "no blood type on file"
        )
        return (
            f"{patient.first_name} {patient.last_name} is {years} old "
            f"(born {_long_date(patient.date_of_birth)}), with {blood}. "
            f"Their status is {patient.status.value}."
        )

    def _clinical(self, patient: Patient) -> str:
        conditions = (
            f"Recorded conditions: {_join(patient.conditions)}."
            if patient.conditions
            else "No ongoing conditions are recorded."
        )
        allergies = (
            f"Allergies: {_join(patient.allergies)}."
            if patient.allergies
            else "No allergies are recorded."
        )
        return f"{conditions} {allergies}"

    def _narrative(self, patient: Patient, notes: Sequence[PatientNote]) -> str:
        if not notes:
            return "No clinical notes have been recorded yet."

        ordered = sorted(notes, key=lambda note: note.timestamp)
        on = [_long_date(note.timestamp.astimezone(self._timezone).date()) for note in ordered]
        excerpts = [_excerpt(note.content) for note in ordered]

        if len(ordered) == 1:
            return f"There is one clinical note, from {on[0]}: {excerpts[0]}"

        sentences = [
            f"There are {len(ordered)} clinical notes, from {on[0]} to {on[-1]}.",
            f"The record opens on {on[0]}: {excerpts[0]}",
        ]
        # Quote the most recent notes; summarise anything in between by count.
        recent_start = max(1, len(ordered) - (QUOTED_NOTES - 1))
        skipped = recent_start - 1
        if skipped:
            sentences.append(
                f"{skipped} further {'note follows' if skipped == 1 else 'notes follow'}, "
                f"through {on[recent_start - 1]}."
            )
        for index in range(recent_start, len(ordered) - 1):
            sentences.append(f"On {on[index]}: {excerpts[index]}")
        sentences.append(f"Most recently, on {on[-1]}: {excerpts[-1]}")
        return " ".join(sentences)


def get_summarizer() -> Summarizer:
    """The summariser in use. Override this dependency to plug in another."""
    return TemplateSummarizer(get_settings().practice_timezone)
