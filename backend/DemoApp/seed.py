"""Seed the database with demo departments, users, and 90 days of check-in
history so the dashboards have meaningful data immediately.

Run with: python seed.py
"""
import random
import uuid
from datetime import datetime, timedelta, timezone

import db_manager
import auth

random.seed(42)

DEPARTMENTS = ["Supply Chain", "Engineering", "Sales", "Customer Support", "HR & People", "Finance"]

FIRST_NAMES = ["Aarav", "Priya", "Rohan", "Neha", "Vikram", "Ananya", "Karan", "Isha",
               "Arjun", "Meera", "Sanjay", "Divya", "Rahul", "Pooja", "Aditya", "Kavya",
               "Manish", "Riya", "Suresh", "Tanya", "Nikhil", "Sneha", "Amit", "Shreya"]
LAST_NAMES = ["Sharma", "Patel", "Reddy", "Iyer", "Gupta", "Nair", "Menon", "Kapoor",
              "Rao", "Chatterjee", "Verma", "Joshi"]

MOOD_SCORE = {
    "Energized": 100, "Motivated": 80, "Neutral": 60, "Stressed": 35, "Frustrated": 15,
}


def build_checkin_fields(week_start, dept_stress_bias=0.0, decline_dept=False, weeks_ago=0):
    trouble = decline_dept and weeks_ago <= 4
    base_mood_idx = random.random() + (0.35 if trouble else 0) + dept_stress_bias

    if base_mood_idx > 0.85:
        mood = "Frustrated"
    elif base_mood_idx > 0.65:
        mood = "Stressed"
    elif base_mood_idx > 0.4:
        mood = "Neutral"
    elif base_mood_idx > 0.15:
        mood = "Motivated"
    else:
        mood = "Energized"

    def q(good_base):
        val = good_base - (2 if trouble else 0) - (1 if dept_stress_bias > 0.15 else 0)
        val += random.choice([-1, 0, 0, 1])
        return max(1, min(5, val))

    workload_q = q(4)
    recognition_q = q(4)
    growth_q = q(4)
    leadership_q = q(4)
    recommend_q = q(4)

    mood_score = MOOD_SCORE[mood]
    motivation_index = round(0.6 * mood_score + 0.2 * recommend_q * 20 + 0.2 * recognition_q * 20, 1)
    growth_index = round(growth_q * 20, 1)
    leadership_index = round(leadership_q * 20, 1)
    workload_index = round(workload_q * 20, 1)
    belonging_index = round(0.5 * recommend_q * 20 + 0.5 * mood_score, 1)

    created_at = week_start + timedelta(days=random.randint(0, 4), hours=random.randint(8, 18))

    return dict(
        mood=mood,
        workload_q=workload_q, recognition_q=recognition_q, growth_q=growth_q,
        leadership_q=leadership_q, recommend_q=recommend_q,
        motivation_index=motivation_index, growth_index=growth_index,
        leadership_index=leadership_index, workload_index=workload_index,
        belonging_index=belonging_index, created_at=created_at,
    )


def run():
    print(f"Data store: {'MongoDB' if db_manager.mongo_available() else 'in-memory fallback (Mongo unreachable from this environment)'}")
    db_manager.drop_all()

    departments = {}
    for name in DEPARTMENTS:
        departments[name] = db_manager.create_department(name)

    admin = db_manager.create_user(
        email="admin@moodometer.io",
        full_name="HR Admin",
        hashed_password=auth.hash_password("admin123"),
        role="admin",
    )

    demo_user = db_manager.create_user(
        email="employee@moodometer.io",
        full_name="Demo Employee",
        hashed_password=auth.hash_password("employee123"),
        role="user",
        department_id=departments["Supply Chain"]["id"],
        tenure_months=18, absenteeism_days=2, learning_participation=60, performance_rating=3.8,
    )

    all_users = [demo_user]
    name_idx = 0
    for dept_name, dept in departments.items():
        n_employees = random.randint(6, 10)
        for _ in range(n_employees):
            fn = FIRST_NAMES[name_idx % len(FIRST_NAMES)]
            ln = LAST_NAMES[name_idx % len(LAST_NAMES)]
            name_idx += 1
            email = f"{fn.lower()}.{ln.lower()}{name_idx}@moodometer.io"
            user = db_manager.create_user(
                email=email,
                full_name=f"{fn} {ln}",
                hashed_password=auth.hash_password("password123"),
                role="user",
                department_id=dept["id"],
                tenure_months=random.randint(2, 60),
                absenteeism_days=random.randint(0, 12),
                learning_participation=random.randint(10, 95),
                performance_rating=round(random.uniform(2.2, 4.8), 1),
            )
            all_users.append(user)

    decline_departments = {"Supply Chain"}
    now = datetime.now(timezone.utc)

    checkin_docs = []
    for user in all_users:
        dept = db_manager.get_department(user.get("department_id")) if user.get("department_id") else None
        dept_name = dept["name"] if dept else None
        dept_bias = 0.2 if dept_name == "Supply Chain" else (0.1 if dept_name == "Customer Support" else 0.0)
        decline = dept_name in decline_departments
        for weeks_ago in range(12, -1, -1):
            if random.random() < 0.15:
                continue
            week_start = now - timedelta(days=7 * (weeks_ago + 1))
            fields = build_checkin_fields(week_start, dept_stress_bias=dept_bias, decline_dept=decline, weeks_ago=weeks_ago)
            doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **fields}
            checkin_docs.append(doc)

    db_manager.bulk_insert_checkins(checkin_docs)

    db_manager.create_event(
        title="Supply Chain Reorg Announcement",
        description="Restructuring of supply chain leadership and reporting lines.",
        department_id=departments["Supply Chain"]["id"],
        event_date=now - timedelta(days=25),
    )

    print(f"Seeded {len(all_users)} users across {len(departments)} departments with {len(checkin_docs)} check-ins.")
    print("Admin login: admin@moodometer.io / admin123")
    print("Employee login: employee@moodometer.io / employee123")


if __name__ == "__main__":
    run()
