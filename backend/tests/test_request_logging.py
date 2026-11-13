from fastapi.testclient import TestClient
from structlog.testing import capture_logs

from app.main import app


def test_request_is_logged_with_status_and_duration() -> None:
    with capture_logs() as logs, TestClient(app) as client:
        client.get("/no-such-route")

    [entry] = [log for log in logs if log["event"] == "request"]
    assert entry["method"] == "GET"
    assert entry["path"] == "/no-such-route"
    assert entry["status"] == 404
    assert entry["duration_ms"] >= 0


def test_health_checks_are_not_logged() -> None:
    with capture_logs() as logs, TestClient(app) as client:
        client.get("/health")

    assert [log for log in logs if log["event"] == "request"] == []
