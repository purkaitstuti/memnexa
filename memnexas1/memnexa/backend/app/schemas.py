from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator


def to_utc_naive(v):
    if isinstance(v, datetime) and v.tzinfo is not None:
        return v.astimezone(timezone.utc).replace(tzinfo=None)
    return v


class SignUp(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class Login(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    provider: str
    theme: str
    reminders_enabled: bool
    default_reminder_minutes: int


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    theme: Literal["light", "dark", "system"] | None = None
    reminders_enabled: bool | None = None
    default_reminder_minutes: int | None = Field(default=None, ge=-1, le=10080)


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    due_at: datetime | None = None
    priority: Literal["low", "medium", "high"] = "medium"
    tags: list[str] = []
    reminder_at: datetime | None = None

    _utc = field_validator("due_at", "reminder_at", mode="after")(to_utc_naive)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    due_at: datetime | None = None
    priority: Literal["low", "medium", "high"] | None = None
    tags: list[str] | None = None
    reminder_at: datetime | None = None

    _utc = field_validator("due_at", "reminder_at", mode="after")(to_utc_naive)


class TaskOut(BaseModel):
    id: int
    title: str
    description: str
    due_at: datetime | None
    priority: str
    status: str
    is_overdue: bool
    tags: list[str]
    reminder_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class MemoryIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = ""
    category: Literal["Personal", "Academic", "Ideas", "Important Information", "Events", "Other"] = "Personal"
    tags: list[str] = []
    memory_date: datetime | None = None
    reminder_at: datetime | None = None

    _utc = field_validator("memory_date", "reminder_at", mode="after")(to_utc_naive)


class MemoryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    memory_date: datetime | None = None
    reminder_at: datetime | None = None

    _utc = field_validator("memory_date", "reminder_at", mode="after")(to_utc_naive)


class MemoryOut(BaseModel):
    id: int
    title: str
    content: str
    category: str
    tags: list[str]
    memory_date: datetime | None
    reminder_at: datetime | None
    created_at: datetime
    updated_at: datetime
