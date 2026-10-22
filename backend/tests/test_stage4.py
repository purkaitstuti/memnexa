import json
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.ai import AIUnavailable
from app.main import app
from .conftest import register

iso = lambda d: d.astimezone(timezone.utc).isoformat()
now = lambda: datetime.now(timezone.utc)
TXT = lambda name="n.txt", body=b"Submit math assignment by Friday": {"file": (name, body, "text/plain")}


def fake_ai(items):
    return lambda msgs, json_mode=False: json.dumps({"items": items})


def test_upload_suggestions_never_invent_dates(client, monkeypatch):
    monkeypatch.setattr("app.suggest.chat", fake_ai([
        {"kind": "task", "title": "Submit math assignment", "date_phrase": "Friday", "priority": "high", "tags": ["math"]},
        {"kind": "task", "title": "Invented thing", "date_phrase": "Tuesday"}]))  # "Tuesday" is not in the document
    register(client)
    r = client.post("/api/uploads", files=TXT(), data={"tz": "UTC"})
    assert r.status_code == 200
    a, b = r.json()["suggestions"]
    assert a["due_date"] and a["needs_confirm"] and a["priority"] == "high"
    assert b["due_date"] is None and b["date_phrase"] is None
    assert client.get("/api/tasks").json()["total"] == 0  # suggestions are not saved


def test_upload_ai_down_still_returns_text(client, monkeypatch):
    def down(msgs, json_mode=False): raise AIUnavailable("down")
    monkeypatch.setattr("app.suggest.chat", down)
    register(client)
    j = client.post("/api/uploads", files=TXT()).json()
    assert j["suggestions"] == [] and j["ai_error"] == "down" and "math" in j["text"]


def test_upload_validation(client, monkeypatch):
    register(client)
    assert client.post("/api/uploads", files=TXT("evil.exe", b"MZ")).status_code == 415
    assert client.post("/api/uploads", files={"file": ("pic.png", b"not a png", "image/png")}).status_code == 400
    monkeypatch.setattr("app.api.uploads.MAX_BYTES", 10)
    assert client.post("/api/uploads", files=TXT(body=b"x" * 11)).status_code == 413
    assert TestClient(app).post("/api/uploads", files=TXT()).status_code == 401


def test_save_skips_duplicates(client):
    register(client)
    body = {"tasks": [{"title": "Read ch1", "due_at": iso(now() + timedelta(days=1))}], "memories": [{"title": "Fact", "content": "x"}]}
    assert client.post("/api/uploads/save", json=body).json() == {"saved_tasks": 1, "saved_memories": 1, "skipped": 0}
    assert client.post("/api/uploads/save", json=body).json() == {"saved_tasks": 0, "saved_memories": 0, "skipped": 2}


def test_reminders_created_once_and_can_be_read(client):
    register(client)
    client.post("/api/tasks", json={"title": "t", "due_at": iso(now() + timedelta(hours=1)), "reminder_at": iso(now() - timedelta(minutes=5))})
    a = client.get("/api/notifications").json()
    b = client.get("/api/notifications").json()
    assert a["unread"] == 1 and len(b["items"]) == 1  # no duplicates
    nid = a["items"][0]["id"]
    assert client.post(f"/api/notifications/{nid}/read").status_code == 204
    assert client.get("/api/notifications").json()["unread"] == 0
    other = TestClient(app); register(other, "b@x.com")
    assert other.post(f"/api/notifications/{nid}/read").status_code == 404
    assert other.get("/api/notifications").json()["items"] == []


def test_reminders_respect_setting_and_skip_completed(client):
    register(client)
    client.patch("/api/auth/me", json={"reminders_enabled": False})
    t = client.post("/api/tasks", json={"title": "t", "reminder_at": iso(now() - timedelta(minutes=5))}).json()
    assert client.get("/api/notifications").json()["items"] == []
    client.patch("/api/auth/me", json={"reminders_enabled": True})
    client.post(f"/api/tasks/{t['id']}/complete")
    assert client.get("/api/notifications").json()["items"] == []


def test_default_reminder_timing(client):
    register(client)
    client.patch("/api/auth/me", json={"default_reminder_minutes": 30})
    t = client.post("/api/tasks", json={"title": "t", "due_at": iso(now() + timedelta(days=2))}).json()
    assert datetime.fromisoformat(t["due_at"]) - datetime.fromisoformat(t["reminder_at"]) == timedelta(minutes=30)
    client.patch("/api/auth/me", json={"default_reminder_minutes": -1})
    t2 = client.post("/api/tasks", json={"title": "u", "due_at": iso(now() + timedelta(days=2))}).json()
    assert t2["reminder_at"] is None


def test_resolve_dates_with_ocr_noise():
    from datetime import date
    from app.dates import resolve_date
    today = date(2026, 10, 11)
    assert resolve_date('02" October,2026', today) == (date(2026, 10, 2), False)
    assert resolve_date("02nd October, 2026", today) == (date(2026, 10, 2), False)
    assert resolve_date("Friday", today)[1] is True


def test_upload_returns_summary_even_without_items(client, monkeypatch):
    monkeypatch.setattr("app.suggest.chat", lambda msgs, json_mode=False: json.dumps(
        {"summary": "The institute announces a holiday on 2 October 2026 for Gandhi Jayanti.", "items": []}))
    register(client)
    j = client.post("/api/uploads", files=TXT(body=b"Holiday on 02 October 2026 for Gandhi Jayanti")).json()
    assert j["suggestions"] == [] and j["ai_error"] is None and "holiday" in j["summary"].lower()
