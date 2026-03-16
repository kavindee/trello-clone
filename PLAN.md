# PLAN.md — Kanban Board MVP

> Revision 2 — Approved architecture. All review questions resolved.

---

## 1. Tech Decisions

### 1.1 Folder Structure

```
kanban/
├── backend/
│   ├── main.py                   # FastAPI app, CORS middleware, startup guard
│   ├── database.py               # SQLAlchemy engine, SessionLocal, Base
│   ├── models.py                 # ORM models: Board, List, Card
│   ├── schemas.py                # Pydantic request/response schemas
│   ├── routers/
│   │   ├── boards.py             # GET/POST /boards, GET/DELETE /boards/{id}
│   │   ├── lists.py              # GET/POST /boards/{id}/lists, DELETE /lists/{id}
│   │   └── cards.py              # POST /lists/{id}/cards, PATCH/DELETE /cards/{id}
│   ├── requirements.txt
│   └── tests/
│       ├── conftest.py           # In-memory SQLite test DB, TestClient fixture
│       ├── test_boards.py        # Board CRUD + validation tests
│       ├── test_lists.py         # List CRUD + validation tests
│       ├── test_cards.py         # Card CRUD + move + validation tests
│       └── test_cascade.py       # AC16 atomicity failure-injection tests
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx               # Hash-based routing (#/ and #/boards/:id)
│   │   ├── api.ts                # Typed fetch() wrappers for all 10 endpoints
│   │   ├── types.ts              # Board, List, Card TypeScript interfaces
│   │   └── components/
│   │       ├── BoardList.tsx     # Home page: create/list/delete boards
│   │       ├── BoardDetail.tsx   # Board page: fetches board + lists
│   │       ├── ListColumn.tsx    # Column: create/delete cards, move dropdown
│   │       ├── CardItem.tsx      # Inline edit, delete, move card
│   │       └── ErrorBanner.tsx   # EC8: inline error, 5s auto-dismiss
│   ├── styles/
│   │   ├── BoardList.module.css
│   │   ├── BoardDetail.module.css
│   │   ├── ListColumn.module.css
│   │   ├── CardItem.module.css
│   │   └── ErrorBanner.module.css
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── PLAN.md
```

### 1.2 Key Libraries

| Layer    | Library           | Version | Purpose                                  |
| -------- | ----------------- | ------- | ---------------------------------------- |
| Backend  | fastapi           | ^0.111  | Web framework                            |
| Backend  | uvicorn[standard] | ^0.29   | ASGI server                              |
| Backend  | sqlalchemy        | ^2.0    | Sync ORM (`create_engine`)               |
| Backend  | pydantic          | ^2.7    | Request/response validation              |
| Backend  | pytest            | ^8.2    | Test runner                              |
| Backend  | httpx             | ^0.27   | Async-compatible test client for FastAPI |
| Frontend | react + react-dom | ^18     | UI framework                             |
| Frontend | typescript        | ^5      | Type safety                              |
| Frontend | vite              | ^5      | Dev server + bundler                     |

**Intentional omissions:**

- No external state management (Zustand, Redux) — plain `useState` / `useEffect`
- No UI component library — plain CSS Modules only
- No `react-router-dom` — hash-based routing (`/#/boards/1`) avoids Vite
  history-mode fallback config

### 1.3 Database Schema

```sql
CREATE TABLE boards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id   INTEGER NOT NULL REFERENCES boards(id),
  name       TEXT    NOT NULL,
  position   INTEGER NOT NULL,   -- 0-based, assigned at insert, never reindexed
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id    INTEGER NOT NULL REFERENCES lists(id),
  title      TEXT    NOT NULL,
  position   INTEGER NOT NULL,   -- 0-based, assigned at insert, never reindexed
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
```

**Position assignment rules:**

- New list on board → `position = COUNT(existing lists on that board)`
- New card in list → `position = COUNT(existing cards in that list)`
- Deleting a record does NOT reindex siblings (AC6, AC9)
- Card moved to target list → `position = MAX(position in target list) + 1`

**Cascade strategy — ORM-level, NOT SQLite FK cascade:**
Child rows are deleted explicitly inside a single `db.begin()` transaction
block in Python. This makes AC16's failure-injection test possible at the
Python layer without fighting the SQLite driver.

**Startup guard:**
`Base.metadata.create_all()` is wrapped in `try/except`; on failure the
exception is logged to `stderr` and `sys.exit(1)` is called before Uvicorn
serves any request.

---

## 2. Tasks

