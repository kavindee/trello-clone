"""FastAPI application entry point.

Boot sequence
-------------
1. load_dotenv() — MUST be the first side-effecting call so that any local
   module that reads os.getenv() at import time (e.g. database.py) sees the
   values from the .env file.
2. Create the FastAPI app instance.
3. Register CORSMiddleware — origin read from CORS_ORIGIN env var.
4. Startup guard — Base.metadata.create_all() wrapped in try/except; on
   failure the exception is logged to stderr and sys.exit(1) is called so
   the process manager knows not to route traffic to this instance.
5. Register routers.
"""

import os
import sys

from dotenv import load_dotenv

# ── Step 1: load .env BEFORE any local import that reads os.getenv() ──────
load_dotenv()

from fastapi import FastAPI                          # noqa: E402
from fastapi.middleware.cors import CORSMiddleware   # noqa: E402

from sqlalchemy import text                          # noqa: E402

from database import Base, engine                    # noqa: E402
from routers import boards, lists, cards             # noqa: E402

# ── Step 2: application instance ──────────────────────────────────────────
app = FastAPI(title="Kanban Board API")

# ── Step 3: CORS ──────────────────────────────────────────────────────────
_cors_origin: str = os.getenv("CORS_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Step 4: startup guard ─────────────────────────────────────────────────
try:
    Base.metadata.create_all(bind=engine)
except Exception as exc:  # noqa: BLE001
    print(f"FATAL: could not create database tables: {exc}", file=sys.stderr)
    sys.exit(1)

# ── Step 4b: add columns to existing databases ────────────────────────────
# create_all does NOT add columns to pre-existing tables; these ALTER TABLE
# statements are idempotent — SQLite raises OperationalError when a column
# already exists, which we intentionally ignore.
_MIGRATIONS = [
    # Lists keep their own deadline column (unchanged).
    "ALTER TABLE lists ADD COLUMN deadline DATE",
    # Cards: description, start_date, due_date supersede the old deadline col.
    "ALTER TABLE cards ADD COLUMN description TEXT",
    "ALTER TABLE cards ADD COLUMN start_date DATE",
    "ALTER TABLE cards ADD COLUMN due_date DATE",
]
with engine.connect() as _conn:
    for _stmt in _MIGRATIONS:
        try:
            _conn.execute(text(_stmt))
            _conn.commit()
        except Exception:  # noqa: BLE001
            pass  # column already exists — safe to ignore

# ── Step 5: routers ───────────────────────────────────────────────────────
app.include_router(boards.router)
app.include_router(lists.router)
app.include_router(cards.router)


# ── Meta ──────────────────────────────────────────────────────────────────
@app.get("/healthz", tags=["meta"])
def healthz():
    """Liveness probe — confirms the app started successfully."""
    return {"status": "ok"}
