--------------------------------------------------------------
#### NeuroNest_Sandbox_Template — Mood-O-Meter (DemoApp)
--------------------------------------------------------------

This is the Mood-O-Meter HR People Intelligence Platform, built on the
NeuroNest_Sandbox_Template. It gives employees a fast weekly pulse check and
gives HR a detailed, real-time sentiment + attrition-risk dashboard.

Two logins:
- **Employee** — takes the weekly pulse check (mood + 5 quick questions, ~15
  seconds), sees their own trend over time.
- **HR Admin** — sees the full statistics dashboard: org KPIs, a clickable
  department heat map, 12-week trend, mood distribution, AI-generated
  insights (with a rule-based fallback), attrition risk ranking with
  search/filter, a continuous actual-vs-forecast trend chart, CSV exports,
  an employee drill-down profile, and a fully working **Events** tab —
  record an initiative (even backdated) and expand it to see real
  before/after statistics computed from actual check-in history.

Folder layout
--------------------------------------------------------------

    NeuroNest_Sandbox_Template/
    ├── backend/
    │   └── DemoApp/
    │       ├── app.py                     FastAPI entrypoint (all routes)
    │       ├── settings.py                LLM / MongoDB / Milvus config
    │       ├── db_manager.py              MongoDB data-access layer (+ in-memory fallback)
    │       ├── auth.py                    JWT auth + password hashing
    │       ├── llm_client.py              NeuroVerse chat-completions wrapper (AI Insights)
    │       ├── schemas.py                 Pydantic request/response models
    │       ├── seed.py                    Demo data generator (90 days of history)
    │       ├── vector_database_creation.py  Milvus placeholder (reserved, unused today)
    │       └── requirements.txt
    └── frontend/
        ├── jsconfig.json
        ├── package.json
        ├── postcss.config.js
        ├── tailwind.config.js
        ├── public/
        │   └── index.html
        └── src/
            ├── App.js                     thin shell -> renders apps/DemoApp/App
            ├── index.js                   ReactDOM root + BrowserRouter (basename=PUBLIC_URL)
            ├── index.css                  Tailwind entrypoint
            └── apps/
                └── DemoApp/
                    ├── App.jsx            routes + AuthProvider — home for this project
                    ├── api/client.js
                    ├── context/AuthContext.jsx
                    ├── components/        Navbar, DepartmentHeatmap, PulseCheckFlow,
                    │                      EmployeeDrilldownModal, UI (KpiCard/RiskBadge/ScoreDial)
                    └── pages/             Login, Register, EmployeeDashboard, AdminDashboard

Everything specific to this project lives inside `src/apps/DemoApp/` —
components, pages, context, api client, all of it — per the NeuroNest
convention of keeping `App.js` / `index.js` as a stable, app-agnostic shell.

--------------------------------------------------------------
***** Mandatory Follow of Pre-requisite Processes *****
--------------------------------------------------------------

`backend/DemoApp/settings.py` is already filled in with the credentials
provided by the NeuroNest team for this sandbox:

- LLM (NeuroVerse, OpenAI-compatible): `openai_api_base`, `openai_api_key`
- MongoDB: `IDP_Platform_DB` (host/user/password already set)
- Milvus: reserved for future semantic search — not required for this app's
  current features, so it's wired up but unused (see
  `vector_database_creation.py`)

You generally don't need to edit `settings.py` — everything needed to run
in this sandbox is already there. If you're pointed at a different Mongo/
Milvus cluster, update the corresponding fields there (or override via a
`.env` file / real environment variables — see `Settings.Config` in
`settings.py`).

**Resilience note:** if MongoDB isn't reachable from wherever you're
running this (e.g. previewing outside the sandbox network), `db_manager.py`
automatically falls back to an in-memory store and the backend auto-seeds
demo data on startup — so the app is always demoable, even fully offline.
Once deployed inside the sandbox with real network access to the NeuroNest
Mongo cluster, it transparently uses MongoDB — no code changes required.
Same story for the LLM-generated "AI Insights" executive summary: if the
NeuroVerse endpoint is unreachable, it falls back to a clear rule-based
summary instead of breaking the dashboard.

