/**
 * BoardDetail.test.tsx
 *
 * Integration tests for the board detail page (Task 7).
 *
 * Covers:
 *   AC4  — board name heading + lists rendered on mount
 *   AC5  — create list appends column
 *   AC7  — delete list removes column
 *   EC4  — "No lists yet" empty state
 *   EC5  — whitespace list name blocked
 *   EC6  — deleting last list shows "No lists yet"
 *   EC7  — 256-char list name blocked, character counter
 *   EC8  — ErrorBanner on any API failure
 *   EC9  — list names rendered as text (not innerHTML)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BoardDetail from '../components/BoardDetail';
import * as api from '../api';

vi.mock('../api');

const mockBoard = { id: 1, name: 'My Board', created_at: '2025-01-01T00:00:00Z' };
const mockLists = [
  { id: 10, board_id: 1, name: 'Todo', position: 0, created_at: '' },
  { id: 11, board_id: 1, name: 'Done', position: 1, created_at: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  // ListColumn (rendered by BoardDetail) calls getCards on mount
  vi.mocked(api.getCards).mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// AC4 — mount: fetch + render
// ---------------------------------------------------------------------------

describe('mount', () => {
  it('calls getBoard and getLists in parallel on mount', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={1} />);
    await waitFor(() => {
      expect(api.getBoard).toHaveBeenCalledWith(1);
      expect(api.getLists).toHaveBeenCalledWith(1);
    });
    // Both called at the same render cycle (Promise.all)
    expect(api.getBoard).toHaveBeenCalledTimes(1);
    expect(api.getLists).toHaveBeenCalledTimes(1);
  });

  it('renders board name as a heading', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={1} />);
    expect(await screen.findByRole('heading', { name: 'My Board' })).toBeInTheDocument();
  });

  it('renders a "← Back" link to #/', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={1} />);
    const backLink = await screen.findByRole('link', { name: /back/i });
    expect(backLink).toHaveAttribute('href', '#/');
  });

  it('renders each list as a column', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue(mockLists);
    render(<BoardDetail id={1} />);
    expect(await screen.findByText('Todo')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EC4 — empty state
// ---------------------------------------------------------------------------

describe('empty state', () => {
  it('shows "No lists yet" when board has no lists', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={1} />);
    expect(await screen.findByText('No lists yet')).toBeInTheDocument();
  });

  it('does NOT show "No lists yet" when lists exist', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue(mockLists);
    render(<BoardDetail id={1} />);
    await screen.findByText('Todo');
    expect(screen.queryByText('No lists yet')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 404 / load error
// ---------------------------------------------------------------------------

describe('error states on load', () => {
  it('shows "Board not found" when getBoard returns 404', async () => {
    vi.mocked(api.getBoard).mockRejectedValue({ status: 404, message: 'Not found' });
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={999} />);
    expect(await screen.findByText(/board not found/i)).toBeInTheDocument();
  });

  it('does not crash on 404', async () => {
    vi.mocked(api.getBoard).mockRejectedValue({ status: 404, message: 'Not found' });
    vi.mocked(api.getLists).mockResolvedValue([]);
    expect(() => render(<BoardDetail id={999} />)).not.toThrow();
    expect(await screen.findByText(/board not found/i)).toBeInTheDocument();
  });

  it('shows ErrorBanner for non-404 load error (EC8)', async () => {
    vi.mocked(api.getBoard).mockRejectedValue({ status: 503, message: 'Service unavailable' });
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={1} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/503/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EC7 — character counter
// ---------------------------------------------------------------------------

describe('character counter', () => {
  it('shows 0/255 initially', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={1} />);
    await screen.findByText('No lists yet');
    expect(screen.getByText('0/255')).toBeInTheDocument();
  });

  it('updates counter as user types', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={1} />);
    await screen.findByText('No lists yet');
    const input = screen.getByRole('textbox', { name: /list name/i });
    fireEvent.change(input, { target: { value: 'Hello' } });
    expect(screen.getByText('5/255')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EC5 — whitespace validation
// ---------------------------------------------------------------------------

describe('validation — empty / whitespace', () => {
  it('blocks empty submit with inline message, no API call', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={1} />);
    await screen.findByText('No lists yet');
    fireEvent.click(screen.getByRole('button', { name: /add list/i }));
    expect(screen.getByText(/list name cannot be empty/i)).toBeInTheDocument();
    expect(api.createList).not.toHaveBeenCalled();
  });

  it('blocks whitespace-only submit with inline message, no API call', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={1} />);
    await screen.findByText('No lists yet');
    const input = screen.getByRole('textbox', { name: /list name/i });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /add list/i }));
    expect(screen.getByText(/list name cannot be empty/i)).toBeInTheDocument();
    expect(api.createList).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// EC7 — 256-char blocked
// ---------------------------------------------------------------------------

describe('validation — 256-char', () => {
  it('blocks 256-char submit with inline message, no API call', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={1} />);
    await screen.findByText('No lists yet');
    const input = screen.getByRole('textbox', { name: /list name/i });
    fireEvent.change(input, { target: { value: 'a'.repeat(256) } });
    fireEvent.click(screen.getByRole('button', { name: /add list/i }));
    expect(
      screen.getByText(/list name must be 255 characters or fewer/i),
    ).toBeInTheDocument();
    expect(api.createList).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC5 — create list
// ---------------------------------------------------------------------------

describe('create list', () => {
  it('calls createList with board id and trimmed name', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    const newList = { id: 20, board_id: 1, name: 'Backlog', position: 0, created_at: '' };
    vi.mocked(api.createList).mockResolvedValue(newList);
    render(<BoardDetail id={1} />);
    await screen.findByText('No lists yet');
    const input = screen.getByRole('textbox', { name: /list name/i });
    fireEvent.change(input, { target: { value: '  Backlog  ' } });
    fireEvent.click(screen.getByRole('button', { name: /add list/i }));
    await waitFor(() =>
      expect(api.createList).toHaveBeenCalledWith(1, 'Backlog'),
    );
  });

  it('appends new list column without reload', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([mockLists[0]]);
    const newList = { id: 20, board_id: 1, name: 'Review', position: 1, created_at: '' };
    vi.mocked(api.createList).mockResolvedValue(newList);
    render(<BoardDetail id={1} />);
    await screen.findByText('Todo');
    const input = screen.getByRole('textbox', { name: /list name/i });
    fireEvent.change(input, { target: { value: 'Review' } });
    fireEvent.click(screen.getByRole('button', { name: /add list/i }));
    expect(await screen.findByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Todo')).toBeInTheDocument(); // original column still present
  });

  it('clears input after successful create', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    const newList = { id: 20, board_id: 1, name: 'Sprint', position: 0, created_at: '' };
    vi.mocked(api.createList).mockResolvedValue(newList);
    render(<BoardDetail id={1} />);
    await screen.findByText('No lists yet');
    const input = screen.getByRole('textbox', { name: /list name/i });
    fireEvent.change(input, { target: { value: 'Sprint' } });
    fireEvent.click(screen.getByRole('button', { name: /add list/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
  });

  it('removes "No lists yet" after first list created', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    const newList = { id: 20, board_id: 1, name: 'Alpha', position: 0, created_at: '' };
    vi.mocked(api.createList).mockResolvedValue(newList);
    render(<BoardDetail id={1} />);
    await screen.findByText('No lists yet');
    fireEvent.change(screen.getByRole('textbox', { name: /list name/i }), {
      target: { value: 'Alpha' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add list/i }));
    await screen.findByText('Alpha');
    expect(screen.queryByText('No lists yet')).not.toBeInTheDocument();
  });

  it('shows ErrorBanner on createList failure, list unchanged (EC8)', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([mockLists[0]]);
    vi.mocked(api.createList).mockRejectedValue({ status: 500, message: 'DB fail' });
    render(<BoardDetail id={1} />);
    await screen.findByText('Todo');
    const input = screen.getByRole('textbox', { name: /list name/i });
    fireEvent.change(input, { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: /add list/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument(); // list unchanged
  });
});

// ---------------------------------------------------------------------------
// AC7 / EC6 — delete list
// ---------------------------------------------------------------------------

describe('delete list', () => {
  it('removes column after successful delete', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([...mockLists]);
    vi.mocked(api.deleteList).mockResolvedValue(undefined);
    render(<BoardDetail id={1} />);
    await screen.findByText('Todo');
    // click delete on the first list column (Todo)
    const items = screen.getAllByRole('listitem');
    const todoItem = items.find((el) => el.textContent?.includes('Todo'));
    const deleteBtn = todoItem!.querySelector('button')!;
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(screen.queryByText('Todo')).not.toBeInTheDocument());
    expect(screen.getByText('Done')).toBeInTheDocument(); // sibling untouched
  });

  it('shows "No lists yet" after last list deleted (EC6)', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([mockLists[0]]);
    vi.mocked(api.deleteList).mockResolvedValue(undefined);
    render(<BoardDetail id={1} />);
    await screen.findByText('Todo');
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(await screen.findByText('No lists yet')).toBeInTheDocument();
  });

  it('shows ErrorBanner on delete failure, list unchanged (EC8)', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([mockLists[0]]);
    vi.mocked(api.deleteList).mockRejectedValue({ status: 500, message: 'Fail' });
    render(<BoardDetail id={1} />);
    await screen.findByText('Todo');
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Todo')).toBeInTheDocument(); // list unchanged
  });
});

// ---------------------------------------------------------------------------
// EC9 — XSS safety
// ---------------------------------------------------------------------------

describe('EC9 — XSS safety', () => {
  it('renders script-tag list name as plain text', async () => {
    const xssList = {
      id: 99,
      board_id: 1,
      name: '<script>alert(1)</script>',
      position: 0,
      created_at: '',
    };
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([xssList]);
    render(<BoardDetail id={1} />);
    expect(
      await screen.findByText('<script>alert(1)</script>'),
    ).toBeInTheDocument();
    expect(document.querySelector('script[data-xss]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Validation error clears on typing
// ---------------------------------------------------------------------------

describe('validation error clears on typing', () => {
  it('clears inline error as user types', async () => {
    vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.getLists).mockResolvedValue([]);
    render(<BoardDetail id={1} />);
    await screen.findByText('No lists yet');
    fireEvent.click(screen.getByRole('button', { name: /add list/i }));
    expect(screen.getByText(/list name cannot be empty/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /list name/i }), {
      target: { value: 'A' },
    });
    expect(screen.queryByText(/list name cannot be empty/i)).not.toBeInTheDocument();
  });
});