- [x] **Task 1: Project Scaffolding + DB Layer**
      Set up the monorepo skeleton, `requirements.txt`, SQLAlchemy engine +
      session factory, ORM models (Board, List, Card), Pydantic schemas for all
      request/response types, bare `main.py` with startup guard, and
      `conftest.py` with an in-memory SQLite test DB and `TestClient` fixture.

  **Files (5):**
  `backend/database.py`, `backend/models.py`, `backend/schemas.py`,
  `backend/main.py`, `backend/tests/conftest.py`

  **Verifiable output:**
  - `pytest backend/tests/` passes — 0 collected, 0 errors
  - `uvicorn main:app` starts, creates `kanban.db`, logs no errors
  - Intentionally breaking `create_all` causes `sys.exit(1)` and stderr log

  **AC:** prereq for AC13–AC16

---

- [x] **Task 2: Boards API + CORS**
      **Sub-task 2a (CORS first — do not implement any endpoint until this
      checkpoint passes):** Add `CORSMiddleware` to `main.py`, read allowed
      origin from `CORS_ORIGIN` env var (default `http://localhost:5173`).
      Verify: `curl -i -H "Origin: http://localhost:5173" http://localhost:8000/boards`
      returns `Access-Control-Allow-Origin: http://localhost:5173`.

  Then implement all `/boards` endpoints, input validation (empty string,
  whitespace-only, >255 chars, newline chars → 422), 404 handling, and
  board cascade delete (lists → cards) within a single transaction.
  Write `test_boards.py` (all endpoints + validation) and
  `test_cascade.py` (board-level failure injection for AC16).

  **Files (4):**
  `backend/main.py`, `backend/routers/boards.py`,
  `backend/tests/test_boards.py`, `backend/tests/test_cascade.py`

  **Verifiable output:**
  - CORS header present on all `/boards` responses
  - `pytest test_boards.py test_cascade.py` passes
  - DELETE board removes all child lists and cards atomically
  - AC16 injection test: simulated mid-cascade failure leaves parent intact

  **AC:** AC1, AC2, AC3, AC13 (boards), AC14, AC15, AC16, EC1

---

- [x] **Task 3: Lists API**
      Implement `GET /boards/{id}/lists`, `POST /boards/{id}/lists`,
      `DELETE /lists/{id}`. Includes position assignment, list cascade delete
      (cards within the list), 404 handling, and input validation.
      List-level cascade atomicity test lives in `test_cascade.py` (extend it).
      Write `test_lists.py`.

  **Files (3):**
  `backend/routers/lists.py`,
  `backend/tests/test_lists.py`,
  `backend/tests/test_cascade.py` _(extended)_

  **Verifiable output:**
  - `pytest test_lists.py test_cascade.py` passes
  - Lists returned ordered by `position ASC`
  - DELETE list removes all child cards atomically
  - EC2 injection test in `test_cascade.py` passes

  **AC:** AC5, AC6, AC7, AC13 (lists), AC14, AC15, EC2, EC6

---

- [x] **Task 4: Cards API**
      Implement `POST /lists/{id}/cards`, `PATCH /cards/{id}`, `DELETE /cards/{id}`.
      PATCH handles title update, list move, or both atomically. Move appends
      card to bottom of target list (`MAX(position) + 1`). Same-list move is a
      no-op returning `200` with unchanged card (EC3). Both fields absent → `422`.
      Write `test_cards.py`.

  **Files (3):**
  `backend/routers/cards.py`,
  `backend/tests/test_cards.py`,
  `backend/main.py` _(register cards router)_

  **Verifiable output:**
  - `pytest test_cards.py` passes
  - PATCH with `list_id` equal to current list returns `200`, no DB write
  - PATCH with both `title` and `list_id` applies both in one transaction
  - PATCH with neither field returns `422`
  - Cards returned ordered by `position ASC`

  **AC:** AC8, AC9, AC10, AC11, AC12, AC13 (cards), AC14, AC15, EC3

---

- [ ] **Task 5: Frontend Foundation**
      Scaffold Vite + React + TypeScript project. Define `types.ts` (Board,
      List, Card interfaces matching API response schemas). Implement `api.ts`
      with typed `fetch()` wrappers for all 10 endpoints plus a shared
      `extractError(response)` helper that returns `{ status, message }` for
      use by EC8 error banners. Wire hash-based routing in `App.tsx`
      (`#/` → BoardList, `#/boards/:id` → BoardDetail).

  **Files (4):**
  `frontend/src/types.ts`, `frontend/src/api.ts`,
  `frontend/src/App.tsx`, `frontend/vite.config.ts`

  **Verifiable output:**
  - `npm run dev` starts without TypeScript errors
  - `npm run build` compiles cleanly
  - Navigating to `http://localhost:5173/#/` renders a blank BoardList
    placeholder without console errors
  - All `api.ts` functions are typed (no `any`)

  **AC:** prereq for AC1–AC12, EC8

