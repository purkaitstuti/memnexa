from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from ..deps import current_user, get_db
from ..models import Memory, Notification, Task, User, utcnow

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotifOut(BaseModel):
    id: int
    message: str
    read: bool
    delivered: bool
    scheduled_at: datetime
    task_id: int | None
    memory_id: int | None


class NotifList(BaseModel):
    items: list[NotifOut]
    unread: int


class DeliveredIn(BaseModel):
    ids: list[int]


def generate_due(db: Session, user: User, now: datetime) -> None:
    """Create a notification for each reminder that has come due. One per (item, reminder time), so no duplicates.
    Runs whenever the app asks for notifications; there is no background scheduler (see README for limits)."""
    if not user.reminders_enabled:
        return
    floor = now - timedelta(days=7)  # don't flood with very old reminders
    for t in db.scalars(select(Task).where(Task.user_id == user.id, Task.status == "pending",
                                           Task.reminder_at.is_not(None), Task.reminder_at <= now, Task.reminder_at >= floor)):
        if not db.scalar(select(Notification.id).where(Notification.user_id == user.id, Notification.task_id == t.id,
                                                       Notification.kind == "reminder", Notification.scheduled_at == t.reminder_at)):
            db.add(Notification(user_id=user.id, task_id=t.id, kind="reminder", message=f'Reminder: "{t.title}"', scheduled_at=t.reminder_at))
    for m in db.scalars(select(Memory).where(Memory.user_id == user.id, Memory.reminder_at.is_not(None),
                                             Memory.reminder_at <= now, Memory.reminder_at >= floor)):
        if not db.scalar(select(Notification.id).where(Notification.user_id == user.id, Notification.memory_id == m.id,
                                                       Notification.kind == "reminder", Notification.scheduled_at == m.reminder_at)):
            db.add(Notification(user_id=user.id, memory_id=m.id, kind="reminder", message=f'Reminder: "{m.title}"', scheduled_at=m.reminder_at))
    db.commit()


def to_out(n: Notification) -> NotifOut:
    return NotifOut(id=n.id, message=n.message, read=n.read, delivered=n.delivered, scheduled_at=n.scheduled_at,
                    task_id=n.task_id, memory_id=n.memory_id)


@router.get("", response_model=NotifList)
def list_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    generate_due(db, user, utcnow())
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id)
                      .order_by(Notification.scheduled_at.desc(), Notification.id.desc()).limit(30)).all()
    unread = db.scalar(select(func.count(Notification.id)).where(Notification.user_id == user.id, Notification.read.is_(False)))
    return NotifList(items=[to_out(n) for n in rows], unread=unread or 0)


@router.post("/read-all", status_code=204)
def read_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.user_id == user.id).values(read=True)); db.commit()


@router.post("/delivered", status_code=204)
def delivered(data: DeliveredIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.user_id == user.id, Notification.id.in_(data.ids)).values(delivered=True)); db.commit()


@router.post("/{nid}/read", status_code=204)
def read_one(nid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, nid)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Notification not found")
    n.read = True; db.commit()
