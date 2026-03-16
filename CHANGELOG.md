# Changelog

All notable changes to this project are documented here.

---

## [Unreleased]

### Card creation modal + types update (Frontend) (2026-03-16)

**Changed**
- `frontend/src/types.ts` — `Card` interface: removed `deadline`, added
  `description: string | null`, `start_date: string | null`,
  `due_date: string | null`. `List.deadline` unchanged.
- `frontend/src/api.ts`:
  - `createCard(listId, payload)` — payload is now an object
    `{ title, description?, start_date?, due_date? }` instead of a bare string.
  - `updateCard` patch type: removed `deadline?`, added `description?`,
    `start_date?`, `due_date?` (all `string | null`).
- `frontend/src/components/ListColumn.tsx`:
  - Replaced inline create-card `<form>` with an **"Add a card" button**.
  - Clicking the button opens `<CardModal mode="create" />`.
  - `handleModalSuccess(card)` appends the new card and closes the modal.
  - `applyFilter` / `applySort` updated to use `c.due_date` instead of
    `c.deadline` for sort/filter logic.
  - Removed: `createCard` import, `createInput`/`createError`/`submitting`
    state, `handleCreateCard`, `validateCardTitle`, `MAX_LEN`, inline form JSX.
- `frontend/src/components/CardItem.tsx` (minimal compile fix):
  - Removed `DatePicker` import and CSS import.
  - Removed `parseDateStr`, `formatDateToISO`, `getDeadlineStatus`,
    `DeadlineStatus`, `DeadlineBadge` — no longer needed after `deadline`
    removal from `Card`.
  - `editDeadline` / `displayDeadline` state removed; `handleSave` patch no
    longer includes `deadline`. Full `description`/`start_date`/`due_date`
    support will be added in the next prompt via `CardModal`.

**Added**
- `frontend/src/components/CardModal.tsx` — new modal overlay component:
  - **Create mode**: title (required, ≤255 chars), description (optional,
    ≤1000 chars), start/due date pickers. Calls `createCard(listId, payload)`.
  - **Edit mode**: pre-fills all fields from `card` prop; sends only changed
    fields via `updateCard`; includes move-to-list dropdown.
  - Date validation: `start_date > due_date` → inline "Start date must be
    before due date" error, blocks submission.
  - Closes on: Cancel button | backdrop click | Escape key.
  - Stays open + shows `ErrorBanner` on API failure.
  - `data-testid="card-modal-backdrop"` / `"card-modal-box"` for test targeting.
- `frontend/src/styles/CardModal.module.css` — backdrop, centered dialog,
  field labels, title input, description textarea, two-column date row,
  footer with Cancel / Submit buttons.
- `frontend/src/styles/ListColumn.module.css` — `.addCardBtn` dashed-border
  button style.

**Tests**
- `frontend/src/test/CardModal.test.tsx` (NEW — 29 tests):
  renders, title/description/date validation, create success/failure,
  close behaviours (Cancel / backdrop / Escape), edit mode pre-fill + save.
  React-datepicker mocked as a plain `<input>` for test simplicity.
- `frontend/src/test/ListColumn.test.tsx` — fully rewritten:
  - Mock cards use `description`/`start_date`/`due_date` (not `deadline`).
  - `sortCards` / `filterCards` use `due_date`.
  - Old "create card form" tests removed; replaced by 6 new modal tests:
    button renders, click opens modal, `onSuccess` appends card + closes modal,
    `onClose` dismisses modal without adding card.
  - `CardModal` mocked with a minimal stub.
- `frontend/src/test/CardItem.test.tsx` — rewritten:
  - Mock card uses new fields; deadline badge/editor describe blocks removed
    (feature retired from `CardItem` in this step).
  - All 14 remaining tests (display, delete, move, edit-title) pass.
- `frontend/src/test/api.test.ts` — `createCard` describe block updated
  for new payload signature; 2 new tests (body with title only, body with
  all fields).
- `frontend/src/test/types.test.ts` — `Card` describe updated to test
  `due_date`, `description`, `start_date` instead of `deadline`.
- `frontend/src/test/BoardDetail.test.tsx` — `CardModal` mocked; card
  fixtures in Task D tests updated to use `due_date`.

**Verified**
- `npm test` → **208 / 208 passed** (9 files), 0 failures
- `npm run build` → TypeScript clean, 0 errors, 385 kB JS
- "Add a card" button opens modal ✓
- Modal title-only submit → card created, modal closes ✓
- Modal `start_date > due_date` → inline error, no API call ✓
- Escape key and backdrop click close the modal ✓
- Failed API call → ErrorBanner inside modal, stays open ✓
- No backend files modified ✓

