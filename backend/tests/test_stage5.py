from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.database import SessionLocal
from app.main import app
from app.models import User
from app.security import make_token
from .conftest import register

iso = lambda d: d.astimezone(timezone.utc).isoformat()


def test_search_finds_own_items_and_tags_only(client):
    register(client)
    client.post("/api/tasks", json={"title": "Physics lab report", "tags": ["Science"]})
    client.post("/api/memories", json={"title": "Library hours", "content": "closes at six", "tags": ["science", "campus"]})
    other = TestClient(app); register(other, "b@x.com")
    other.post("/api/tasks", json={"title": "Physics secret", "tags": ["science"]})
    r = client.get("/api/search", params={"q": "physics"}).json()
    assert [t["title"] for t in r["tasks"]] == ["Physics lab report"] and r["memories"] == []
    r = client.get("/api/search", params={"q": "SCIENCE"}).json()
    assert r["tags"] == [{"tag": "science", "count": 2}] and len(r["memories"]) == 1
    assert client.get("/api/search", params={"q": "zzzz"}).json() == {"tasks": [], "memories": [], "tags": []}
    assert client.get("/api/search", params={"q": "%"}).json()["tasks"] == []  # wildcard characters are escaped
    assert TestClient(app).get("/api/search", params={"q": "a"}).status_code == 401


def test_change_password(client):
    register(client)
    assert client.post("/api/account/password", json={"current_password": "nope-nope", "new_password": "newpassword1"}).status_code == 400
    assert client.post("/api/account/password", json={"current_password": "password123", "new_password": "short"}).status_code == 422
    assert client.post("/api/account/password", json={"current_password": "password123", "new_password": "newpassword1"}).status_code == 204
    client.post("/api/auth/logout")
    assert client.post("/api/auth/login", json={"email": "a@x.com", "password": "password123"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "a@x.com", "password": "newpassword1"}).status_code == 200


def test_google_account_has_no_password_to_change(client):
    with SessionLocal() as db:
        u = User(name="G", email="g@x.com", provider="google"); db.add(u); db.commit(); uid = u.id
    c = TestClient(app); c.cookies.set("memnexa_session", make_token(uid))
    assert c.post("/api/account/password", json={"current_password": "x", "new_password": "newpassword1"}).status_code == 400


def test_export_has_my_data_and_no_secrets(client):
    register(client)
    client.post("/api/tasks", json={"title": "mine", "due_at": iso(datetime.now(timezone.utc) + timedelta(days=1))})
    client.post("/api/memories", json={"title": "my memory"})
    other = TestClient(app); register(other, "b@x.com"); other.post("/api/tasks", json={"title": "theirs"})
    r = client.get("/api/account/export")
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    j = r.json()
    assert [t["title"] for t in j["tasks"]] == ["mine"] and [m["title"] for m in j["memories"]] == ["my memory"]
    assert "password_hash" not in r.text and "$2b$" not in r.text  # no hashes or secrets
    assert TestClient(app).get("/api/account/export").status_code == 401


def test_delete_account(client):
    register(client)
    client.post("/api/tasks", json={"title": "t"}); client.post("/api/memories", json={"title": "m"})
    assert client.post("/api/account/delete", json={"confirm": "nope", "password": "password123"}).status_code == 400
    assert client.post("/api/account/delete", json={"confirm": "DELETE", "password": "wrong-wrong"}).status_code == 400
    assert client.post("/api/account/delete", json={"confirm": "DELETE", "password": "password123"}).status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"email": "a@x.com", "password": "password123"}).status_code == 401
    with SessionLocal() as db:
        from sqlalchemy import func, select
        from app.models import Memory, Task
        assert db.scalar(select(func.count(Task.id))) == 0 and db.scalar(select(func.count(Memory.id))) == 0
