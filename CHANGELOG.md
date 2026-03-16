# Changelog

All notable changes to this project are documented here.

---

## [Unreleased]

### Task 3 — Lists API (2026-03-16)

**Added**
- `backend/routers/lists.py` — 3 endpoints:
  - `GET  /boards/{id}/lists`  → 200 ordered `position ASC`; 404 if board missing
  - `POST /boards/{id}/lists`  → 201; `position = COUNT(existing lists)` (0-based
    append); full name validation via `ListCreate`; 404 if board missing
  - `DELETE /lists/{id}`       → 204 / 404 / 500 on cascade failure; explicit
    Python-level cascade via `_cascade_delete_list()` (patchable for EC2/AC16)
- `backend/tests/test_lists.py` — 32 tests: all 3 endpoints, position ordering,
  no-reindex-after-delete, 422 validation (9 cases), 404s, cascade (EC2), EC6
  (delete-only-list keeps board alive and GET lists returns `[]` not 404).
- `backend/tests/test_cascade.py` — extended with 4 EC2 tests: failure injection
  after first DELETE reverts card deletion; sibling list unaffected; board intact;
  sanity success path.

**Changed**
- `backend/main.py` — lists router imported and registered.

**Verified**
- `pytest backend/tests/` → 90 passed, 0 errors
- `pytest test_lists.py test_cascade.py` → 40 passed, 0 errors
- Lists returned ordered by `position ASC` ✓
- No position reindex after delete ✓
- EC2 injection test: partial cascade + rollback leaves list + cards intact ✓

---

### Task 2 — Boards API + CORS (2026-03-16)

**Added**
- `.env` / `.env.example` — updated `DATABASE_URL` → `kanban.db` (per SPEC §3),
  added `CORS_ORIGIN=http://localhost:5173`.
- `backend/main.py` — `load_dotenv()` called before any local import; added
  `CORSMiddleware` reading `CORS_ORIGIN` env var (default `http://localhost:5173`);
  boards router registered.
- `backend/routers/boards.py` — 4 endpoints:
  - `GET  /boards`        → 200, list ordered `created_at ASC, id ASC`
  - `POST /boards`        → 201, Pydantic validation via `BoardCreate`
  - `GET  /boards/{id}`   → 200 / 404
  - `DELETE /boards/{id}` → 204 / 404 / 500 on cascade failure; explicit
    Python-level cascade via `_cascade_delete_board()` (patchable for AC16).
- `backend/tests/test_boards.py` — 29 tests: CORS headers, all endpoints,
  all 422 validation paths, 404 handling, cascade coverage.
- `backend/tests/test_cascade.py` — 4 tests: AC16 failure injection (partial
  cascade + rollback), unrelated board unaffected, sanity + multi-list variant.

**Changed**
- `backend/tests/conftest.py` — switched from shared-session-with-rollback to
  **per-test `StaticPool` in-memory engine**. Fixes `db.commit()` isolation:
  router commits now land in an isolated in-memory DB that is disposed after
  each test, not the shared session-scoped engine.
- `backend/tests/test_smoke.py` — removed `create_test_tables` fixture
  dependency; `test_tables_exist_in_test_engine` now queries `sqlite_master`
  via the `db` fixture instead of importing the module-level engine directly.

**Verified**
- `pytest backend/tests/` → 54 passed, 0 errors
- Live uvicorn: `GET /boards` with `Origin: http://localhost:5173` →
  `access-control-allow-origin: http://localhost:5173` ✓
- `kanban.db` created on server start (16 KB) ✓
- Sub-task 2a CORS checkpoint: ✓

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
