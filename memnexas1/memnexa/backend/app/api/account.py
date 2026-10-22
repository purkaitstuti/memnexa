from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from ..deps import COOKIE, current_user, get_db, unpack_tags
from ..models import Memory, Notification, RecentSearch, Task, User, utcnow
from ..ratelimit import hit
from ..security import hash_password, verify_password

router = APIRouter(prefix="/api/account", tags=["account"])


class PasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class DeleteIn(BaseModel):
    confirm: str
    password: str | None = None


@router.post("/password", status_code=204)
def change_password(data: PasswordIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    hit(f"pw:{user.id}", 5)
    if not user.password_hash:
        raise HTTPException(400, "Your account signs in with Google, so there is no Memnexa password to change.")
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Your current password is incorrect.")
    user.password_hash = hash_password(data.new_password)
    db.commit()


@router.get("/export")
def export_data(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Everything Memnexa stores about the user, as a JSON download. The password hash is never included."""
    rows = lambda model: db.scalars(select(model).where(model.user_id == user.id).order_by(model.id)).all()
    payload = {
        "exported_at": utcnow(), "note": "All timestamps are UTC.",
        "profile": {"name": user.name, "email": user.email, "sign_in_method": user.provider, "theme": user.theme,
                    "reminders_enabled": user.reminders_enabled, "default_reminder_minutes": user.default_reminder_minutes,
                    "created_at": user.created_at},
        "tasks": [{"title": t.title, "description": t.description, "due_at": t.due_at, "priority": t.priority, "status": t.status,
                   "tags": unpack_tags(t.tags), "reminder_at": t.reminder_at, "completed_at": t.completed_at,
                   "created_at": t.created_at} for t in rows(Task)],
        "memories": [{"title": m.title, "content": m.content, "category": m.category, "tags": unpack_tags(m.tags),
                      "memory_date": m.memory_date, "reminder_at": m.reminder_at, "created_at": m.created_at} for m in rows(Memory)],
        "notifications": [{"message": n.message, "read": n.read, "scheduled_at": n.scheduled_at} for n in rows(Notification)],
        "recent_searches": [{"query": s.query, "created_at": s.created_at} for s in rows(RecentSearch)],
    }
    return JSONResponse(jsonable_encoder(payload), headers={"Content-Disposition": 'attachment; filename="memnexa-export.json"'})


@router.post("/delete", status_code=204)
def delete_account(data: DeleteIn, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    hit(f"del:{user.id}", 5)
    if data.confirm != "DELETE":
        raise HTTPException(400, "Type DELETE to confirm.")
    if user.password_hash and not (data.password and verify_password(data.password, user.password_hash)):
        raise HTTPException(400, "Your password is incorrect.")
    for model in (Notification, RecentSearch, Task, Memory):
        db.execute(delete(model).where(model.user_id == user.id))
    db.delete(user)
    db.commit()
    response.delete_cookie(COOKIE, path="/")
