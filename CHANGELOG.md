# Changelog

All notable changes to this project are documented here.

---

## [Unreleased]

### Task 1 — Project Scaffolding + DB Layer (2026-03-16)

**Added**
- `backend/requirements.txt` — pinned dependencies: fastapi, uvicorn[standard],
  sqlalchemy, pydantic, pytest, httpx, python-dotenv.
- `backend/database.py` — SQLAlchemy engine (`sqlite:///./kanban.db`),
  `SessionLocal`, declarative `Base`, and `get_db()` dependency.
- `backend/models.py` — ORM models `Board`, `List`, `Card` with all columns
  from PLAN.md schema (id, name/title, position, board_id/list_id, created_at).
- `backend/schemas.py` — Pydantic v2 schemas: `BoardCreate`, `BoardResponse`,
  `ListCreate`, `ListResponse`, `CardCreate`, `CardPatch`, `CardResponse`.
  Validators reject blank/whitespace, newlines (`\n`, `\r`), and strings >255 chars.
- `backend/main.py` — FastAPI app skeleton with startup guard:
  `Base.metadata.create_all()` wrapped in `try/except`; logs to stderr and
  calls `sys.exit(1)` on failure. `/healthz` liveness probe.
- `backend/routers/__init__.py` — empty package marker for future routers.
- `backend/tests/__init__.py` — empty package marker.
- `backend/tests/conftest.py` — in-memory SQLite test engine, `create_test_tables`
  session-scoped fixture, transactional `db` fixture (rollback per test),
  `client` fixture (TestClient with `get_db` override).
- `backend/tests/test_smoke.py` — 21 smoke tests verifying table existence,
  ORM column sets, all Pydantic schema validations, `/healthz` 200, and DB session.

**Verified**
- `pytest backend/tests/` → 21 passed, 0 errors
- `python -c "import main"` → `kanban.db` created (16 384 bytes)
- Simulated `create_all` failure → stderr log + `sys.exit(1)`
