import os, tempfile
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine
from app import ratelimit


@pytest.fixture()
def client():
    ratelimit.reset()
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


def register(client, email="a@x.com"):
    r = client.post("/api/auth/signup", json={"name": "A", "email": email, "password": "password123"})
    assert r.status_code == 201, r.text
    return r
