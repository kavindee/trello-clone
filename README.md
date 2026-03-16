# Kanban Board — Trello Clone MVP

A single-user kanban board application: create boards, add lists (columns),
and manage cards within each list. Cards can be created, edited, deleted, and
moved between lists.

**Stack:** FastAPI · SQLite · React 18 · TypeScript · Vite

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11 or higher |
| Node.js | 18 or higher |
| npm | 9 or higher (bundled with Node.js 18+) |

---

## Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows (PowerShell)
venv\Scripts\Activate.ps1

# Windows (CMD)
venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt

# Start the development server
uvicorn main:app --reload
```

The API is now running at **http://localhost:8000**

- `kanban.db` is created automatically in the `backend/` directory on first run
- Interactive API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/healthz
- If table creation fails at startup, the server logs the error to `stderr`
  and exits with a non-zero code (startup guard)

---

## Frontend Setup

Open a **new terminal** (keep the backend running):

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

The app is now running at **http://localhost:5173**

- Hot-reloads automatically on file changes
- Port 5173 is required — the backend's CORS policy allows only this origin

---

## Environment Variables

The `.env` file lives in the **project root** and is loaded automatically by
the backend on startup (`python-dotenv` searches parent directories).

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./kanban.db` | SQLAlchemy connection string |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |

To override, edit `.env` (copy from `.env.example`):

```bash
cp .env.example .env
# then edit .env
```

---

## Running Tests

### Backend

```bash
cd backend
# activate venv first (see Backend Setup above)
pytest tests/ -v
```

Expected: **152 tests pass**, 0 failures, 0 errors.

### Frontend

```bash
cd frontend
npm test          # run once
npm run test:watch  # watch mode
```

Expected: **151 tests pass** across 8 test files, 0 failures.

### Build check (TypeScript + Vite)

```bash
cd frontend
npm run build
```

---

## Project Structure

```
trello-clone/
├── .env                        # environment variables (loaded by backend)
├── .env.example                # template — copy to .env
├── backend/
│   ├── main.py                 # FastAPI app, CORS, startup guard
│   ├── database.py             # SQLAlchemy engine + session factory
│   ├── models.py               # ORM models: Board, List, Card
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── requirements.txt
│   ├── routers/
│   │   ├── boards.py           # GET/POST /boards, GET/DELETE /boards/{id}
│   │   ├── lists.py            # GET/POST /boards/{id}/lists,
│   │   │                       # DELETE /lists/{id},
│   │   │                       # GET /lists/{id}/cards
│   │   └── cards.py            # POST /lists/{id}/cards,
│   │                           # PATCH /cards/{id}, DELETE /cards/{id}
│   └── tests/
│       ├── conftest.py         # in-memory SQLite test DB, TestClient fixture
│       ├── test_smoke.py
│       ├── test_boards.py
│       ├── test_lists.py
│       ├── test_cards.py
│       └── test_cascade.py
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── main.tsx
        ├── App.tsx             # hash-based router: #/ and #/boards/:id
        ├── api.ts              # typed fetch() wrappers (11 endpoints)
        ├── types.ts            # Board, List, Card interfaces
        ├── components/
        │   ├── BoardList.tsx   # home page
        │   ├── BoardDetail.tsx # board page
        │   ├── ListColumn.tsx  # kanban column with cards
        │   ├── CardItem.tsx    # card (display / edit / delete / move)
        │   └── ErrorBanner.tsx # EC8 inline error with 5-second auto-dismiss
        ├── styles/             # CSS Modules
        └── test/               # Vitest + Testing Library
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/boards` | List all boards (oldest first) |
| `POST` | `/boards` | Create a board |
| `GET` | `/boards/{id}` | Get a single board |
| `DELETE` | `/boards/{id}` | Delete board + all children |
| `GET` | `/boards/{id}/lists` | List all lists for a board |
| `POST` | `/boards/{id}/lists` | Create a list |
| `DELETE` | `/lists/{id}` | Delete list + all its cards |
| `GET` | `/lists/{id}/cards` | List all cards for a list |
| `POST` | `/lists/{id}/cards` | Create a card |
| `PATCH` | `/cards/{id}` | Edit title and/or move card |
| `DELETE` | `/cards/{id}` | Delete a card |

All endpoints return `application/json`. Validation errors return `422`.
Missing resources return `404`.

---

## Smoke-Test Checklist

Run through this checklist to verify a fresh install:

### Backend

- [ ] `pytest backend/tests/` — 152 passed, 0 errors
- [ ] `uvicorn main:app --reload` starts, `kanban.db` created, no stderr
- [ ] `curl -i -H "Origin: http://localhost:5173" http://localhost:8000/boards`
      returns `Access-Control-Allow-Origin: http://localhost:5173`

### Boards

- [ ] Create a board → appears in list immediately
- [ ] Create board with empty name → inline validation message, no API call
- [ ] Create board with 256-char name → inline validation message, no API call
- [ ] Delete a board → disappears immediately
- [ ] "No boards yet" renders when list is empty

### Lists

- [ ] Navigate to a board → lists render in creation order
- [ ] Create a list → appends as new column immediately
- [ ] Delete a list → column removed immediately
- [ ] Delete last list → "No lists yet" empty state appears
- [ ] "No lists yet" renders on a new board

### Cards

- [ ] Create a card → appears at bottom of list immediately
- [ ] Create card with empty title → inline validation, no API call
- [ ] Edit card title → UI updates from API response body (AC10)
- [ ] Delete card → removed immediately
- [ ] Move card to another list → removed from source, appears at bottom of
      target; persists after page reload
- [ ] Move card to same list → no visible change, no API call (EC3)
- [ ] "No cards yet" renders in empty list

### Validation + Security

- [ ] Name with spaces only → `422` from API (`curl -X POST http://localhost:8000/boards -H 'Content-Type: application/json' -d '{"name":"   "}'`)
- [ ] Name with `\n` → `422` from API
- [ ] Title `<script>alert(1)</script>` renders as plain text, not executed
- [ ] Character counter `X/255` visible on every input form

### Error Handling

- [ ] Stop backend, attempt board create → ErrorBanner with status + message
- [ ] ErrorBanner auto-dismisses after 5 seconds
- [ ] Manual close button (×) dismisses ErrorBanner immediately
- [ ] UI data unchanged after failed API call

### Cascade

- [ ] Delete a board with lists and cards → all children removed, no orphans
- [ ] Delete a list with cards → all cards removed

---

## Known Limitations / Non-Goals

- No user authentication — all data is in a single anonymous workspace
- No real-time sync — reload the page to see changes from another tab
- No drag-and-drop — cards are moved via the dropdown selector
- No card descriptions, labels, due dates, or attachments
- Local development only — no Docker, CI, or production deployment config
