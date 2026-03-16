/**
 * api.test.ts
 *
 * Tests for all api.ts wrappers and the extractError helper.
 * Uses vitest's built-in fetch mock via vi.stubGlobal so no real HTTP
 * calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractError,
  getBoards,
  createBoard,
  getBoard,
  deleteBoard,
  getLists,
  createList,
  deleteList,
  updateList,
  getCards,
  createCard,
  updateCard,
  deleteCard,
} from '../api';

// ---------------------------------------------------------------------------
// Helper — build a mock Response
// ---------------------------------------------------------------------------

function mockResponse(
  status: number,
  body: unknown,
  statusText = '',
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
    statusText,
  });
}

function mockEmptyResponse(status: number): Response {
  return new Response(null, { status });
}

// ---------------------------------------------------------------------------
// extractError
// ---------------------------------------------------------------------------

describe('extractError', () => {
  it('returns status + string detail', async () => {
    const resp = mockResponse(404, { detail: 'Board not found' }, 'Not Found');
    const err = await extractError(resp);
    expect(err.status).toBe(404);
    expect(err.message).toBe('Board not found');
  });

  it('joins array detail messages', async () => {
    const resp = mockResponse(422, {
      detail: [
        { loc: ['body', 'name'], msg: 'Value too long', type: 'string_too_long' },
        { loc: ['body', 'name'], msg: 'String required', type: 'missing' },
      ],
    });
    const err = await extractError(resp);
    expect(err.message).toBe('Value too long; String required');
  });

  it('falls back to statusText when body is not JSON', async () => {
    const resp = new Response('plain text', {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'Content-Type': 'text/plain' },
    });
    const err = await extractError(resp);
    expect(err.status).toBe(500);
    expect(err.message).toBe('Internal Server Error');
  });

  it('falls back to HTTP <status> when statusText is empty and body unparseable', async () => {
    const resp = new Response('not json', { status: 503, statusText: '' });
    const err = await extractError(resp);
    expect(err.message).toBe('HTTP 503');
  });
});

// ---------------------------------------------------------------------------
// Board endpoints
// ---------------------------------------------------------------------------

describe('getBoards', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns Board[] on 200', async () => {
    const boards = [{ id: 1, name: 'A', created_at: '2025-01-01T00:00:00Z' }];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, boards));
    const result = await getBoards();
    expect(result).toEqual(boards);
  });

  it('calls GET /boards', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, []));
    await getBoards();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('http://localhost:8000/boards');
  });

  it('throws ApiError on 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(500, { detail: 'DB error' }),
    );
    await expect(getBoards()).rejects.toMatchObject({ status: 500 });
  });
});

describe('createBoard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns created Board on 201', async () => {
    const board = { id: 2, name: 'New', created_at: '2025-01-01T00:00:00Z' };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(201, board));
    const result = await createBoard('New');
    expect(result).toEqual(board);
  });

  it('sends POST with JSON body', async () => {
    const board = { id: 3, name: 'X', created_at: '2025-01-01T00:00:00Z' };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(201, board));
    await createBoard('X');
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/boards',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'X' }),
      }),
    );
  });

  it('throws ApiError on 422', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(422, { detail: [{ msg: 'Value error', type: 'value_error', loc: [] }] }),
    );
    await expect(createBoard('')).rejects.toMatchObject({ status: 422 });
  });
});

describe('getBoard', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('returns Board on 200', async () => {
    const board = { id: 1, name: 'A', created_at: '2025-01-01T00:00:00Z' };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, board));
    expect(await getBoard(1)).toEqual(board);
  });

  it('throws ApiError(404) when board missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(404, { detail: 'Board not found' }),
    );
    await expect(getBoard(999)).rejects.toMatchObject({ status: 404 });
  });
});

describe('deleteBoard', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('resolves on 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockEmptyResponse(204));
    await expect(deleteBoard(1)).resolves.toBeUndefined();
  });

  it('sends DELETE to /boards/:id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockEmptyResponse(204));
    await deleteBoard(7);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/boards/7',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ---------------------------------------------------------------------------
// List endpoints
// ---------------------------------------------------------------------------

describe('getLists', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('returns List[] ordered by position ASC', async () => {
    const lists = [
      { id: 1, board_id: 1, name: 'A', position: 0, created_at: '' },
      { id: 2, board_id: 1, name: 'B', position: 1, created_at: '' },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, lists));
    expect(await getLists(1)).toEqual(lists);
  });

  it('calls GET /boards/:boardId/lists', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, []));
    await getLists(3);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/boards/3/lists',
    );
  });
});

describe('createList', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('returns created List on 201', async () => {
    const list = { id: 5, board_id: 2, name: 'Todo', position: 0, created_at: '' };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(201, list));
    expect(await createList(2, 'Todo')).toEqual(list);
  });
});

describe('deleteList', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('resolves on 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockEmptyResponse(204));
    await expect(deleteList(1)).resolves.toBeUndefined();
  });

  it('sends DELETE to /lists/:id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockEmptyResponse(204));
    await deleteList(9);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/lists/9',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Card endpoints
// ---------------------------------------------------------------------------

describe('getCards', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('returns Card[] on 200', async () => {
    const cards = [{ id: 1, list_id: 3, title: 'Task', position: 0, created_at: '' }];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, cards));
    expect(await getCards(3)).toEqual(cards);
  });

  it('calls GET /lists/:listId/cards', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, []));
    await getCards(7);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('http://localhost:8000/lists/7/cards');
  });

  it('throws ApiError(404) when list missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(404, { detail: 'List not found' }));
    await expect(getCards(999)).rejects.toMatchObject({ status: 404 });
  });
});

describe('createCard', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('returns created Card on 201', async () => {
    const card = {
      id: 1, list_id: 3, title: 'Task', position: 0,
      description: null, start_date: null, due_date: null, created_at: '',
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(201, card));
    expect(await createCard(3, { title: 'Task' })).toEqual(card);
  });

  it('sends POST to /lists/:listId/cards', async () => {
    const card = {
      id: 1, list_id: 3, title: 'T', position: 0,
      description: null, start_date: null, due_date: null, created_at: '',
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(201, card));
    await createCard(3, { title: 'T' });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/lists/3/cards',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends POST body with title only', async () => {
    const card = {
      id: 1, list_id: 3, title: 'T', position: 0,
      description: null, start_date: null, due_date: null, created_at: '',
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(201, card));
    await createCard(3, { title: 'T' });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/lists/3/cards',
      expect.objectContaining({ body: JSON.stringify({ title: 'T' }) }),
    );
  });

  it('sends POST body with all fields', async () => {
    const card = {
      id: 1, list_id: 3, title: 'T', position: 0,
      description: 'desc', start_date: '2025-01-01', due_date: '2025-12-31', created_at: '',
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(201, card));
    await createCard(3, {
      title: 'T', description: 'desc',
      start_date: '2025-01-01', due_date: '2025-12-31',
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/lists/3/cards',
      expect.objectContaining({
        body: JSON.stringify({
          title: 'T', description: 'desc',
          start_date: '2025-01-01', due_date: '2025-12-31',
        }),
      }),
    );
  });
});

describe('updateCard', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('sends PATCH with title only', async () => {
    const card = { id: 1, list_id: 1, title: 'New title', position: 0, created_at: '' };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, card));
    const result = await updateCard(1, { title: 'New title' });
    expect(result.title).toBe('New title');
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/cards/1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ title: 'New title' }),
      }),
    );
  });

  it('sends PATCH with list_id only (move)', async () => {
    const card = { id: 2, list_id: 5, title: 'T', position: 3, created_at: '' };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, card));
    const result = await updateCard(2, { list_id: 5 });
    expect(result.list_id).toBe(5);
  });

  it('sends PATCH with both title and list_id (atomic)', async () => {
    const card = { id: 3, list_id: 2, title: 'Updated', position: 0, created_at: '' };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, card));
    await updateCard(3, { title: 'Updated', list_id: 2 });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/cards/3',
      expect.objectContaining({
        body: JSON.stringify({ title: 'Updated', list_id: 2 }),
      }),
    );
  });

  it('throws ApiError(404) when card missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(404, { detail: 'Card not found' }),
    );
    await expect(updateCard(999, { title: 'X' })).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('deleteCard', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('resolves on 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockEmptyResponse(204));
    await expect(deleteCard(1)).resolves.toBeUndefined();
  });

  it('sends DELETE to /cards/:id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockEmptyResponse(204));
    await deleteCard(4);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/cards/4',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ---------------------------------------------------------------------------
// updateList — Task C
// ---------------------------------------------------------------------------

describe('updateList', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('sends PATCH to /lists/:id', async () => {
    const list = { id: 3, board_id: 1, name: 'Todo', position: 0, deadline: null, created_at: '' };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, list));
    await updateList(3, { deadline: null });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/lists/3',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('returns updated List on 200', async () => {
    const list = { id: 3, board_id: 1, name: 'Done', position: 0, deadline: '2025-12-31', created_at: '' };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, list));
    const result = await updateList(3, { deadline: '2025-12-31' });
    expect(result.deadline).toBe('2025-12-31');
  });

  it('sends deadline: null to clear', async () => {
    const list = { id: 3, board_id: 1, name: 'Todo', position: 0, deadline: null, created_at: '' };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, list));
    await updateList(3, { deadline: null });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/lists/3',
      expect.objectContaining({ body: JSON.stringify({ deadline: null }) }),
    );
  });

  it('sends name update', async () => {
    const list = { id: 3, board_id: 1, name: 'New Name', position: 0, deadline: null, created_at: '' };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, list));
    await updateList(3, { name: 'New Name' });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/lists/3',
      expect.objectContaining({ body: JSON.stringify({ name: 'New Name' }) }),
    );
  });

  it('throws ApiError on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(404, { detail: 'List not found' }));
    await expect(updateList(99, { deadline: null })).rejects.toMatchObject({ status: 404 });
  });
});