### Card fields — description, start_date, due_date (Backend) (2026-03-16)

**Changed**
- `backend/models.py` — `Card.deadline` replaced with three nullable columns:
  `description TEXT`, `start_date DATE`, `due_date DATE`.
  `List.deadline` is unchanged.
- `backend/schemas.py` — Added `model_validator` import.
  - `CardCreate`: added `description`, `start_date`, `due_date` optional fields;
    `model_validator(mode="after")` raises 422 when `start_date > due_date`.
  - `CardPatch`: removed `deadline`, added `description`, `start_date`,
    `due_date` with sentinel pattern (`model_fields_set` distinguishes
    "not provided" from "explicitly null"); same date-order validation.
    "At least one field" guard updated to cover all five patchable fields.
  - `CardResponse`: replaced `deadline` with `description`, `start_date`,
    `due_date`.
- `backend/routers/cards.py` — `create_card` passes new fields to `models.Card()`.
  `patch_card` uses `description_set`, `start_date_set`, `due_date_set`
  sentinels; EC3 no-op still prevents any write when `list_id == card.list_id`.
- `backend/main.py` — Migrations block updated: removed
  `ALTER TABLE cards ADD COLUMN deadline DATE`; added
  `ALTER TABLE cards ADD COLUMN description TEXT`,
  `ALTER TABLE cards ADD COLUMN start_date DATE`,
  `ALTER TABLE cards ADD COLUMN due_date DATE`.
  `ALTER TABLE lists ADD COLUMN deadline DATE` is retained unchanged.

**Added (tests)**
- `backend/tests/test_cards.py` — `TestCardDeadline` removed; replaced by
  `TestCardNewFields` (30 tests) covering all required cases:
  create with description, create with dates, start_date > due_date → 422,
  only start_date → 201, PATCH description, PATCH due_date null clears,
  PATCH start_date > due_date → 422, sentinel explicit-null, EC3 with due_date.
- `backend/tests/test_smoke.py` — `test_card_columns` updated to expect
  `description`, `start_date`, `due_date` instead of `deadline`.
- `backend/tests/test_lists.py` — Two card-response tests updated:
  `test_get_cards_response_includes_deadline_field` →
  `test_get_cards_response_includes_due_date_field`;
  `test_get_cards_new_card_deadline_is_null` →
  `test_get_cards_new_card_due_date_is_null`.

**Verified**
- `pytest backend/tests/` → **204 passed**, 0 failures
- POST with description + dates → 201, all fields in response ✓
- POST with start_date > due_date → 422 ✓
- PATCH with start_date > due_date → 422 ✓
- PATCH due_date=null clears the field ✓
- GET /lists/{id}/cards returns description, start_date, due_date ✓
- List deadline column untouched ✓
- No frontend files modified ✓

### Task D — Sort and Filter by Deadline (Frontend) (2026-03-16)

**Changed**
- `frontend/src/components/ListColumn.tsx`:
  - Exported `FilterMode = 'all' | 'due-soon' | 'overdue'` type
  - New prop `boardFilter?: FilterMode` (defaults `'all'`; when `!= 'all'`
    it overrides the per-column filter and disables the filter button)
  - New state: `sortByDeadline: boolean`, `filterMode: FilterMode`
  - `applyFilter(cards, filter)` — pure function; 'due-soon' = today or
    tomorrow (local-time comparison); 'overdue' = deadline < today
  - `applySort(cards, sortOn)` — pure function; ISO strings sort
    lexicographically; nulls last
  - `cycleFilter(f)` — 3-way cycle: all → due-soon → overdue → all
  - Toolbar rendered between header and deadline badge:
    - **Sort toggle** — `aria-pressed`, label "Sort by deadline" / "Sort:
      deadline ↑"; no API call, no position change
    - **Filter cycle button** — `aria-label=FILTER_LABEL[effectiveFilter]`,
      `disabled` when `boardFilter` is active,
      `data-testid="column-filter-btn"` for unambiguous test selection
  - `visibleCards = applySort(applyFilter(cards, effectiveFilter), sortOn)`
    replaces raw `cards` in the render