---

- [ ] **Task 6: Board List Page**
      Implement `BoardList.tsx`: fetch and display all boards (`created_at ASC`),
      create board form with inline validation (whitespace → block submit with
      message, >255 chars → block with character counter EC7), delete board with
      confirmation, "No boards yet" empty state. Implement `ErrorBanner.tsx`:
      shows HTTP status + human-readable message, auto-dismisses after 5 seconds,
      has manual close button. Apply `BoardList.module.css` and
      `ErrorBanner.module.css`.

  **Files (5):**
  `frontend/src/components/BoardList.tsx`,
  `frontend/src/components/ErrorBanner.tsx`,
  `frontend/src/styles/BoardList.module.css`,
  `frontend/src/styles/ErrorBanner.module.css`,
  `frontend/src/App.tsx` _(add BoardList route)_

  **Verifiable output:**
  - Create board → appears in list without reload
  - Delete board → disappears without reload
  - Whitespace name → inline message, no API call
  - 256-char name → inline message, no API call
  - Simulated 500 from API → ErrorBanner appears, auto-dismisses in 5s
  - "No boards yet" renders when list is empty

  **AC:** AC1, AC2, AC3, EC4 (boards), EC5, EC7, EC8

---

- [ ] **Task 7: Board Detail + Lists UI**
      Implement `BoardDetail.tsx`: fetch board metadata via `GET /boards/{id}`
      and lists via `GET /boards/{id}/lists`, render columns side-by-side with
      horizontal scroll. Create list form (same validation as Task 6). Delete
      list button. "No lists yet" centered empty state (EC4). `ListColumn.tsx`
      shell (renders column header + card area placeholder — cards wired in T8).
      Apply `BoardDetail.module.css` and `ListColumn.module.css`.

  **Files (5):**
  `frontend/src/components/BoardDetail.tsx`,
  `frontend/src/components/ListColumn.tsx`,
  `frontend/src/styles/BoardDetail.module.css`,
  `frontend/src/styles/ListColumn.module.css`,
  `frontend/src/App.tsx` _(add BoardDetail route)_

  **Verifiable output:**
  - Navigate to `#/boards/1` → board name and lists render
  - Create list → appends to right without reload
  - Delete list → removed without reload; if last list, "No lists yet" shows
  - Invalid list name → inline validation, no API call
  - Failed API call → ErrorBanner with status + message
  - Non-existent board ID → renders error state, no crash

  **AC:** AC4, AC5, AC6, AC7, EC4, EC5, EC6, EC7, EC8

---

- [ ] **Task 8: Cards UI**
      Complete `ListColumn.tsx`: render cards from props, create card form
      (inline validation EC5/EC7), "No cards yet" empty state. Implement
      `CardItem.tsx`: display title as text content (not innerHTML — EC9),
      inline edit (update title from API response body, no reload — AC10),
      delete card, "Move to list" dropdown (all other lists on board, confirm
      → PATCH, card removed from current column and appended to target — AC12).
      All mutations trigger `ErrorBanner` on failure (EC8). Apply
      `CardItem.module.css`.

  **Files (5):**
  `frontend/src/components/ListColumn.tsx` _(complete)_,
  `frontend/src/components/CardItem.tsx`,
  `frontend/src/styles/CardItem.module.css`,
  `frontend/src/api.ts` _(verify PATCH wrappers)_,
  `frontend/src/components/ErrorBanner.tsx` _(reuse)_

  **Verifiable output:**
  - Create card → appears at bottom of list without reload
  - Edit title → UI updates from response body value, not local state
  - Delete card → removed without reload
  - Move card → disappears from source list, appears at bottom of target
  - Move to same list → no visible change, no error (EC3)
  - `<script>alert(1)</script>` as title renders as text, not executed (EC9)
  - "No cards yet" renders in empty list
  - Failed move → ErrorBanner shows, card stays in original list

  **AC:** AC8, AC9, AC10, AC11, AC12, EC3, EC4 (cards), EC5, EC7, EC8, EC9

---

- [ ] **Task 9: README + Smoke Test**
      Write `README.md` with setup instructions for both backend and frontend.
      Perform a full manual walkthrough using the checklist below. Fix any
      integration issues found (touches ≤ 3 files).

  **Files (≤ 4):**
  `README.md`, plus up to 3 bug-fix files identified during walkthrough

  **Walkthrough checklist (manual):**
  - [ ] Backend starts, `kanban.db` created
  - [ ] Frontend starts, no console errors
  - [ ] CORS: frontend API call succeeds (no blocked-by-CORS error)
  - [ ] Create / list / delete board
  - [ ] Create / delete list; "No lists yet" after last deletion
  - [ ] Create / edit / delete card
  - [ ] Move card to another list; persists after reload
  - [ ] Whitespace input rejected in UI and API
  - [ ] 256-char input rejected in UI and API
  - [ ] ErrorBanner appears on simulated failure, dismisses after 5s
  - [ ] XSS title renders as plain text
  - [ ] `pytest backend/tests/` — all tests pass

  **AC:** All ACs (integration verification)

