from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from .api import uploads
from .api import account
from .api import ask
from .api import auth
from .api import memories
from .api import notifications
from .api import search
from .api import tasks
from .config import settings
from .database import Base, engine

Base.metadata.create_all(engine)  # simple init; switch to Alembic when the schema starts changing

app = FastAPI(title="Memnexa API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key, same_site="lax",
                   https_only=settings.cookie_secure)  # used only for the OAuth handshake
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(memories.router)
app.include_router(ask.router)
app.include_router(uploads.router)
app.include_router(notifications.router)
app.include_router(search.router)
app.include_router(account.router)


@app.get("/api/health")
def health():
    return {"ok": True}


from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

FRONTEND_DIR = Path("/app/frontend/dist")

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        requested_file = FRONTEND_DIR / full_path
        if full_path and requested_file.is_file():
            return FileResponse(requested_file)
        return FileResponse(FRONTEND_DIR / "index.html")