- `frontend/src/components/BoardDetail.tsx`:
  - New state: `boardFilter: FilterMode` (default `'all'`)
  - Imports `FilterMode` from `ListColumn`
  - Board-wide filter bar rendered below topBar (only when board loaded):
    3 pill buttons "All" / "Due soon" / "Overdue";
    `aria-label="Board filter: {label}"` for unambiguous selection;
    `aria-pressed` reflects active state
  - `boardFilter` passed to each `ListColumn`
- `frontend/src/styles/ListColumn.module.css` — added `.toolbar`,
  `.toolbarBtn`, `.toolbarBtnActive` (indigo when active, disabled opacity)
- `frontend/src/styles/BoardDetail.module.css` — added `.filterBar`,
  `.filterBarBtn`, `.filterBarBtnActive` (indigo pill buttons)

**Added (tests — TDD)**
- `frontend/src/test/ListColumn.test.tsx` — 11 new tests (2 describe blocks):
  - "sort by deadline" (4): default position order, sort ASC nulls-last,
    active label, toggle off restores order
  - "filter cards" (7): All shows all, Due-soon shows today-only card,
    Overdue shows past card, cycle All→DS→OV→All, boardFilter prop
    overrides local filter, boardFilter disables filter button

  **Key design**: no fake timers; `'2020-01-01'` always overdue,
  `todayISO` computed at module load for 'soon', `'2099-12-31'` always
  future; sort tests use ISO lexicographic ordering which is date-independent
- `frontend/src/test/BoardDetail.test.tsx` — 5 new tests in
  "BoardDetail — board-wide filter":
  - Filter bar buttons present; Overdue hides future cards; Overdue
    disables per-column filter button (`getByTestId('column-filter-btn')`);
    All re-enables it; All restores all cards

**Lessons learned (recorded in AGENTS.md)**
- `vi.useFakeTimers()` in `beforeEach` + `screen.findByText/findByRole`
  = infinite hang: `waitFor` polls via `setTimeout` which is frozen.
  Use absolute dates (`'2020-01-01'` / `'2099-12-31'`) and dynamic
  `todayISO` instead of freezing the clock for deadline UI tests.
- Multiple elements with same aria-label prefix: use `data-testid` or
  distinct prefixes ("Board filter: X" vs "Filter: X") to disambiguate.

**Verified**
- `npm test` → **199 passed** (8 files), 0 failures
- `npm run build` → TypeScript clean + Vite 385 kB JS, 0 errors
- Sort toggle reorders by deadline ASC, nulls last ✓
- Filter "Due soon" hides overdue + future + null ✓
- Filter "Overdue" hides due-soon + future + null ✓
- Board-wide Overdue filter disables per-column filter button ✓
- Board-wide All re-enables per-column controls ✓

---

### Task C — List Deadline Badge + Inline Editor (Frontend) (2026-03-16)

**Changed**
- `frontend/src/types.ts` — `List.deadline: string | null` added (ISO
  "YYYY-MM-DD" or null).
- `frontend/src/api.ts` — `updateList(id, patch)` added: `PATCH /lists/:id`
  with `{ name?: string; deadline?: string | null }`.
- `frontend/src/components/ListColumn.tsx` — deadline support:
  - `displayDeadline` state (from `list.deadline`; updated from API response
    body after save — same AC10 pattern used on cards)
  - `editDeadline` state (seeded from `displayDeadline` on open)
  - `getListDeadlineStatus` / `parseDateStr` / `formatDateToISO` helpers
    (local copies; same logic as CardItem helpers)
  - `ListDeadlineBadge` sub-component renders `data-testid="list-deadline-{status}"`
    span below the header row
  - Header: `📅` "Edit list deadline" button added alongside Delete
  - Inline deadline editor panel (below header, shown when `editingDeadline`):
    `react-datepicker` + Clear + Save + Cancel buttons; Save calls
    `updateList({ deadline: editDeadline })`; failure shows ErrorBanner and
    leaves `displayDeadline` unchanged (EC8 pattern)
- `frontend/src/styles/ListColumn.module.css` — added `.deadlineBadgeRow`,
  `.deadlineBadge` base, `.deadlineOverdue`, `.deadlineSoon`, `.deadlineFuture`
  pills; `.editDeadlineBtn`, `.deadlineEditor`, `.deadlinePickerRow`,
  `.deadlinePickerWrap` (react-datepicker overrides), `.clearDeadlineBtn`,
  `.deadlineEditorBtns`, `.saveDeadlineBtn`, `.cancelDeadlineBtn`

