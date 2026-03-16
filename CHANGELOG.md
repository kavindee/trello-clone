# Changelog

All notable changes to this project are documented here.

---

## [Unreleased]

### Task 9 — README + Smoke Test (2026-03-16)

**Added**
- `README.md` — project root; sections: Prerequisites, Backend Setup,
  Frontend Setup, Environment Variables, Running Tests, Project Structure,
  API Reference, Smoke-Test Checklist, Known Limitations

**Fixed (bugs found during smoke test walkthrough)**
- `frontend/src/components/CardItem.tsx` — `startEdit()` now seeds the edit
  input from `displayTitle` (local state) instead of `card.title` (prop).
  Eliminates a stale-prop window between `setDisplayTitle` and the parent
  re-render; ensures re-opening edit mode after a save always shows the
  most recent title.
- `frontend/src/styles/BoardDetail.module.css` — `.empty` changed from
  `width: 100%` to `flex: 1; align-self: center` so "No lists yet" text
  centres correctly in the flex-row canvas alongside the add-list form panel.

**Verified (programmatic smoke test)**
- `pytest backend/tests/ -v` → **152 passed**, 0 failures, 0 errors ✓
- `npm test` → **151 passed** (8 files), 0 failures ✓
- `npm run build` → TypeScript clean + Vite 203 kB JS ✓
- Startup guard: `sys.exit(1)` + `stderr` message on `create_all` failure ✓
- CORS: `Access-Control-Allow-Origin: http://localhost:5173` on every response ✓
- Whitespace name → `422` ✓ | Newline in name → `422` ✓
- 256-char name → `422` ✓ | 255-char name → `201` ✓
- Board → list → card create/edit/delete chain ✓
- Move card A→B: source empty, target contains card ✓
- EC3: same-list move returns unchanged card, position unchanged ✓
- Cascade board delete: board + lists + cards all gone (404) ✓
- `healthz` endpoint: `{"status": "ok"}` ✓

**PLAN.md — all AC/EC checkboxes marked complete (T9 integration pass)**

---

### Task 8 — Cards UI (2026-03-16)

**Spec gap fixed**
- `backend/routers/lists.py` — added `GET /lists/{list_id}/cards` endpoint:
  returns `Card[]` ordered by `position ASC`; 404 if list missing.
  Frontend cannot display cards without this endpoint; not in original AC13.

**Added (backend)**
- 10 new tests appended to `backend/tests/test_lists.py`:
  `test_get_cards_returns_200`, `test_get_cards_empty_when_no_cards`,
  `test_get_cards_returns_created_cards`, `test_get_cards_ordered_by_position_asc`,
  `test_get_cards_response_schema`, `test_get_cards_isolates_lists`,
  `test_get_cards_404_on_missing_list`, `test_get_cards_404_detail_contains_list_id`,
  `test_get_cards_position_not_reindexed_after_delete`

**Added (frontend)**
- `frontend/src/api.ts` — `getCards(listId)`: `GET /lists/:listId/cards → Card[]`
- `frontend/src/components/CardItem.tsx` — full card with:
  - Display mode: title as `<span>` text child (EC9), Edit + Delete buttons,
    "Move to list" dropdown (other lists only)
  - Edit mode: input pre-filled with current title, counter X/255 (EC7),
    whitespace/empty blocked (EC5), 256-char blocked (EC7); Save updates
    `displayTitle` from API response body NOT local input (AC10); Cancel
    returns to display without API call; ErrorBanner on failure, stays in
    edit mode (EC8)
  - Delete: `deleteCard → onDeleted()` on success; ErrorBanner on failure
  - Move: `updateCard({ list_id }) → onMoved(cardId, targetListId)` on success;
    same-list guard (EC3 — no API call); ErrorBanner on failure
  - `displayTitle` state initialised from prop, updated only from API response
- `frontend/src/styles/CardItem.module.css` — card with subtle border/shadow;
  hover actions; move row; edit-mode inline input + counter
- `frontend/src/components/ListColumn.tsx` (completed from T7 shell):
  - Fetches cards via `getCards(list.id)` on mount (AC9 order preserved)
  - Re-fetches when `refreshSignal` prop increments (card moved in from another column)
  - Renders each card as `<CardItem />`; "No cards yet" when empty (EC4)
  - Create card form: counter, EC5/EC7 validation, success appends, failure ErrorBanner
  - `handleCardDeleted(id)` / `handleCardMoved(id, targetListId)` / `handleCardUpdated`
    — mutate local `cards` state; `onCardMovedOut(targetListId)` bubbles to BoardDetail
