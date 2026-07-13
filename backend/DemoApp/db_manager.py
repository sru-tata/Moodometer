"""db_manager.py

MongoDB data-access layer for Mood-O-Meter. Mirrors the connection pattern
used across NeuroNest DemoApp templates (see settings.MONGO_URI) but defines
collections and helper functions specific to this app: users, departments,
check-ins, and events.

All documents use a string `id` field (uuid4) as the application-level
primary key, kept separate from Mongo's internal `_id`, so the API layer
never has to deal with ObjectId serialization.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pymongo import MongoClient, ASCENDING, DESCENDING

from settings import settings

logger = logging.getLogger(__name__)

MONGO_URI = settings.MONGO_URI
DB_NAME = settings.mongo_db_name

client: Optional[MongoClient] = None
db = None
users_collection = None
departments_collection = None
checkins_collection = None
events_collection = None
_MONGO_AVAILABLE = False


def _connect():
    """Attempt to connect to MongoDB. Never raises — the app must still be
    able to boot (e.g. for local frontend development) even if the shared
    NeuroNest Mongo cluster is unreachable from the current network."""
    global client, db, users_collection, departments_collection
    global checkins_collection, events_collection, _MONGO_AVAILABLE

    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.admin.command("ismaster")
        db = client[DB_NAME]

        users_collection = db[settings.users_collection]
        departments_collection = db[settings.departments_collection]
        checkins_collection = db[settings.checkins_collection]
        events_collection = db[settings.events_collection]

        users_collection.create_index([("email", ASCENDING)], unique=True)
        users_collection.create_index([("id", ASCENDING)], unique=True)
        departments_collection.create_index([("id", ASCENDING)], unique=True)
        checkins_collection.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        events_collection.create_index([("event_date", DESCENDING)])

        _MONGO_AVAILABLE = True
        logger.info("Connected to MongoDB at %s, db=%s", settings.mongo_host, DB_NAME)
    except Exception as e:  # pragma: no cover - network dependent
        _MONGO_AVAILABLE = False
        logger.warning("MongoDB unavailable (%s). Falling back to in-memory store.", e)


_connect()


def mongo_available() -> bool:
    return _MONGO_AVAILABLE


# ---------------------------------------------------------------------------
# In-memory fallback store
# ---------------------------------------------------------------------------
# Keeps the demo fully functional even when the sandbox has no route to the
# shared NeuroNest Mongo cluster (common in isolated preview/build
# environments). Mirrors the exact same document shapes as Mongo so swapping
# back to a live cluster is a no-op for the rest of the app.

_mem = {
    "users": {},
    "departments": {},
    "checkins": {},
    "events": {},
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------

def create_department(name: str) -> Dict[str, Any]:
    doc = {"id": new_id(), "name": name}
    if _MONGO_AVAILABLE:
        departments_collection.insert_one(doc)
    else:
        _mem["departments"][doc["id"]] = doc
    return doc


def list_departments() -> List[Dict[str, Any]]:
    if _MONGO_AVAILABLE:
        return list(departments_collection.find({}, {"_id": 0}).sort("name", ASCENDING))
    return sorted(_mem["departments"].values(), key=lambda d: d["name"])


def get_department(department_id: str) -> Optional[Dict[str, Any]]:
    if not department_id:
        return None
    if _MONGO_AVAILABLE:
        return departments_collection.find_one({"id": department_id}, {"_id": 0})
    return _mem["departments"].get(department_id)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def create_user(
    email: str,
    full_name: str,
    hashed_password: str,
    role: str = "user",
    department_id: Optional[str] = None,
    tenure_months: int = 12,
    absenteeism_days: int = 0,
    learning_participation: int = 50,
    performance_rating: float = 3.0,
) -> Dict[str, Any]:
    doc = {
        "id": new_id(),
        "email": email.lower(),
        "full_name": full_name,
        "hashed_password": hashed_password,
        "role": role,
        "department_id": department_id,
        "tenure_months": tenure_months,
        "absenteeism_days": absenteeism_days,
        "learning_participation": learning_participation,
        "performance_rating": performance_rating,
        "created_at": _now(),
    }
    if _MONGO_AVAILABLE:
        users_collection.insert_one(doc)
    else:
        _mem["users"][doc["id"]] = doc
    return {k: v for k, v in doc.items() if k != "_id"}


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    email = (email or "").lower()
    if _MONGO_AVAILABLE:
        return users_collection.find_one({"email": email}, {"_id": 0})
    for u in _mem["users"].values():
        if u["email"] == email:
            return u
    return None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    if _MONGO_AVAILABLE:
        return users_collection.find_one({"id": user_id}, {"_id": 0})
    return _mem["users"].get(user_id)


def list_users(role: Optional[str] = None) -> List[Dict[str, Any]]:
    if _MONGO_AVAILABLE:
        query = {"role": role} if role else {}
        return list(users_collection.find(query, {"_id": 0}))
    users = list(_mem["users"].values())
    return [u for u in users if role is None or u["role"] == role]


# ---------------------------------------------------------------------------
# Check-ins
# ---------------------------------------------------------------------------

def create_checkin(user_id: str, fields: Dict[str, Any]) -> Dict[str, Any]:
    doc = {"id": new_id(), "user_id": user_id, "created_at": _now(), **fields}
    if _MONGO_AVAILABLE:
        checkins_collection.insert_one(doc)
    else:
        _mem["checkins"][doc["id"]] = doc
    return {k: v for k, v in doc.items() if k != "_id"}


def list_checkins_for_user(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    if _MONGO_AVAILABLE:
        cur = checkins_collection.find({"user_id": user_id}, {"_id": 0}).sort("created_at", DESCENDING).limit(limit)
        return list(cur)
    items = [c for c in _mem["checkins"].values() if c["user_id"] == user_id]
    items.sort(key=lambda c: c["created_at"], reverse=True)
    return items[:limit]


def list_all_checkins() -> List[Dict[str, Any]]:
    if _MONGO_AVAILABLE:
        return list(checkins_collection.find({}, {"_id": 0}))
    return list(_mem["checkins"].values())


def bulk_insert_checkins(docs: List[Dict[str, Any]]) -> None:
    if not docs:
        return
    if _MONGO_AVAILABLE:
        checkins_collection.insert_many(docs)
    else:
        for d in docs:
            _mem["checkins"][d["id"]] = d


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

def create_event(title: str, description: Optional[str], department_id: Optional[str], event_date: Optional[datetime]) -> Dict[str, Any]:
    doc = {
        "id": new_id(),
        "title": title,
        "description": description,
        "department_id": department_id,
        "event_date": event_date or _now(),
    }
    if _MONGO_AVAILABLE:
        events_collection.insert_one(doc)
    else:
        _mem["events"][doc["id"]] = doc
    return {k: v for k, v in doc.items() if k != "_id"}


def list_events() -> List[Dict[str, Any]]:
    if _MONGO_AVAILABLE:
        return list(events_collection.find({}, {"_id": 0}).sort("event_date", DESCENDING))
    return sorted(_mem["events"].values(), key=lambda e: e["event_date"], reverse=True)


def get_event(event_id: str) -> Optional[Dict[str, Any]]:
    if _MONGO_AVAILABLE:
        return events_collection.find_one({"id": event_id}, {"_id": 0})
    return _mem["events"].get(event_id)


# ---------------------------------------------------------------------------
# Destructive helpers (seeding only)
# ---------------------------------------------------------------------------

def drop_all():
    if _MONGO_AVAILABLE:
        users_collection.delete_many({})
        departments_collection.delete_many({})
        checkins_collection.delete_many({})
        events_collection.delete_many({})
    else:
        _mem["users"].clear()
        _mem["departments"].clear()
        _mem["checkins"].clear()
        _mem["events"].clear()