**Changed (tests — type ripple from `List.deadline` now required)**
- `frontend/src/test/CardItem.test.tsx` — `mockAllLists` items updated with
  `deadline: null`
- `frontend/src/test/ListColumn.test.tsx` — `mockList` + `mockAllLists` updated
  with `deadline: null`; `afterEach` added to vitest imports
- `frontend/src/test/BoardDetail.test.tsx` — `mockLists`, `newList` objects,
  and `xssList` updated with `deadline: null`
- `frontend/src/test/types.test.ts` — List objects updated with `deadline: null`;
  2 new List deadline tests added
- `frontend/src/test/BoardDetail.test.tsx` — "removes column after successful
  delete" test updated to use `aria-label` selector (avoids accidentally
  clicking the new `📅` button instead of Delete)

**Added (tests — TDD, written before implementation)**
- `frontend/src/test/ListColumn.test.tsx` — 12 new tests:
  - "list deadline badge" (5): no badge when null, red/yellow/grey for
    yesterday/today/future; uses `vi.useFakeTimers()` in `beforeEach`/
    `afterEach`
  - "deadline editor" (7): Edit button present, clicking opens editor,
    Cancel closes without API call, Clear+Save sends `deadline: null`,
    Save sends current deadline, failed Save shows ErrorBanner + badge
    unchanged (uses `'2099-06-22'` to avoid fake-timer leak), successful
    Save updates deadline from API response body (uses `'2099-12-31'`)
- `frontend/src/test/api.test.ts` — 5 new tests for `updateList`:
  PATCH URL, returns updated list, sends `deadline: null`, sends name,
  throws ApiError on 404

**Verified**
- `npm test` → **184 passed** (8 files), 0 failures
- `npm run build` → TypeScript clean + Vite 383 kB JS, 0 errors
- List header shows correct badge (overdue/soon/future/none) ✓
- `📅` button opens inline deadline editor ✓
- Clear + Save → `updateList({ deadline: null })` called ✓
- Failed save → ErrorBanner, badge unchanged (EC8) ✓
- Successful save → badge updated from API response body ✓

---

### Task B — Deadline Badge + Date Picker (Frontend) (2026-03-16)

**Installed**
- `react-datepicker` + `@types/react-datepicker`

**Changed**
- `frontend/src/types.ts` — `Card.deadline: string | null` added (ISO
  "YYYY-MM-DD" or null); `List` interface unchanged (backend returns it,
  frontend ignores it for now).
- `frontend/src/api.ts` — `updateCard` patch type extended with
  `deadline?: string | null` (null = clear the deadline).
- `frontend/src/components/CardItem.tsx` — full deadline support:
  - `displayDeadline` state (mirrors AC10 pattern — set only from API
    response body, not from local input)
  - `editDeadline` state (initialised from `displayDeadline` in `startEdit`)
  - `getDeadlineStatus(deadline)` pure function → `'overdue' | 'soon' |
    'future' | null`; uses local-time `new Date(y, m-1, d)` to avoid UTC
    offset shifting the day
  - `DeadlineBadge` sub-component renders `data-testid="deadline-{status}"`
    span with the appropriate CSS class; renders nothing when deadline is null
  - `parseDateStr` / `formatDateToISO` helpers for react-datepicker ↔ ISO
    string conversion
  - Edit mode: `react-datepicker` input + "Clear" button
    (`aria-label="Clear deadline"`)
  - `handleSave`: deadline only included in PATCH when it differs from
    `displayDeadline` (avoids unnecessary writes); `displayDeadline` updated
    from API response body after save
- `frontend/src/styles/CardItem.module.css` — added `.deadlineOverdue`
  (red pill), `.deadlineSoon` (yellow pill), `.deadlineFuture` (grey pill),
  `.deadlineRow`, `.datepickerWrapper` (overrides react-datepicker input
  to match card style), `.clearDeadlineBtn`, `.deadlineLabel`

**Changed (tests — type ripple from `Card.deadline` now required)**
- `frontend/src/test/types.test.ts` — Card objects updated with
  `deadline: null`; added 2 new tests (accepts ISO string, accepts null)
- `frontend/src/test/CardItem.test.tsx` — `mockCard` updated with
  `deadline: null as string | null`; all `mockResolvedValue` card spreads
  carry the field
- `frontend/src/test/ListColumn.test.tsx` — `mockCards` elements +
  `createCard`/`updateCard` mock return objects updated with `deadline: null`