- `frontend/src/styles/ListColumn.module.css` — added create-card form styles

**Changed**
- `frontend/src/components/BoardDetail.tsx` — added `listRefreshSignals` state
  (`Record<number, number>`); `handleCardMovedOut(targetListId)` increments target
  list's signal; passes `refreshSignal` + `onCardMovedOut` to each `ListColumn`
- `frontend/src/test/BoardDetail.test.tsx` — added
  `vi.mocked(api.getCards).mockResolvedValue([])` to `beforeEach` (real ListColumn
  now fetches cards on mount)

**Added (tests — TDD)**
- `frontend/src/test/CardItem.test.tsx` — 29 tests: display/XSS, edit mode
  (pre-fill, counter, cancel, EC5/EC7, AC10 server title, onUpdated, EC8 stays
  in edit mode), delete (success/failure/onDeleted), move (success/failure/EC3/
  no selection, onMoved)
- `frontend/src/test/ListColumn.test.tsx` (rewritten) — 29 tests: T7 tests
  updated (getCards mocked, aria-label selector refined), plus T8: mount fetch,
  render cards, no-cards, refreshSignal re-fetch, create form counter/validation/
  success/failure, card callbacks (deleted, moved + onCardMovedOut, updated)
- `frontend/src/test/api.test.ts` — 3 tests for `getCards`

**Verified**
- `pytest backend/tests/` → **152 passed**, 0 errors
- `npm test` → **151 passed** (8 test files), 0 errors
- `npm run build` → TypeScript clean + Vite 203 kB JS, 0 errors
- All verifiable output criteria met:
  - Create card → appended to list immediately ✓
  - Edit card → title shows API response body, not local input (AC10) ✓
  - Delete card → removed immediately ✓
  - Move card → disappears from source, re-fetch on target via refreshSignal ✓
  - Move same list → no API call (EC3) ✓
  - `<script>alert(1)</script>` renders as plain text (EC9) ✓
  - "No cards yet" in empty list (EC4) ✓
  - Failed API → ErrorBanner, UI unchanged (EC8) ✓

---

### Task 7 — Board Detail + Lists UI (2026-03-16)

**Added**
- `frontend/src/components/ListColumn.tsx` — column shell (Task 8 adds cards):
  - Props: `{ list, allLists, onDeleted }` (`allLists` reserved for Task 8 card
    move dropdown; prefixed `_allLists` to satisfy `noUnusedParameters`)
  - Renders list name as text child (EC9), delete button, "No cards yet"
    placeholder (EC4)
  - Handles its own delete: calls `deleteList(list.id)`, then `onDeleted()` on
    success; shows its own `ErrorBanner` on failure (EC8)
- `frontend/src/components/BoardDetail.tsx` — full board detail page:
  - `Promise.all([getBoard(id), getLists(id)])` parallel fetch on mount (AC4)
  - 404 from `getBoard` → "Board not found" error state, no crash (AC15)
  - Other load error → `ErrorBanner` (EC8)
  - Board name rendered as `<h1>` heading; `← Back` link to `#/`
  - Lists rendered as horizontal `<ListColumn>` items with overflow scroll (AC4/AC6)
  - "No lists yet" centered empty state (EC4)
  - Create list form: counter `X/255` (EC7); blocks empty/whitespace (EC5);
    blocks >255 chars (EC7); no API call on invalid input; appends on success (AC5);
    `ErrorBanner` + list unchanged on failure (EC8)
  - `handleListDeleted(id)` callback passed to each `ListColumn` — filters list
    from state on success; "No lists yet" reappears when last list removed (EC6/AC7)
  - `data-testid="board-detail"` on wrapper so App routing tests work synchronously
- `frontend/src/styles/ListColumn.module.css` — white-background column card,
  rounded corners, shadow; header with name + right-aligned delete; min-height
  card area; centred "No cards yet"
- `frontend/src/styles/BoardDetail.module.css` — Trello-blue full-height page;
  top bar with back link + board name; horizontal-scroll canvas; add-list form
  panel; centred empty and error states

**Changed**
- `frontend/src/test/App.test.tsx` — updated BoardDetail routing tests to mock
  `getBoard`/`getLists` in `beforeEach`; kept synchronous `getByTestId` check
  (wrapper renders before fetch resolves); added async heading check; removed
  `textContent.toContain(id)` assertion (not meaningful during loading state)

