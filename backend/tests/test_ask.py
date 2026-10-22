from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from app.ai import AIUnavailable, date_intent
from app.main import app
from .conftest import register

iso = lambda d: d.astimezone(timezone.utc).isoformat()
now = lambda: datetime.now(timezone.utc)


def test_weekend_ranges():
    utc = ZoneInfo("UTC")
    _, s, e = date_intent("what do i need to do this weekend", datetime(2026, 10, 14, 12, tzinfo=utc))  # Wednesday
    assert (s.day, e.day) == (17, 19)
    _, s, _ = date_intent("this weekend", datetime(2026, 10, 11, 9, tzinfo=utc))  # Sunday -> started yesterday
    assert s.day == 10
    _, s, _ = date_intent("this weekend", datetime(2026, 10, 10, 9, tzinfo=utc))  # Saturday
    assert s.day == 10


def test_overdue_question_uses_only_own_overdue_tasks(client, monkeypatch):
    seen = {}
    monkeypatch.setattr("app.api.ask.chat", lambda m: seen.setdefault("p", m[1]["content"]) and "ok")
    register(client)
    client.post("/api/tasks", json={"title": "late essay", "due_at": iso(now() - timedelta(days=2))})
    client.post("/api/tasks", json={"title": "future lab", "due_at": iso(now() + timedelta(days=2))})
    other = TestClient(app); register(other, "b@x.com")
    other.post("/api/tasks", json={"title": "bobs secret", "due_at": iso(now() - timedelta(days=2))})
    r = client.post("/api/ask", json={"question": "Which tasks are overdue?", "tz": "UTC"})
    assert r.status_code == 200 and [t["title"] for t in r.json()["tasks"]] == ["late essay"]
    assert "late essay" in seen["p"] and "bobs secret" not in seen["p"] and "future lab" not in seen["p"]


def test_nothing_found_skips_the_model(client, monkeypatch):
    def boom(m): raise AssertionError("model must not be called")
    monkeypatch.setattr("app.api.ask.chat", boom)
    register(client)
    r = client.post("/api/ask", json={"question": "What did I save about chemistry?"})
    assert r.status_code == 200 and "couldn't find" in r.json()["answer"] and not r.json()["used_ai"]


def test_ollama_unavailable(client, monkeypatch):
    def down(m): raise AIUnavailable("Memnexa couldn't connect to the AI assistant. Make sure Ollama is running and try again.")
    monkeypatch.setattr("app.api.ask.chat", down)
    register(client)
    client.post("/api/memories", json={"title": "physics notes", "content": "x"})
    r = client.post("/api/ask", json={"question": "physics notes?"})
    assert r.status_code == 503 and "Ollama is running" in r.json()["detail"]


def test_recent_searches(client, monkeypatch):
    monkeypatch.setattr("app.api.ask.chat", lambda m: "ok")
    register(client)
    for q in ["alpha", "beta", "alpha"]:
        client.post("/api/ask", json={"question": q})
    rec = client.get("/api/ask/recent").json()
    assert [x["query"] for x in rec] == ["alpha", "beta"]  # deduplicated, newest first
    other = TestClient(app); register(other, "b@x.com")
    assert other.get("/api/ask/recent").json() == []
    assert other.delete(f"/api/ask/recent/{rec[0]['id']}").status_code == 404
    assert client.delete(f"/api/ask/recent/{rec[0]['id']}").status_code == 204
    assert client.delete("/api/ask/recent").status_code == 204
    assert client.get("/api/ask/recent").json() == []