---------------------------------------------------------------------------------

---------------------------------------------
Common Procedure of Opening Two Terminals
---------------------------------------------

Open two terminals inside your "Code-Server":

**Terminal 1 (backend):**

    cd backend/DemoApp
    pip install -r requirements.txt

    # Optional but recommended — populates 45 demo employees across 6
    # departments with 90 days of check-in history. Safe to skip: if you
    # skip it and Mongo is unreachable, the backend auto-seeds on startup
    # anyway. If Mongo IS reachable, run this once to seed real data.
    python seed.py

    uvicorn app:app --host 0.0.0.0 --port 8001

**Terminal 2 (frontend):**

    cd frontend
    npm install

    PUBLIC_URL=/code-{your_name}/proxy/6001/ npm run build

       eg- PUBLIC_URL=/code-ajay/proxy/6001/ npm run build

    npx serve -s build -l 6001

The frontend reads the backend URL from `frontend/.env`
(`REACT_APP_API_URL`, defaults to `http://localhost:8001`). Update this if
your backend is proxied at a different host/port in your sandbox.

For local development without the sandbox proxy, you can also just run:

    npm start          # frontend dev server on :3000, hot reload

--------------------------------------------------------------

Demo credentials (seeded by seed.py / auto-seed)
--------------------------------------------------------------

| Role     | Email                        | Password      |
|----------|-------------------------------|---------------|
| Admin/HR | admin@moodometer.io           | admin123      |
| Employee | employee@moodometer.io        | employee123   |

All other seeded employees use the password `password123`.

New employees can also self-register via "Create an account" on the login
page — these start with an empty history until they submit their first
pulse check. Since this is a demo, there's no weekly limit: employees can
check in as many times as they like to populate their trend chart quickly.

--------------------------------------------------------------

API surface (all routes prefixed `/DemoApp`)
--------------------------------------------------------------

    POST /DemoApp/auth/register
    POST /DemoApp/auth/login
    GET  /DemoApp/me
    GET  /DemoApp/departments
    GET  /DemoApp/system/status              Mongo/LLM connectivity badge

    GET  /DemoApp/questions/weekly
    GET  /DemoApp/checkins/status
    POST /DemoApp/checkins
    GET  /DemoApp/checkins/me

    GET  /DemoApp/admin/dashboard            KPIs, heat map, 12-wk trend, mood mix
    GET  /DemoApp/admin/insights             rule-based signals + LLM executive summary
    GET  /DemoApp/admin/attrition            ?department_id=&risk_level=&search=
    GET  /DemoApp/admin/employee/{user_id}   full profile + check-in history
    GET  /DemoApp/admin/export/attrition.csv
    GET  /DemoApp/admin/export/departments.csv
    POST /DemoApp/admin/events
    GET  /DemoApp/admin/events
    GET  /DemoApp/admin/events/{event_id}/impact  before/after stats since the event

Interactive API docs are available at `http://localhost:8001/docs` once the
backend is running.

--------------------------------------------------------------

Notes on the demo data
--------------------------------------------------------------

`seed.py` deliberately injects a synthetic decline into the **Supply
Chain** department over the most recent 4 weeks (lower workload health,
lower leadership trust, lower motivation), so AI Insights and Attrition
Prediction have something real to surface immediately. A matching "Supply
Chain Reorg Announcement" event is seeded for the Events tab.

--------------------------------------------------------------

Security notes (for production hardening)
--------------------------------------------------------------

This is a working prototype, not production-hardened:
- JWT secret is hardcoded in `auth.py` — move to an environment variable.
- CORS is wide open (`allow_origins=["*"]`) — restrict to your frontend's origin.
- Add rate limiting, password strength rules, and email verification before shipping.
- `settings.py` contains real sandbox credentials for convenience — move
  secrets to environment variables / a secrets manager before any
  production deployment.