---

- [ ] **Task 10 (Stretch): Drag-and-Drop Card Reordering** _(optional)_
      Replace "Move to list" dropdown with `@dnd-kit/core` + `@dnd-kit/sortable`.
      Support drag within a list (reorder) and drag between lists. PATCH
      `/cards/{id}` with updated `list_id` and recomputed `position`. Requires
      backend to accept an explicit `position` field in the PATCH body.

  **Files (4):**
  `frontend/src/components/ListColumn.tsx`,
  `frontend/src/components/CardItem.tsx`,
  `backend/routers/cards.py`,
  `frontend/package.json`

  **AC:** AC12 (enhanced — replaces dropdown with drag-and-drop)

---

## 3. Acceptance Criteria Mapping

### Boards

- [ ] AC1 — Create a board → T2 (API), T6 (UI)
- [ ] AC2 — List all boards ordered by `created_at ASC` → T2 (API), T6 (UI)
- [ ] AC3 — Delete a board (cascade) → T2 (API), T6 (UI)
- [ ] AC4 — View a board (metadata + lists) → T3 (API), T7 (UI)

### Lists

- [ ] AC5 — Create a list → T3 (API), T7 (UI)
- [ ] AC6 — List order preserved (`position ASC`) → T3 (API), T7 (UI)
- [ ] AC7 — Delete a list (cascade cards) → T3 (API), T7 (UI)

### Cards

- [ ] AC8 — Create a card → T4 (API), T8 (UI)
- [ ] AC9 — Card order preserved (`position ASC`) → T4 (API), T8 (UI)
- [ ] AC10 — Edit card title (update from response body) → T4 (API), T8 (UI)
- [ ] AC11 — Delete a card → T4 (API), T8 (UI)
- [ ] AC12 — Move card to another list → T4 (API), T8 (UI)

### API Contracts

- [ ] AC13 — All 10 RESTful endpoints present → T2 (boards), T3 (lists), T4 (cards)
- [ ] AC14 — Input validation (empty, whitespace, length, newline, PATCH body) → T2, T3, T4
- [ ] AC15 — 404 for missing board/list/card → T2, T3, T4
- [ ] AC16 — Cascade delete atomicity (failure-injection test) → T2 (`test_cascade.py`)

### Edge Cases

- [ ] EC1 — Board cascade delete (lists + cards atomic) → T2
- [ ] EC2 — List cascade delete (cards atomic) → T3
- [ ] EC3 — Move card to same list is a no-op (`200`, no write) → T4, T8
- [ ] EC4 — "No lists yet" / "No cards yet" empty states → T7, T8
- [ ] EC5 — Whitespace-only input rejected (UI + API) → T2, T3, T4, T6, T8
- [ ] EC6 — Delete only list → board stays, "No lists yet" shown → T3, T7
- [ ] EC7 — Titles >255 chars rejected; UI shows character counter → T2, T3, T4, T6, T8
- [ ] EC8 — ErrorBanner on failed API call; auto-dismiss 5s → T6, T7, T8
- [ ] EC9 — Special chars OK; newlines → 422; titles as text not HTML → T4, T8

---

## 4. Verification Log

_(Filled during execution)_

| Task | Status | AC Verified | Notes |
| ---- | ------ | ----------- | ----- |
| T1   | ✅ Done | prereq AC13–AC16 | 21 smoke tests pass; kanban.db created; startup guard exits 1 on failure |
| T2   | ✅ Done | AC1, AC2, AC3, AC13 (boards), AC14, AC15, AC16, EC1 | 54 tests pass; CORS header verified on live server; cascade atomicity injection test passes |
| T3   | ✅ Done | AC5, AC6, AC7, AC13 (lists), AC14, AC15, EC2, EC6 | 90 tests pass; position ordering verified; no-reindex confirmed; EC2 injection passes |
| T4   | ✅ Done | AC8, AC9, AC10, AC11, AC12, AC13 (cards), AC14, AC15, EC3 | 143 tests pass; EC3 strict no-op verified; move position MAX+1 verified; atomic title+move verified |
| T5   |        |             |       |
| T6   |        |             |       |
| T7   |        |             |       |
| T8   |        |             |       |
| T9   |        |             |       |
| T10  |        |             |       |