**Added (tests — TDD)**
- `frontend/src/test/ListColumn.test.tsx` — 8 tests: renders name/delete
  button/"No cards yet"; `deleteList` called with correct id; `onDeleted` on
  success; `ErrorBanner` + no `onDeleted` on failure
- `frontend/src/test/BoardDetail.test.tsx` — 23 tests: parallel fetch, board
  heading, back link, list columns, empty state, 404/non-404 load errors,
  counter, whitespace/256-char validation (no API call), create appends,
  create clears input, create removes empty state, create failure banner,
  delete removes column, last delete → "No lists yet", delete failure banner,
  XSS plain-text, validation error clears on type

**Verified**
- `npm test` → **107 passed** (7 test files), 0 errors
- `npm run build` → TypeScript clean + Vite 198 kB JS, 0 errors
- All verifiable output criteria met:
  - `#/boards/1` → board name heading + lists render ✓
  - Create list → new column appended immediately ✓
  - Delete list → column removed immediately ✓
  - Delete last list → "No lists yet" shown (EC6) ✓
  - Invalid list name → inline message, zero API calls ✓
  - API failure → ErrorBanner (status + message), list unchanged ✓
  - Non-existent board ID → "Board not found", no crash ✓
  - `npm run build` → zero TypeScript errors ✓

---

### Task 6 — Board List Page (2026-03-16)

**Added**
- `frontend/src/components/ErrorBanner.tsx` — EC8 inline error banner:
  - Props: `{ status: number; message: string; onDismiss: () => void }`
  - Displays HTTP status (bold red) + human-readable message
  - Auto-dismisses after 5 seconds via `useEffect` + `useRef` (timer started
    once on mount; latest `onDismiss` always called without restarting clock)
  - Manual close button (`×`, `aria-label="Dismiss error"`)
  - `role="alert"` for accessibility
  - No `alert()`, no `console.error()`, no `innerHTML`
- `frontend/src/components/BoardList.tsx` — full home-page implementation:
  - Fetches boards via `getBoards()` on mount; renders each as
    `<a href="#/boards/:id">` (text child, never innerHTML — EC9)
  - "No boards yet" centered empty state (EC4)
  - Create form: live character counter `X/255` (EC7); blocks empty /
    whitespace with "Board name cannot be empty" (EC5); blocks >255 chars
    with "Board name must be 255 characters or fewer" (EC7); no API call
    on invalid input; clears input and appends board on success (AC1);
    shows ErrorBanner on failure without mutating list (EC8)
  - Delete button per board: removes from list on success (AC3); shows
    ErrorBanner on failure without mutating list (EC8)
  - Validation error clears as user types
- `frontend/src/styles/ErrorBanner.module.css` — yellow/red banner with
  slide-down animation; close button right-aligned; transitions
- `frontend/src/styles/BoardList.module.css` — clean form layout; gray
  counter; red validation messages; card-style board items; hover states

**Changed**
- `frontend/src/test/App.test.tsx` — updated routing tests to use real
  `BoardList` output (heading query) instead of removed placeholder
  `data-testid`; added `vi.mock('../api')` + `getBoards` stub so routing
  tests don't fail on network calls
- `frontend/src/test/BoardList.test.tsx` — removed unused `act` import
  (strict TypeScript `noUnusedLocals`)

**Added (tests — TDD)**
- `frontend/src/test/ErrorBanner.test.tsx` — 8 tests: renders status +
  message, close button calls onDismiss, auto-dismiss at 5 s, no early
  dismiss at 4999 ms, timer cancelled on unmount, `role="alert"` present
- `frontend/src/test/BoardList.test.tsx` — 26 tests: mount fetch, board
  links, fetch failure banner, empty state, character counter, whitespace
  blocked, 256-char blocked, 255-char passes, create appends, create clears
  input, create removes empty state, create failure banner, delete buttons,
  delete calls API, delete removes item, delete shows empty state, delete
  failure banner, XSS plain-text, banner dismiss, validation error clears

**Verified**
- `npm test` → **76 passed** (5 test files), 0 errors
- `npm run build` → TypeScript clean + Vite 194 kB JS, 0 errors
- All verifiable output criteria met:
  - Create board → appends immediately, no reload ✓
  - Delete board → removes immediately, no reload ✓
  - Empty name → inline message, zero API calls ✓
  - Whitespace name → inline message, zero API calls ✓
  - 256-char name → inline message, zero API calls ✓
  - API failure → ErrorBanner (status + message), list unchanged ✓
  - ErrorBanner auto-dismisses at 5 s, manual close works ✓
  - Empty list → "No boards yet" centered ✓
  - XSS `<script>` title renders as plain text ✓

