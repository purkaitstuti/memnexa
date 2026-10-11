from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app
from .conftest import register

iso = lambda d: d.astimezone(timezone.utc).isoformat()
now = lambda: datetime.now(timezone.utc)


def test_signup_login_and_duplicates(client):
    register(client)
    assert client.post("/api/auth/signup", json={"name": "A", "email": "a@x.com", "password": "password123"}).status_code == 409
    client.post("/api/auth/logout")
    assert client.post("/api/auth/login", json={"email": "a@x.com", "password": "wrong-pass"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "a@x.com", "password": "password123"}).status_code == 200


def test_protected_routes(client):
    for path in ["/api/tasks", "/api/memories", "/api/auth/me", "/api/tasks/stats"]:
        assert client.get(path).status_code == 401


def test_task_complete_and_overdue(client):
    register(client)
    past = client.post("/api/tasks", json={"title": "old", "due_at": iso(now() - timedelta(days=1))}).json()
    fut = client.post("/api/tasks", json={"title": "new", "due_at": iso(now() + timedelta(days=1))}).json()
    assert past["is_overdue"] and not fut["is_overdue"]
    assert client.get("/api/tasks/stats").json() == {"total": 2, "completed": 0, "pending": 2, "overdue": 1}
    done = client.post(f"/api/tasks/{past['id']}/complete").json()
    assert done["status"] == "completed" and not done["is_overdue"]
    assert client.post(f"/api/tasks/{past['id']}/complete?done=false").json()["is_overdue"]
    assert len(client.get("/api/tasks?status=overdue").json()["items"]) == 1


def test_calendar_range(client):
    register(client)
    d = now() + timedelta(days=3)
    client.post("/api/tasks", json={"title": "in", "due_at": iso(d)})
    client.post("/api/tasks", json={"title": "out", "due_at": iso(d + timedelta(days=30))})
    r = client.get("/api/tasks/calendar", params={"start": iso(d - timedelta(days=1)), "end": iso(d + timedelta(days=1))})
    assert [t["title"] for t in r.json()] == ["in"]


def test_memory_crud(client):
    register(client)
    m = client.post("/api/memories", json={"title": "Idea", "content": "x", "tags": ["Work"]}).json()
    assert m["tags"] == ["work"]
    assert client.patch(f"/api/memories/{m['id']}", json={"title": "Idea 2"}).json()["title"] == "Idea 2"
    assert client.delete(f"/api/memories/{m['id']}").status_code == 204
    assert client.get(f"/api/memories/{m['id']}").status_code == 404


def test_user_isolation(client):
    register(client, "a@x.com")
    t = client.post("/api/tasks", json={"title": "secret"}).json()
    m = client.post("/api/memories", json={"title": "secret"}).json()
    other = TestClient(app)
    register(other, "b@x.com")
    assert other.get(f"/api/tasks/{t['id']}").status_code == 404
    assert other.post(f"/api/tasks/{t['id']}/complete").status_code == 404
    assert other.delete(f"/api/memories/{m['id']}").status_code == 404
    assert other.get("/api/tasks").json()["total"] == 0
