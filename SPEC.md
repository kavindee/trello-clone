# SPEC.md — Kanban Board (Trello Clone MVP)
> **Revision 2** — All findings from spec review (SPEC-001 through SPEC-016) resolved.

---

## 1. Goal

A single-user, anonymous kanban board application where users can manage boards, lists, and cards — built with FastAPI, React, TypeScript, and SQLite.

---

## 2. Acceptance Criteria

### Boards

**AC1 — Create a board**
Given the home page, when the user submits a non-empty board name (≤ 255 characters), a new board appears in the board list with that name and an integer auto-increment ID.

**AC2 — List all boards**
Given at least one board exists, when the user loads the home page, all boards are displayed with their names, ordered by `created_at ASC` (oldest first). The UI renders them in the order received from the API.

**AC3 — Delete a board**
Given an existing board, when the user deletes it, the board and all its lists and cards are permanently removed within a single database transaction and no longer appear anywhere in the UI.

**AC4 — View a board**
Given an existing board, when the user navigates to it, the board's name and all of its lists are displayed in their saved order. The frontend fetches board metadata via `GET /boards/{id}` and lists via `GET /boards/{id}/lists`.

---

### Lists

**AC5 — Create a list**
Given a board detail view, when the user submits a non-empty list name (≤ 255 characters), a new list (column) is appended to the right of existing lists on that board.

**AC6 — List order is preserved**
Given lists A, B, C on a board, when the user reloads the board, they appear in the same left-to-right order they were created. Order is determined by each list's integer `position` column (`position ASC`). Deleting a list does not reindex the remaining lists' positions.

**AC7 — Delete a list**
Given an existing list, when the user deletes it, the list and all its cards are permanently removed from the board within a single database transaction.

---

### Cards

**AC8 — Create a card**
Given an existing list, when the user submits a non-empty card title (≤ 255 characters), the card appears at the bottom of that list.

**AC9 — Card order within a list is preserved**
Given cards X, Y, Z in a list, when the user reloads the board, they appear in the same top-to-bottom order they were created. Order is determined by each card's integer `position` column (`position ASC`). Deleting a card does not reindex the remaining cards' positions.

**AC10 — Edit a card title**
Given an existing card, when the user edits its title and saves, the UI re-renders the card title using the value returned in the API response body — without requiring a full board reload. No state update occurs if the API call fails.

**AC11 — Delete a card**
Given an existing card, when the user deletes it, it is removed from its list and no longer appears on reload.

**AC12 — Move a card to another list**
Given a card in List A and a "Move to list" dropdown, when the user selects List B and confirms, the card is removed from List A and appended to the bottom of List B (assigned `position = MAX(position) + 1` in the target list at the time of the operation). The move persists after reload.

---

### API Contracts

**AC13 — RESTful API coverage**
The backend exposes the following endpoints, each returning appropriate HTTP status codes:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/boards` | List all boards |
| POST | `/boards` | Create a board |
| GET | `/boards/{id}` | Get a single board by ID |
| DELETE | `/boards/{id}` | Delete a board and cascade |
| GET | `/boards/{id}/lists` | Get all lists for a board |
| POST | `/boards/{id}/lists` | Create a list on a board |
| DELETE | `/lists/{id}` | Delete a list and cascade |
| POST | `/lists/{id}/cards` | Create a card in a list |
| PATCH | `/cards/{id}` | Update card title and/or list |
| DELETE | `/cards/{id}` | Delete a card |

**PATCH `/cards/{id}` request body:**
```json
{ "title": "string (optional)", "list_id": "integer (optional)" }
```
Both fields are optional, but at least one must be present (else `422`). Returns the full updated card object. When both are provided, both mutations apply atomically within a single transaction.

**Response Schemas** (all endpoints return `application/json`):

```json
// Board
{ "id": 1, "name": "My Board", "created_at": "2025-01-01T00:00:00Z" }

// List
{ "id": 1, "board_id": 1, "name": "To Do", "position": 0, "created_at": "2025-01-01T00:00:00Z" }