**Added (tests — TDD, written before implementation)**
- `frontend/src/test/CardItem.test.tsx` — 12 new tests in two describe
  blocks:
  - "deadline badge (display mode)" (6): no badge when null, red badge for
    yesterday, yellow badge for today, yellow badge for tomorrow, grey badge
    for 7 days out, badge shows date text; uses `vi.useFakeTimers()` +
    `vi.setSystemTime()` within `beforeEach`/`afterEach`
  - "deadline in edit mode" (6): Clear button present in edit mode (with
    and without deadline), Clear→Save sends `deadline: null` in patch,
    deadline NOT in patch when unchanged (null→null), deadline from API
    response body (AC10 pattern — uses `'2099-12-31'` so no fake timers
    needed), no badge after save when API returns null

**Verified**
- `npm test` → **165 passed** (8 files), 0 failures
- `npm run build` → TypeScript clean + Vite 380 kB JS, 0 errors
- Card with past deadline shows red `deadline-overdue` badge ✓
- Card with deadline today/tomorrow shows yellow `deadline-soon` badge ✓
- Card with far-future deadline shows grey `deadline-future` badge ✓
- Card with no deadline shows no badge ✓
- Clear button in edit mode → PATCH includes `deadline: null` ✓
- Deadline from API response used (not local state) — AC10 pattern ✓
- Unchanged deadline (null→null) not included in PATCH body ✓

---

### Task A — Deadline Support (Backend) (2026-03-16)

**Added**
- `backend/models.py` — nullable `deadline DATE` column on both `List` and
  `Card` ORM models (`Mapped[Optional[date]]`, `Date`, `nullable=True`).
- `backend/schemas.py` — `ListPatch` schema: `name: Optional[str]` +
  `deadline: Optional[date]`; at least one required (enforced in router via
  `model_fields_set`); name validated with existing whitespace/newline rules.
- `backend/routers/lists.py` — `PATCH /lists/{list_id}` endpoint: updates
  name and/or deadline atomically; `deadline=null` (explicit) clears value;
  uses `model_fields_set` sentinel to distinguish "not sent" from "send null";
  404 if list missing; 422 if neither field provided.
- `backend/main.py` — idempotent ALTER TABLE routine runs after `create_all`:
  issues `ALTER TABLE lists ADD COLUMN deadline DATE` and
  `ALTER TABLE cards ADD COLUMN deadline DATE`; each wrapped in `try/except`
  that silently ignores `OperationalError` (column already exists).

**Changed**
- `backend/schemas.py` — `ListResponse` gains `deadline: Optional[date]`;
  `CardResponse` gains `deadline: Optional[date]`; `CardPatch` gains
  `deadline: Optional[date]` (sentinel via `model_fields_set`).
- `backend/routers/cards.py` — `PATCH /cards/{id}`: extended "at least one
  field" guard to include `deadline` (via `model_fields_set`); `deadline`
  applied after move logic; EC3 same-list no-op still suppresses all writes
  including deadline; both `deadline` and the existing fields applied in one
  `db.commit()`.
- `backend/tests/test_smoke.py` — updated `test_list_columns` and
  `test_card_columns` to include `"deadline"` in the expected column sets.

**Added (tests — TDD, written before implementation)**
- `backend/tests/test_lists.py` — `TestPatchList` (16 tests): name-only,
  deadline-only, both, clear-deadline, DB persistence, 422 (no fields),
  422 (null name only), 404, response schema, whitespace name rejected.
  `TestDeadlineInGetEndpoints` (5 tests): `deadline` field in
  `GET /boards/{id}/lists` and `GET /lists/{id}/cards` responses.
- `backend/tests/test_cards.py` — `TestCardDeadline` (16 tests): `deadline`
  in GET response, set/clear deadline, DB persistence, combined with
  title/list_id, deadline-only counts as valid patch, EC3 suppresses deadline
  write, `{}` still 422.

**Verified**
- `pytest backend/tests/` → **190 passed**, 0 failures, 0 errors
- `GET /boards/{id}/lists` → each list includes `deadline` field ✓
- `GET /lists/{id}/cards` → each card includes `deadline` field ✓
- `PATCH /lists/{id}` → name-only, deadline-only, both, clear ✓
- `PATCH /cards/{id}` with `deadline: null` → clears value ✓
- EC3 no-op: same `list_id` + `deadline` → no write, deadline stays null ✓
- `{}` PATCH → 422 (at least one field still required) ✓
- ALTER TABLE idempotent → re-runs without error ✓

---

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
