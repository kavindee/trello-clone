/**
 * Typed fetch() wrappers for all 10 backend endpoints.
 *
 * Error handling contract
 * -----------------------
 * Every function throws an `ApiError` object on any non-2xx HTTP response.
 * Callers catch it and forward it to the EC8 error banner:
 *
 *   try {
 *     const board = await createBoard(name);
 *   } catch (e) {
 *     setError(e as ApiError);   // { status, message }
 *   }
 *
 * `extractError(response)` is also exported for the rare case where a
 * component has a raw `Response` and needs to convert it to an `ApiError`.
 *
 * No `any` is used anywhere in this file.
 */

import type { Board, List, Card } from './types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/** Structured error returned (thrown) by every API wrapper on non-2xx status. */
export interface ApiError {
  status: number;
  message: string;
}

// ---------------------------------------------------------------------------
// extractError — converts a non-2xx Response into an ApiError
// ---------------------------------------------------------------------------

/**
 * Parse a FastAPI error response into a human-readable `ApiError`.
 *
 * FastAPI returns validation errors as:
 *   { "detail": [{ "loc": [...], "msg": "...", "type": "..." }] }
 * and application errors as:
 *   { "detail": "some message string" }
 *
 * Falls back to `response.statusText` when the body is not JSON.
 */
export async function extractError(response: Response): Promise<ApiError> {
  let message: string = response.statusText || `HTTP ${response.status}`;

  try {
    const body: unknown = await response.json();
    if (body !== null && typeof body === 'object') {
      const detail = (body as { detail?: unknown }).detail;
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        // Pydantic validation errors: extract each `.msg` field
        message = detail
          .map((item: unknown) => {
            if (item !== null && typeof item === 'object' && 'msg' in item) {
              return String((item as { msg: unknown }).msg);
            }
            return String(item);
          })
          .join('; ');
      }
    }
  } catch {
    // Body is not JSON — keep the statusText fallback
  }

  return { status: response.status, message };
}

// ---------------------------------------------------------------------------
// Private helper — throws ApiError on non-2xx
// ---------------------------------------------------------------------------

async function requireOk(resp: Response): Promise<void> {
  if (!resp.ok) {
    throw await extractError(resp);
  }
}

// ---------------------------------------------------------------------------
// Board endpoints
// ---------------------------------------------------------------------------

/** GET /boards — returns all boards ordered by created_at ASC. */
export async function getBoards(): Promise<Board[]> {
  const resp = await fetch(`${API_BASE}/boards`);
  await requireOk(resp);
  return resp.json() as Promise<Board[]>;
}

/** POST /boards — creates a board; returns the created Board (201). */
export async function createBoard(name: string): Promise<Board> {
  const resp = await fetch(`${API_BASE}/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  await requireOk(resp);
  return resp.json() as Promise<Board>;
}

/** GET /boards/:id — returns a single Board; throws ApiError(404) if absent. */
export async function getBoard(id: number): Promise<Board> {
  const resp = await fetch(`${API_BASE}/boards/${id}`);
  await requireOk(resp);
  return resp.json() as Promise<Board>;
}

/** DELETE /boards/:id — permanently deletes the board and all children (204). */
export async function deleteBoard(id: number): Promise<void> {
  const resp = await fetch(`${API_BASE}/boards/${id}`, { method: 'DELETE' });
  await requireOk(resp);
}

// ---------------------------------------------------------------------------
// List endpoints
// ---------------------------------------------------------------------------

/** GET /boards/:boardId/lists — returns lists ordered by position ASC. */
export async function getLists(boardId: number): Promise<List[]> {
  const resp = await fetch(`${API_BASE}/boards/${boardId}/lists`);
  await requireOk(resp);
  return resp.json() as Promise<List[]>;
}

/** POST /boards/:boardId/lists — creates a list; returns the created List (201). */
export async function createList(boardId: number, name: string): Promise<List> {
  const resp = await fetch(`${API_BASE}/boards/${boardId}/lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  await requireOk(resp);
  return resp.json() as Promise<List>;
}

/**
 * PATCH /lists/:id — updates a list's name and/or deadline.
 * At least one field must be present (backend returns 422 otherwise).
 * deadline=null clears a previously set deadline.
 */
export async function updateList(
  id: number,
  patch: { name?: string; deadline?: string | null },
): Promise<List> {
  const resp = await fetch(`${API_BASE}/lists/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  await requireOk(resp);
  return resp.json() as Promise<List>;
}

/** DELETE /lists/:id — deletes the list and all its cards (204). */
export async function deleteList(id: number): Promise<void> {
  const resp = await fetch(`${API_BASE}/lists/${id}`, { method: 'DELETE' });
  await requireOk(resp);
}

// ---------------------------------------------------------------------------
// Card endpoints
// ---------------------------------------------------------------------------

/** GET /lists/:listId/cards — returns cards ordered by position ASC (spec gap fix). */
export async function getCards(listId: number): Promise<Card[]> {
  const resp = await fetch(`${API_BASE}/lists/${listId}/cards`);
  await requireOk(resp);
  return resp.json() as Promise<Card[]>;
}

/** POST /lists/:listId/cards — creates a card; returns the created Card (201). */
export async function createCard(
  listId: number,
  payload: {
    title: string;
    description?: string | null;
    start_date?: string | null;
    due_date?: string | null;
  },
): Promise<Card> {
  const resp = await fetch(`${API_BASE}/lists/${listId}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await requireOk(resp);
  return resp.json() as Promise<Card>;
}

/**
 * PATCH /cards/:id — updates a card's fields and/or moves it to another list.
 *
 * At least one field must be present; the backend returns 422 otherwise.
 * EC3: if `list_id` equals the card's current list the backend returns the
 * unchanged card as a no-op.
 */
export async function updateCard(
  id: number,
  patch: {
    title?: string;
    list_id?: number;
    description?: string | null;
    start_date?: string | null;
    due_date?: string | null;
  },
): Promise<Card> {
  const resp = await fetch(`${API_BASE}/cards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  await requireOk(resp);
  return resp.json() as Promise<Card>;
}

/** DELETE /cards/:id — permanently deletes the card (204). */
export async function deleteCard(id: number): Promise<void> {
  const resp = await fetch(`${API_BASE}/cards/${id}`, { method: 'DELETE' });
  await requireOk(resp);
}