// Card
{ "id": 1, "list_id": 1, "title": "Fix bug", "position": 0, "created_at": "2025-01-01T00:00:00Z" }
```

**AC14 — Input validation**
The API returns `422 Unprocessable Entity` when:
- A board name, list name, or card title is submitted as an empty string or whitespace only.
- A board name, list name, or card title exceeds 255 characters.
- A title field contains newline characters (`\n`, `\r`).
- A PATCH request body contains neither `title` nor `list_id`.

**AC15 — Not-found handling**
The API returns `404 Not Found` when referencing a board, list, or card ID that does not exist.

**AC16 — Cascade delete atomicity**
If a board or list delete operation fails mid-cascade (e.g., simulated DB error), no child records are deleted and the parent record remains. All cascade deletes execute within a single database transaction. This must be verifiable by an automated test that injects a failure after the first delete statement.

---

## 3. Constraints

- **Backend:** Python 3.11+, FastAPI, SQLite via SQLAlchemy (sync), Uvicorn.
- **Frontend:** React 18+, TypeScript, plain `fetch` for API calls (no external state management library).
- **Styling:** CSS Modules or plain CSS — no UI component library required.
- **Database:** Single SQLite file (`kanban.db`) stored locally; no migrations framework needed for MVP (create tables on startup). On startup, if table creation fails, the server must log the exception to `stderr` and exit with a non-zero code rather than starting in a broken state.
- **Entity IDs:** All entity IDs are integer auto-increment primary keys, exposed as integers in JSON responses and URL path parameters.
- **Position column:** Lists and cards each carry an integer `position` column assigned at insert time (0-based, incrementing per parent). Order is always determined by `position ASC`. Deleting a record does not reindex remaining positions.
- **API:** REST only; no GraphQL, no WebSockets.
- **CORS:** The FastAPI backend must configure CORS to allow requests from `http://localhost:5173` (Vite default) in development. The allowed origin must be configurable via an environment variable (e.g., `CORS_ORIGIN`).
- **Deployment:** Local development only (`localhost`); no Docker, CI, or hosting required.
- **No authentication:** All data is shared in a single anonymous workspace.
- **Card move mechanism:** "Move to list" dropdown UI only — no drag-and-drop.
- **Text encoding:** All title fields are stored and returned as raw UTF-8 strings with no server-side HTML encoding. The frontend is responsible for rendering titles as text content, not innerHTML.

---

## 4. Non-Goals

- **User authentication or accounts** — no login, signup, sessions, or JWT.
- **Real-time collaboration** — no WebSocket sync, no polling for live updates.
- **Drag-and-drop** — cards are moved via a dropdown selector.
- **Rich text or markdown** — card titles are plain text only.
- **Image or file attachments** — no uploads of any kind.
- **Card descriptions, due dates, labels, checklists, or comments** — title only.
- **List or card reordering** — creation order is fixed; no manual reordering in this MVP.
- **Board sharing or permissions** — no multi-user model whatsoever.
- **Search or filtering** — no query functionality.
- **Undo / redo** — deletions are permanent with no recovery.
- **Server-side HTML sanitization** — out of scope; the frontend must treat all title content as plain text.

---

## 5. Edge Cases

**EC1 — Cascade delete on board deletion**
When a board is deleted, all child lists and all cards within those lists must be deleted atomically within a single database transaction. No orphaned records shall remain in the database.

**EC2 — Cascade delete on list deletion**
When a list is deleted, all cards belonging to it must be deleted within a single database transaction. A card must never reference a non-existent list.

**EC3 — Moving a card within the same list**
If the `list_id` in the PATCH body equals the card's current `list_id`, the backend treats it as a no-op: it returns `200` with the unchanged card object and performs no write. The card's position is not modified.

**EC4 — Empty board and empty list rendering**
A board with no lists must render without error and display the text "No lists yet" centered in the board view. A list with no cards must display the text "No cards yet" centered within the column.

**EC5 — Whitespace-only input**
Submitting a board name, list name, or card title that is blank or contains only whitespace must be rejected with `422` at the API level. The UI must also prevent submission and display an inline validation message before the request is sent.

**EC6 — Deleting the only list on a board**
When a board has exactly one list and the user deletes it, the board remains and renders the "No lists yet" empty state. The board detail view must not break or return a 404.

**EC7 — Long titles**
Board names, list names, and card titles exceeding 255 characters must be rejected with `422 Unprocessable Entity`. The UI must prevent submission and display an inline character counter. No server-side truncation is performed.

**EC8 — Stale UI after failed API call**
If a create, update, delete, or move API call fails (e.g., `404` or `500`), the UI must display an inline error banner above the affected board/list/card area showing the HTTP status code and a human-readable message. The banner auto-dismisses after 5 seconds or on user dismissal. The displayed data must remain consistent with what is actually persisted. `console.error` alone does not satisfy this requirement.

**EC9 — Special characters in titles**
Titles may contain any valid UTF-8 characters including emoji, symbols, and non-Latin scripts. Titles containing newline characters (`\n`, `\r`) are rejected with `422`. The frontend must render all titles as text content (not HTML), preventing XSS via injected markup such as `<script>` tags.

---

## 6. Out-of-Scope Clarifications

- Concurrent move collisions (two clients moving the same card simultaneously) are out of scope for MVP. Last-write-wins behaviour is acceptable.
- CORS configuration for production environments is out of scope; only `localhost` origins need be supported.