---

### Task 5 — Frontend Foundation (2026-03-16)

**Added**
- `frontend/src/types.ts` — TypeScript interfaces `Board`, `List`, `Card`
  exactly mirroring the FastAPI response schemas; `created_at` kept as
  `string` (no `Date` conversion); no `any` anywhere.
- `frontend/src/api.ts` — typed `fetch()` wrappers for all 10 endpoints:
  `getBoards`, `createBoard`, `getBoard`, `deleteBoard`,
  `getLists`, `createList`, `deleteList`,
  `createCard`, `updateCard`, `deleteCard`.
  `extractError(response)` helper parses FastAPI validation arrays and
  string detail fields into `{ status, message }` for EC8 error banners.
  All functions throw `ApiError` on any non-2xx response.
- `frontend/src/App.tsx` — hash-based router (no `react-router-dom`):
  `#/` → `<BoardList />` placeholder; `#/boards/:id` → `<BoardDetail id={id} />`
  placeholder; non-integer / unknown hashes fall back to home view.
  `hashchange` listener updates route state reactively.
- `frontend/src/components/BoardList.tsx` — placeholder (`data-testid="board-list"`).
- `frontend/src/components/BoardDetail.tsx` — placeholder (`data-testid="board-detail"`).
- `frontend/src/test/setup.ts` — Vitest global setup (`@testing-library/jest-dom`).
- `frontend/src/test/types.test.ts` — 7 tests: Board / List / Card interface shape.
- `frontend/src/test/api.test.ts` — 28 tests: all 10 endpoint wrappers + `extractError`
  (string detail, array detail, non-JSON fallback, empty statusText fallback).
- `frontend/src/test/App.test.tsx` — 7 tests: routing (home, board detail,
  unknown hash fallback, hashchange transitions).

**Changed**
- `frontend/vite.config.ts` — added `test` block (`jsdom` environment,
  `globals: true`, `setupFiles`); switched import to `vitest/config` so
  TypeScript resolves the `test` key without errors.
- `frontend/package.json` — added `vitest`, `@vitest/coverage-v8`, `jsdom`,
  `@testing-library/react`, `@testing-library/jest-dom`,
  `@testing-library/user-event` dev dependencies; added `test` and
  `test:watch` npm scripts.

**Verified**
- `npm test` → 42 passed (3 test files), 0 errors
- `npm run build` → TypeScript clean + Vite build 191 kB JS, 0 errors
- Hash routing: `#/` → BoardList, `#/boards/42` → BoardDetail(42),
  `#/boards/abc` → BoardList (fallback), `hashchange` reactive ✓
- All `api.ts` functions fully typed — no `any` ✓
- `extractError` handles string detail, Pydantic array detail, non-JSON body ✓

---

### Task 4 — Cards API (2026-03-16)

**Added**
- `backend/routers/cards.py` — 3 endpoints:
  - `POST  /lists/{id}/cards`  → 201; `position = COUNT(existing cards)` (0-based
    append); full title validation via `CardCreate`; 404 if list missing.
  - `PATCH /cards/{id}`        → 200; at least one of `title`/`list_id` required
    (→ 422); EC3 no-op if `list_id == current`; move appends
    `position = MAX(target) + 1` (0 for empty target); title + move applied
    atomically in one `db.commit()`; 404 for missing card or target list.
  - `DELETE /cards/{id}`       → 204; no reindex of siblings; 404 if missing.
- `backend/tests/test_cards.py` — 53 tests covering all 3 endpoints, position
  ordering, no-reindex-after-delete, PATCH title-only / move-only / both-atomic,
  EC3 no-op (including strict same-list-with-title variant), 422 body validation
  (9 create + 5 patch cases), 404s for card and target list.

**Changed**
- `backend/main.py` — cards router imported and registered.

**Verified**
- `pytest backend/tests/test_cards.py` → 53 passed, 0 errors
- `pytest backend/tests/` → 143 passed, 0 errors (all prior tasks green)
- EC3 strict: `PATCH {title, list_id=current}` → no write, unchanged card ✓
- Move appends to bottom: `MAX(position) + 1`; empty target → position 0 ✓
- Both title + list_id applied atomically in single `db.commit()` ✓
- `PATCH {}` and `PATCH {title: null, list_id: null}` both return 422 ✓

---

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
