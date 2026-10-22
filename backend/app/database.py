from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import settings

args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass

if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _enable_fk(conn, _):  # make ON DELETE CASCADE work in SQLite
        cur = conn.cursor(); cur.execute("PRAGMA foreign_keys=ON"); cur.close()
