import pytest

from app.core.config import Settings, asyncpg_url


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        # Already in the form the app uses: unchanged.
        (
            "postgresql+asyncpg://user:secret@db:5432/healthcare",
            "postgresql+asyncpg://user:secret@db:5432/healthcare",
        ),
        # As a hosting provider supplies it.
        (
            "postgresql://user:secret@host.example/app?sslmode=require&channel_binding=require",
            "postgresql+asyncpg://user:secret@host.example/app?ssl=require",
        ),
        (
            "postgres://user:secret@host.example/app",
            "postgresql+asyncpg://user:secret@host.example/app",
        ),
    ],
)
def test_database_urls_are_converted_for_asyncpg(given: str, expected: str) -> None:
    assert asyncpg_url(given) == expected


def test_the_direct_database_url_is_preferred(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@pooled.example/app")
    monkeypatch.setenv("DATABASE_URL_UNPOOLED", "postgresql://u:p@direct.example/app")

    assert Settings().database_url == "postgresql+asyncpg://u:p@direct.example/app"


def test_vercel_instances_keep_fewer_connections(monkeypatch: pytest.MonkeyPatch) -> None:
    assert Settings().database_pool_size == 5
    monkeypatch.setenv("VERCEL", "1")
    assert Settings().database_pool_size == 2


def test_the_api_is_served_under_a_prefix_on_vercel(monkeypatch: pytest.MonkeyPatch) -> None:
    assert Settings().api_prefix == ""
    monkeypatch.setenv("VERCEL", "1")
    assert Settings().api_prefix == "/api"
