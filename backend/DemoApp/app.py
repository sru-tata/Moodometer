"""app.py

Mood-O-Meter backend entrypoint.

Run with:
    uvicorn app:app --host 0.0.0.0 --port 8001
"""

import csv
import io
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import auth
import db_manager
import llm_client
from schemas import CheckInCreate, EventCreate, LoginRequest, MOOD_SCORE, UserCreate
from settings import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Mood-O-Meter API", root_path_in_servers=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INDEX_FIELDS = ["motivation_index", "growth_index", "leadership_index", "workload_index", "belonging_index"]
INDEX_LABELS = {
    "motivation_index": "Motivation",
    "growth_index": "Growth",
    "leadership_index": "Leadership Trust",
    "workload_index": "Workload Health",
    "belonging_index": "Belonging",
}

WEEKLY_QUESTIONS = [
    {"key": "workload_q", "text": "How manageable is your current workload?", "hint": "1 = overwhelming, 5 = very manageable", "index": "Workload Index"},
    {"key": "recognition_q", "text": "Do you feel recognized for your work?", "hint": "1 = never, 5 = always", "index": "Motivation Index"},
    {"key": "growth_q", "text": "Do you feel you're growing in your career here?", "hint": "1 = not at all, 5 = strongly", "index": "Growth Index"},
    {"key": "leadership_q", "text": "How confident are you in leadership?", "hint": "1 = not confident, 5 = very confident", "index": "Leadership Trust Index"},
    {"key": "recommend_q", "text": "How likely are you to recommend this workplace to a friend?", "hint": "1 = not likely, 5 = extremely likely", "index": "Belonging Index"},
]

MOODS = ["Energized", "Motivated", "Neutral", "Stressed", "Frustrated"]


@app.on_event("startup")
def _auto_seed_if_needed():
    """If Mongo is unreachable, db_manager silently falls back to an
    in-memory store scoped to this process. Since the seed script normally
    runs as a separate process, its data would never reach the live server
    in that fallback case — so we auto-seed once here, in-process, purely
    for local/offline demo convenience. This never touches a real,
    reachable MongoDB (it only fires when running on the fallback store),
    and it never overwrites existing data."""
    if db_manager.mongo_available():
        return
    if db_manager.list_users():
        return
    logger.info("Mongo unreachable — auto-seeding in-memory demo data for local preview.")
    import seed
    seed.run()


def _public_user(u: dict) -> dict:
    dept = db_manager.get_department(u.get("department_id")) if u.get("department_id") else None
    return {
        "id": u["id"],
        "email": u["email"],
        "full_name": u["full_name"],
        "role": u["role"],
        "department": dept,
    }


def _issue_token(user: dict) -> dict:
    token = auth.create_access_token({"sub": user["id"]})
    return {"access_token": token, "token_type": "bearer", "user": _public_user(user)}


def _checkin_score(payload: CheckInCreate) -> dict:
    mood_score = MOOD_SCORE[payload.mood]
    return {
        "mood": payload.mood,
        "workload_q": payload.workload_q,
        "recognition_q": payload.recognition_q,
        "growth_q": payload.growth_q,
        "leadership_q": payload.leadership_q,
        "recommend_q": payload.recommend_q,
        "motivation_index": round(0.6 * mood_score + 0.2 * payload.recommend_q * 20 + 0.2 * payload.recognition_q * 20, 1),
        "growth_index": round(payload.growth_q * 20, 1),
        "leadership_index": round(payload.leadership_q * 20, 1),
        "workload_index": round(payload.workload_q * 20, 1),  # 1=overwhelming, 5=very manageable -> higher = healthier
        "belonging_index": round(0.5 * payload.recommend_q * 20 + 0.5 * mood_score, 1),
    }


def _avg_indices(checkins: List[dict]) -> dict:
    if not checkins:
        return {f: None for f in INDEX_FIELDS}
    out = {}
    for f in INDEX_FIELDS:
        vals = [c[f] for c in checkins]
        out[f] = round(sum(vals) / len(vals), 1)
    return out


