from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr, Field

Mood = Literal["Energized", "Motivated", "Neutral", "Stressed", "Frustrated"]

MOOD_SCORE = {
    "Energized": 100,
    "Motivated": 80,
    "Neutral": 60,
    "Stressed": 35,
    "Frustrated": 15,
}


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    department_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CheckInCreate(BaseModel):
    mood: Mood
    workload_q: int = Field(ge=1, le=5)
    recognition_q: int = Field(ge=1, le=5)
    growth_q: int = Field(ge=1, le=5)
    leadership_q: int = Field(ge=1, le=5)
    recommend_q: int = Field(ge=1, le=5)


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    department_id: Optional[str] = None
    event_date: Optional[datetime] = None
