"""FastAPI application entry point.

Startup guard: if SQLAlchemy cannot create the database tables the server
logs the exception to stderr and exits with code 1 so that the process
manager knows something went wrong rather than serving requests against a
broken database state.
"""

import sys

from fastapi import FastAPI

from database import Base, engine

app = FastAPI(title="Kanban Board API")

# ---------------------------------------------------------------------------
# Startup guard — SPEC §3: "if table creation fails, log to stderr and
# sys.exit(1) before Uvicorn serves any request."
# ---------------------------------------------------------------------------

try:
    Base.metadata.create_all(bind=engine)
except Exception as exc:  # noqa: BLE001
    print(f"FATAL: could not create database tables: {exc}", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Routers (registered here as they are implemented in later tasks)
# ---------------------------------------------------------------------------
# from routers import boards, lists, cards
# app.include_router(boards.router)
# app.include_router(lists.router)
# app.include_router(cards.router)


@app.get("/healthz", tags=["meta"])
def healthz():
    """Liveness probe — confirms the app started successfully."""
    return {"status": "ok"}