def _overall(avg: dict) -> Optional[float]:
    vals = [v for v in avg.values() if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


def _as_dt(value) -> datetime:
    """Normalize Mongo/py datetimes (which may be naive) to aware UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.post("/DemoApp/auth/register")
def register(payload: UserCreate):
    if db_manager.get_user_by_email(payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = db_manager.create_user(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=auth.hash_password(payload.password),
        role="user",
        department_id=payload.department_id,
    )
    return _issue_token(user)


@app.post("/DemoApp/auth/login")
def login(payload: LoginRequest):
    user = db_manager.get_user_by_email(payload.email)
    if not user or not auth.verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return _issue_token(user)


@app.get("/DemoApp/me")
def read_me(current_user: dict = Depends(auth.get_current_user)):
    return _public_user(current_user)


@app.get("/DemoApp/departments")
def list_departments():
    return db_manager.list_departments()


@app.get("/DemoApp/system/status")
def system_status():
    """Lets the frontend show a small badge if Mongo is unreachable and the
    demo is running on the in-memory fallback store."""
    return {
        "mongo_connected": db_manager.mongo_available(),
        "llm_configured": llm_client.is_configured(),
        "db_name": settings.mongo_db_name,
    }


# ---------------------------------------------------------------------------
# Employee: weekly pulse check
# ---------------------------------------------------------------------------

@app.get("/DemoApp/questions/weekly")
def get_weekly_questions():
    return {"moods": MOODS, "questions": WEEKLY_QUESTIONS}


@app.get("/DemoApp/checkins/status")
def checkin_status(current_user: dict = Depends(auth.get_current_user)):
    """Informational only — demo mode allows unlimited check-ins so it can be tried anytime."""
    history = db_manager.list_checkins_for_user(current_user["id"], limit=1)
    return {"last_checkin": history[0] if history else None}


@app.post("/DemoApp/checkins")
def create_checkin(payload: CheckInCreate, current_user: dict = Depends(auth.get_current_user)):
    fields = _checkin_score(payload)
    return db_manager.create_checkin(current_user["id"], fields)


@app.get("/DemoApp/checkins/me")
def my_checkins(current_user: dict = Depends(auth.get_current_user)):
    return db_manager.list_checkins_for_user(current_user["id"], limit=50)


# ---------------------------------------------------------------------------
# Admin: dashboard
# ---------------------------------------------------------------------------

@app.get("/DemoApp/admin/dashboard")
def admin_dashboard(_admin: dict = Depends(auth.require_admin)):
    all_checkins = db_manager.list_all_checkins()
    total_users = len(db_manager.list_users(role="user"))
    now = datetime.now(timezone.utc)

    participants_last_7d = {
        c["user_id"] for c in all_checkins if _as_dt(c["created_at"]) >= now - timedelta(days=7)
    }
    participation_rate = round((len(participants_last_7d) / total_users) * 100, 1) if total_users else 0

    org_indices = _avg_indices(all_checkins)
    wellbeing_score = _overall(org_indices)

    mood_dist = defaultdict(int)
    for c in all_checkins:
        mood_dist[c["mood"]] += 1

    departments = db_manager.list_departments()
    users = db_manager.list_users(role="user")
    users_by_dept = defaultdict(list)
    for u in users:
        if u.get("department_id"):
            users_by_dept[u["department_id"]].append(u["id"])

    heatmap = []
    for dept in departments:
        dept_user_ids = set(users_by_dept.get(dept["id"], []))
        if not dept_user_ids:
            continue
        recent = [c for c in all_checkins if c["user_id"] in dept_user_ids and _as_dt(c["created_at"]) >= now - timedelta(days=30)]
        prior = [
            c for c in all_checkins
            if c["user_id"] in dept_user_ids
            and now - timedelta(days=60) <= _as_dt(c["created_at"]) < now - timedelta(days=30)
        ]
        recent_avg = _avg_indices(recent)
        prior_avg = _avg_indices(prior)
        overall_recent = _overall(recent_avg)
        overall_prior = _overall(prior_avg)

        heatmap.append({
            "department": dept["name"],
            "department_id": dept["id"],
            "headcount": len(dept_user_ids),
            "indices": recent_avg,
            "overall_score": overall_recent,
            "overall_score_prior": overall_prior,
            "trend": (round(overall_recent - overall_prior, 1) if overall_recent is not None and overall_prior is not None else None),
            "participants_30d": len({c["user_id"] for c in recent}),
        })
    heatmap.sort(key=lambda d: (d["overall_score"] is None, d["overall_score"]))

    trend = []
    for i in range(11, -1, -1):
        week_start = now - timedelta(days=7 * (i + 1))
        week_end = now - timedelta(days=7 * i)
        week_checkins = [c for c in all_checkins if week_start <= _as_dt(c["created_at"]) < week_end]
        avg = _avg_indices(week_checkins)
        trend.append({
            "week": week_start.strftime("%b %d"),
            "overall_score": _overall(avg),
            "participants": len({c["user_id"] for c in week_checkins}),
            **avg,
        })

    return {
        "total_employees": total_users,
        "participation_rate": participation_rate,
        "wellbeing_score": wellbeing_score,
        "org_indices": org_indices,
        "mood_distribution": mood_dist,
        "department_heatmap": heatmap,
        "trend": trend,
        "total_checkins": len(all_checkins),
    }


# ---------------------------------------------------------------------------
# Admin: AI-powered insights (rule-based structured insights + LLM narrative)
# ---------------------------------------------------------------------------

def _department_insights() -> list:
    departments = db_manager.list_departments()
    users = db_manager.list_users(role="user")
    users_by_dept = defaultdict(list)
    for u in users:
        if u.get("department_id"):
            users_by_dept[u["department_id"]].append(u["id"])

    all_checkins = db_manager.list_all_checkins()
    now = datetime.now(timezone.utc)
    insights = []

    factor_map = {
        "workload_q": "workload pressure",
        "recognition_q": "lack of recognition",
        "growth_q": "limited growth opportunity",
        "leadership_q": "communication clarity",
        "recommend_q": "overall advocacy",
    }

    for dept in departments:
        dept_user_ids = set(users_by_dept.get(dept["id"], []))
        if not dept_user_ids:
            continue
        recent = [c for c in all_checkins if c["user_id"] in dept_user_ids and _as_dt(c["created_at"]) >= now - timedelta(days=30)]
        prior = [
            c for c in all_checkins
            if c["user_id"] in dept_user_ids
            and now - timedelta(days=60) <= _as_dt(c["created_at"]) < now - timedelta(days=30)
        ]
        if not recent or not prior:
            continue
        recent_avg = _avg_indices(recent)
        prior_avg = _avg_indices(prior)

        biggest_field, biggest_delta_pct = None, 0
        for f in INDEX_FIELDS:
            if recent_avg[f] is None or prior_avg[f] is None or prior_avg[f] == 0:
                continue
            delta_pct = round(((recent_avg[f] - prior_avg[f]) / prior_avg[f]) * 100, 1)
            if abs(delta_pct) > abs(biggest_delta_pct):
                biggest_delta_pct = delta_pct
                biggest_field = f

        if biggest_field and abs(biggest_delta_pct) >= 8:
            label = INDEX_LABELS[biggest_field]
            direction = "declined" if biggest_delta_pct < 0 else "improved"

            raw_avgs = {}
            for q in factor_map:
                vals = [c[q] for c in recent]
                raw_avgs[q] = sum(vals) / len(vals) if vals else 3
            worst_qs = sorted(raw_avgs.items(), key=lambda x: x[1])[:3]
            factors = ", ".join(f"{factor_map[q]} ({round((5 - v) / 5 * 100)}% concern)" for q, v in worst_qs)

            severity = "high" if abs(biggest_delta_pct) >= 15 else "medium"
            insights.append({
                "department": dept["name"],
                "department_id": dept["id"],
                "headline": f"{label} {direction} {abs(biggest_delta_pct)}% in {dept['name']}",
                "detail": f"Key concerns: {factors}.",
                "severity": severity,
                "recommended_action": _recommended_action(biggest_field, direction),
            })

    insights.sort(key=lambda x: 0 if x["severity"] == "high" else 1)
    return insights


def _recommended_action(field: str, direction: str) -> str:
    if direction == "improved":
        return "Momentum is positive here — consider documenting what changed and replicating it in similar teams."
    actions = {
        "motivation_index": "Schedule 1:1 pulse conversations and review recognition programs with team leads.",
        "growth_index": "Audit learning/development access and open a career-pathing conversation with managers.",
        "leadership_index": "Run a leadership listening session; prioritize transparent updates on open questions.",
        "workload_index": "Review current sprint/project load and headcount allocation for this team.",
        "belonging_index": "Invest in team-building touchpoints and check for silent attrition signals.",
    }
    return actions.get(field, "Flag to HRBP for a closer review.")


@app.get("/DemoApp/admin/insights")
def admin_insights(_admin: dict = Depends(auth.require_admin)):
    insights = _department_insights()

    # Build a compact data context and ask the LLM for an executive summary.
    all_checkins = db_manager.list_all_checkins()
    org_avg = _avg_indices(all_checkins)
    overall = _overall(org_avg)
    context_lines = [f"Org-wide wellbeing score: {overall}/100."]
    for f in INDEX_FIELDS:
        context_lines.append(f"{INDEX_LABELS[f]}: {org_avg[f]}/100.")
    for ins in insights[:5]:
        context_lines.append(f"{ins['department']}: {ins['headline']}. {ins['detail']}")
    context = "\n".join(context_lines)

    fallback_summary = (
        f"Org-wide wellbeing score is {overall}/100." if overall is not None else "Not enough data yet."
    )
    if insights:
        top = insights[0]
        fallback_summary += f" The most urgent signal is in {top['department']}: {top['headline']}."

    narrative, used_llm = llm_client.generate_narrative(context, fallback_summary)

    return {
        "insights": insights,
        "executive_summary": narrative,
        "llm_generated": used_llm,
    }


# ---------------------------------------------------------------------------
# Admin: attrition prediction
# ---------------------------------------------------------------------------

def _attrition_rows(department_id: Optional[str] = None, min_risk: Optional[str] = None, search: Optional[str] = None) -> list:
    users = db_manager.list_users(role="user")
    now = datetime.now(timezone.utc)
    all_checkins = db_manager.list_all_checkins()
    checkins_by_user = defaultdict(list)
    for c in all_checkins:
        checkins_by_user[c["user_id"]].append(c)

    results = []
    for u in users:
        if department_id and u.get("department_id") != department_id:
            continue
        if search and search.lower() not in u["full_name"].lower() and search.lower() not in u["email"].lower():
            continue

        user_checkins = checkins_by_user.get(u["id"], [])
        recent = [c for c in user_checkins if _as_dt(c["created_at"]) >= now - timedelta(days=30)]
        prior = [c for c in user_checkins if now - timedelta(days=60) <= _as_dt(c["created_at"]) < now - timedelta(days=30)]
        if not recent:
            continue
        recent_avg = _avg_indices(recent)
        prior_avg = _avg_indices(prior) if prior else recent_avg

        sentiment_component = 100 - (sum(v for v in recent_avg.values() if v is not None) / max(len([v for v in recent_avg.values() if v is not None]), 1))
        decline_component = 0
        for f in INDEX_FIELDS:
            if recent_avg[f] is not None and prior_avg[f] is not None:
                decline_component += max(0, prior_avg[f] - recent_avg[f])
        decline_component = min(decline_component, 100)

        hr_component = (
            (u.get("absenteeism_days", 0) * 2)
            + max(0, (50 - u.get("learning_participation", 50)) * 0.6)
            + max(0, (3.0 - u.get("performance_rating", 3.0)) * 15)
        )
        hr_component = min(hr_component, 100)

        risk_score = round(0.45 * sentiment_component + 0.35 * decline_component + 0.20 * hr_component, 1)
        risk_score = max(0, min(100, risk_score))

        if risk_score >= 65:
            risk_level = "High"
        elif risk_score >= 40:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        if min_risk and risk_level != min_risk:
            continue

        dept = db_manager.get_department(u.get("department_id"))
        results.append({
            "user_id": u["id"],
            "full_name": u["full_name"],
            "email": u["email"],
            "department": dept["name"] if dept else "Unassigned",
            "department_id": u.get("department_id"),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "tenure_months": u.get("tenure_months", 0),
            "absenteeism_days": u.get("absenteeism_days", 0),
            "learning_participation": u.get("learning_participation", 0),
            "performance_rating": u.get("performance_rating", 0),
            "indices": recent_avg,
        })

    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return results


@app.get("/DemoApp/admin/attrition")
def admin_attrition(
    _admin: dict = Depends(auth.require_admin),
    department_id: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    results = _attrition_rows(department_id, risk_level, search)
    all_checkins = db_manager.list_all_checkins()
    now = datetime.now(timezone.utc)

    weekly_scores = []
    weekly_history = []
    for i in range(7, -1, -1):
        ws = now - timedelta(days=7 * (i + 1))
        we = now - timedelta(days=7 * i)
        wc = [c for c in all_checkins if ws <= _as_dt(c["created_at"]) < we]
        if wc:
            vals = [c[f] for c in wc for f in INDEX_FIELDS]
            avg = sum(vals) / len(vals)
            weekly_scores.append(avg)
            weekly_history.append({"week": ws.strftime("%b %d"), "score": round(avg, 1)})
    forecast = []
    if len(weekly_scores) >= 2:
        deltas = [weekly_scores[i + 1] - weekly_scores[i] for i in range(len(weekly_scores) - 1)]
        avg_delta = sum(deltas) / len(deltas)
        last = weekly_scores[-1]
        for i in range(4):
            last = last + avg_delta
            future_week = now + timedelta(days=7 * i)
            forecast.append({"week": f"+{i + 1}w", "score": round(max(0, min(100, last)), 1)})

    all_results = _attrition_rows()  # unfiltered, for accurate counts
    return {
        "employees": results,
        "high_risk_count": len([r for r in all_results if r["risk_level"] == "High"]),
        "medium_risk_count": len([r for r in all_results if r["risk_level"] == "Medium"]),
        "low_risk_count": len([r for r in all_results if r["risk_level"] == "Low"]),
        "weekly_history": weekly_history[-6:],
        "org_forecast_next_4_weeks": [f["score"] for f in forecast],
        "forecast_series": forecast,
    }


@app.get("/DemoApp/admin/employee/{user_id}")
def admin_employee_detail(user_id: str, _admin: dict = Depends(auth.require_admin)):
    user = db_manager.get_user_by_id(user_id)
    if not user or user.get("role") != "user":
        raise HTTPException(status_code=404, detail="Employee not found")

    dept = db_manager.get_department(user.get("department_id"))
    checkins = db_manager.list_checkins_for_user(user_id, limit=100)
    checkins_sorted = sorted(checkins, key=lambda c: c["created_at"])

    attrition_row = next((r for r in _attrition_rows() if r["user_id"] == user_id), None)

    return {
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "department": dept,
            "tenure_months": user.get("tenure_months", 0),
            "absenteeism_days": user.get("absenteeism_days", 0),
            "learning_participation": user.get("learning_participation", 0),
            "performance_rating": user.get("performance_rating", 0),
        },
        "checkins": checkins_sorted,
        "attrition": attrition_row,
        "average_indices": _avg_indices(checkins),
    }


# ---------------------------------------------------------------------------
# Admin: CSV exports (HR utilities)
# ---------------------------------------------------------------------------

@app.get("/DemoApp/admin/export/attrition.csv")
def export_attrition_csv(_admin: dict = Depends(auth.require_admin)):
    rows = _attrition_rows()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Full Name", "Email", "Department", "Risk Level", "Risk Score",
        "Tenure (months)", "Absenteeism (days)", "Learning Participation (%)",
        "Performance Rating", "Motivation", "Growth", "Leadership Trust", "Workload Health", "Belonging",
    ])
    for r in rows:
        idx = r["indices"]
        writer.writerow([
            r["full_name"], r["email"], r["department"], r["risk_level"], r["risk_score"],
            r["tenure_months"], r["absenteeism_days"], r["learning_participation"], r["performance_rating"],
            idx.get("motivation_index"), idx.get("growth_index"), idx.get("leadership_index"),
            idx.get("workload_index"), idx.get("belonging_index"),
        ])
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attrition_risk_report.csv"},
    )


@app.get("/DemoApp/admin/export/departments.csv")
def export_departments_csv(_admin: dict = Depends(auth.require_admin)):
    dashboard = admin_dashboard(_admin)  # reuse computed heatmap
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Department", "Headcount", "Overall Score", "Overall Score (Prior Month)", "Trend",
        "Motivation", "Growth", "Leadership Trust", "Workload Health", "Belonging",
    ])
    for d in dashboard["department_heatmap"]:
        idx = d["indices"]
        writer.writerow([
            d["department"], d["headcount"], d["overall_score"], d["overall_score_prior"], d["trend"],
            idx.get("motivation_index"), idx.get("growth_index"), idx.get("leadership_index"),
            idx.get("workload_index"), idx.get("belonging_index"),
        ])
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=department_scorecard.csv"},
    )


# ---------------------------------------------------------------------------
# Admin: events (before/after impact analysis)
# ---------------------------------------------------------------------------

@app.post("/DemoApp/admin/events")
def create_event(payload: EventCreate, _admin: dict = Depends(auth.require_admin)):
    return db_manager.create_event(payload.title, payload.description, payload.department_id, payload.event_date)


@app.get("/DemoApp/admin/events")
def list_events(_admin: dict = Depends(auth.require_admin)):
    return db_manager.list_events()


@app.get("/DemoApp/admin/events/{event_id}/impact")
def event_impact(event_id: str, _admin: dict = Depends(auth.require_admin)):
    """Before/after analysis for a single event: compares the 30 days
    leading up to the event against everything recorded since, scoped to
    the event's department (or org-wide if none was set)."""
    event = db_manager.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    now = datetime.now(timezone.utc)
    event_date = _as_dt(event["event_date"])
    dept = db_manager.get_department(event.get("department_id")) if event.get("department_id") else None

    checkins = db_manager.list_all_checkins()
    if dept:
        users = db_manager.list_users(role="user")
        scope_user_ids = {u["id"] for u in users if u.get("department_id") == dept["id"]}
        checkins = [c for c in checkins if c["user_id"] in scope_user_ids]

    before_start = event_date - timedelta(days=30)
    before = [c for c in checkins if before_start <= _as_dt(c["created_at"]) < event_date]
    after = [c for c in checkins if event_date <= _as_dt(c["created_at"]) <= now]

    before_avg = _avg_indices(before)
    after_avg = _avg_indices(after)
    before_overall = _overall(before_avg)
    after_overall = _overall(after_avg)

    deltas = {}
    for f in INDEX_FIELDS:
        if before_avg[f] is not None and after_avg[f] is not None:
            deltas[f] = round(after_avg[f] - before_avg[f], 1)
        else:
            deltas[f] = None

    # Build a single continuous weekly timeline spanning before_start -> now,
    # so the frontend can draw one chart with a reference line at the event.
    timeline = []
    cursor = before_start
    while cursor <= now:
        week_end = min(cursor + timedelta(days=7), now + timedelta(seconds=1))
        week_checkins = [c for c in checkins if cursor <= _as_dt(c["created_at"]) < week_end]
        avg = _avg_indices(week_checkins)
        timeline.append({
            "date": cursor.strftime("%b %d"),
            "score": _overall(avg),
            "period": "before" if cursor < event_date else "after",
        })
        cursor = week_end

    days_since = max(0, (now - event_date).days)

    return {
        "event": event,
        "scope": dept["name"] if dept else "Organization-wide",
        "days_since_event": days_since,
        "before": {
            "indices": before_avg,
            "overall_score": before_overall,
            "checkin_count": len(before),
            "participant_count": len({c["user_id"] for c in before}),
            "window_label": f"{before_start.strftime('%b %d')} – {event_date.strftime('%b %d')} (30d prior)",
        },
        "after": {
            "indices": after_avg,
            "overall_score": after_overall,
            "checkin_count": len(after),
            "participant_count": len({c["user_id"] for c in after}),
            "window_label": f"{event_date.strftime('%b %d')} – {now.strftime('%b %d')} (since event)",
        },
        "deltas": deltas,
        "overall_delta": (round(after_overall - before_overall, 1) if before_overall is not None and after_overall is not None else None),
        "timeline": timeline,
    }
