/**
 * BoardList.test.tsx
 *
 * Tests for the home page component covering:
 *   AC1  — create board appends to list
 *   AC2  — boards fetched on mount, rendered as links
 *   AC3  — delete board removes from list
 *   EC4  — "No boards yet" empty state
 *   EC5  — whitespace input blocked (no API call)
 *   EC7  — 256-char input blocked, character counter shown
 *   EC8  — API failure shows ErrorBanner, UI unchanged
 *   EC9  — board names rendered as text (not innerHTML)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BoardList from '../components/BoardList';
import * as api from '../api';

vi.mock('../api');

const mockBoards = [
  { id: 1, name: 'Alpha', created_at: '2025-01-01T00:00:00Z' },
  { id: 2, name: 'Beta', created_at: '2025-01-02T00:00:00Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC2 — Fetch + render on mount
// ---------------------------------------------------------------------------

describe('mount — fetch boards', () => {
  it('calls getBoards on mount', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    render(<BoardList />);
    await waitFor(() => expect(api.getBoards).toHaveBeenCalledTimes(1));
  });

  it('renders each board name as a link', async () => {
    vi.mocked(api.getBoards).mockResolvedValue(mockBoards);
    render(<BoardList />);
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(await screen.findByText('Beta')).toBeInTheDocument();
  });

  it('links point to #/boards/:id', async () => {
    vi.mocked(api.getBoards).mockResolvedValue(mockBoards);
    render(<BoardList />);
    const link = await screen.findByRole('link', { name: 'Alpha' });
    expect(link).toHaveAttribute('href', '#/boards/1');
  });

  it('shows ErrorBanner when getBoards fails on mount', async () => {
    vi.mocked(api.getBoards).mockRejectedValue({ status: 500, message: 'DB error' });
    render(<BoardList />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(await screen.findByText(/500/)).toBeInTheDocument();
    expect(await screen.findByText(/DB error/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EC4 — Empty state
// ---------------------------------------------------------------------------

describe('empty state', () => {
  it('shows "No boards yet" when board list is empty', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    render(<BoardList />);
    expect(await screen.findByText('No boards yet')).toBeInTheDocument();
  });

  it('does NOT show "No boards yet" when boards exist', async () => {
    vi.mocked(api.getBoards).mockResolvedValue(mockBoards);
    render(<BoardList />);
    await screen.findByText('Alpha');
    expect(screen.queryByText('No boards yet')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EC7 — Character counter
// ---------------------------------------------------------------------------

describe('character counter', () => {
  it('shows 0/255 initially', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    render(<BoardList />);
    await screen.findByText('No boards yet');
    expect(screen.getByText('0/255')).toBeInTheDocument();
  });

  it('updates counter as user types', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    render(<BoardList />);
    await screen.findByText('No boards yet');
    const input = screen.getByRole('textbox', { name: /board name/i });
    fireEvent.change(input, { target: { value: 'Hello' } });
    expect(screen.getByText('5/255')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EC5 — Whitespace input blocked
// ---------------------------------------------------------------------------

describe('validation — empty / whitespace', () => {
  it('shows inline error for empty input, makes no API call', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    render(<BoardList />);
    await screen.findByText('No boards yet');
    fireEvent.click(screen.getByRole('button', { name: /add board/i }));
    expect(screen.getByText(/board name cannot be empty/i)).toBeInTheDocument();
    expect(api.createBoard).not.toHaveBeenCalled();
  });

  it('shows inline error for whitespace-only input, makes no API call', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    render(<BoardList />);
    await screen.findByText('No boards yet');
    const input = screen.getByRole('textbox', { name: /board name/i });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /add board/i }));
    expect(screen.getByText(/board name cannot be empty/i)).toBeInTheDocument();
    expect(api.createBoard).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// EC7 — 256-char input blocked
// ---------------------------------------------------------------------------

describe('validation — 256-char name', () => {
  it('shows inline error for 256-char input, makes no API call', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    render(<BoardList />);
    await screen.findByText('No boards yet');
    const input = screen.getByRole('textbox', { name: /board name/i });
    fireEvent.change(input, { target: { value: 'a'.repeat(256) } });
    fireEvent.click(screen.getByRole('button', { name: /add board/i }));
    expect(
      screen.getByText(/board name must be 255 characters or fewer/i),
    ).toBeInTheDocument();
    expect(api.createBoard).not.toHaveBeenCalled();
  });

  it('does NOT show length error for exactly 255-char input', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    const newBoard = { id: 10, name: 'a'.repeat(255), created_at: '' };
    vi.mocked(api.createBoard).mockResolvedValue(newBoard);
    render(<BoardList />);
    await screen.findByText('No boards yet');
    const input = screen.getByRole('textbox', { name: /board name/i });
    fireEvent.change(input, { target: { value: 'a'.repeat(255) } });
    fireEvent.click(screen.getByRole('button', { name: /add board/i }));
    expect(
      screen.queryByText(/board name must be 255 characters or fewer/i),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(api.createBoard).toHaveBeenCalledTimes(1));
  });
});

// ---------------------------------------------------------------------------
// AC1 — Create board
// ---------------------------------------------------------------------------

describe('create board', () => {
  it('calls createBoard with trimmed name on valid submit', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    const newBoard = { id: 3, name: 'Gamma', created_at: '2025-01-03T00:00:00Z' };
    vi.mocked(api.createBoard).mockResolvedValue(newBoard);
    render(<BoardList />);
    await screen.findByText('No boards yet');
    const input = screen.getByRole('textbox', { name: /board name/i });
    fireEvent.change(input, { target: { value: '  Gamma  ' } });
    fireEvent.click(screen.getByRole('button', { name: /add board/i }));
    await waitFor(() =>
      expect(api.createBoard).toHaveBeenCalledWith('Gamma'),
    );
  });

  it('appends new board to list without reload', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([mockBoards[0]]);
    const newBoard = { id: 3, name: 'Gamma', created_at: '2025-01-03T00:00:00Z' };
    vi.mocked(api.createBoard).mockResolvedValue(newBoard);
    render(<BoardList />);
    await screen.findByText('Alpha');
    const input = screen.getByRole('textbox', { name: /board name/i });
    fireEvent.change(input, { target: { value: 'Gamma' } });
    fireEvent.click(screen.getByRole('button', { name: /add board/i }));
    expect(await screen.findByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument(); // existing board remains
  });

  it('clears the input after successful create', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    const newBoard = { id: 3, name: 'Gamma', created_at: '2025-01-03T00:00:00Z' };
    vi.mocked(api.createBoard).mockResolvedValue(newBoard);
    render(<BoardList />);
    await screen.findByText('No boards yet');
    const input = screen.getByRole('textbox', { name: /board name/i });
    fireEvent.change(input, { target: { value: 'Gamma' } });
    fireEvent.click(screen.getByRole('button', { name: /add board/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
  });

  it('removes "No boards yet" after first board created', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    const newBoard = { id: 3, name: 'First', created_at: '' };
    vi.mocked(api.createBoard).mockResolvedValue(newBoard);
    render(<BoardList />);
    await screen.findByText('No boards yet');
    const input = screen.getByRole('textbox', { name: /board name/i });
    fireEvent.change(input, { target: { value: 'First' } });
    fireEvent.click(screen.getByRole('button', { name: /add board/i }));
    await screen.findByText('First');
    expect(screen.queryByText('No boards yet')).not.toBeInTheDocument();
  });

  it('shows ErrorBanner on createBoard failure, list unchanged', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([mockBoards[0]]);
    vi.mocked(api.createBoard).mockRejectedValue({ status: 500, message: 'DB error' });
    render(<BoardList />);
    await screen.findByText('Alpha');
    const input = screen.getByRole('textbox', { name: /board name/i });
    fireEvent.change(input, { target: { value: 'Gamma' } });
    fireEvent.click(screen.getByRole('button', { name: /add board/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument(); // list unchanged
  });
});

// ---------------------------------------------------------------------------
// AC3 — Delete board
// ---------------------------------------------------------------------------

describe('delete board', () => {
  it('renders a delete button for each board', async () => {
    vi.mocked(api.getBoards).mockResolvedValue(mockBoards);
    render(<BoardList />);
    await screen.findByText('Alpha');
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons).toHaveLength(2);
  });

  it('calls deleteBoard with correct id', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([mockBoards[0]]);
    vi.mocked(api.deleteBoard).mockResolvedValue(undefined);
    render(<BoardList />);
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(api.deleteBoard).toHaveBeenCalledWith(1));
  });

  it('removes board from list after successful delete', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([...mockBoards]);
    vi.mocked(api.deleteBoard).mockResolvedValue(undefined);
    render(<BoardList />);
    await screen.findByText('Alpha');
    // find delete button associated with Alpha (first board)
    const items = screen.getAllByRole('listitem');
    const alphaItem = items.find((el) => el.textContent?.includes('Alpha'));
    const deleteBtn = alphaItem!.querySelector('button')!;
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(screen.queryByText('Alpha')).not.toBeInTheDocument());
    expect(screen.getByText('Beta')).toBeInTheDocument(); // sibling untouched
  });

  it('shows "No boards yet" after last board deleted', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([mockBoards[0]]);
    vi.mocked(api.deleteBoard).mockResolvedValue(undefined);
    render(<BoardList />);
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(await screen.findByText('No boards yet')).toBeInTheDocument();
  });

  it('shows ErrorBanner on deleteBoard failure, list unchanged', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([mockBoards[0]]);
    vi.mocked(api.deleteBoard).mockRejectedValue({ status: 500, message: 'Fail' });
    render(<BoardList />);
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument(); // list unchanged
  });
});

// ---------------------------------------------------------------------------
// EC9 — XSS: board name rendered as text, not innerHTML
// ---------------------------------------------------------------------------

describe('EC9 — XSS safety', () => {
  it('renders script-tag board name as plain text', async () => {
    const xssBoard = {
      id: 99,
      name: '<script>alert(1)</script>',
      created_at: '',
    };
    vi.mocked(api.getBoards).mockResolvedValue([xssBoard]);
    render(<BoardList />);
    // The raw string must appear as text content
    expect(
      await screen.findByText('<script>alert(1)</script>'),
    ).toBeInTheDocument();
    // No actual <script> element injected into the DOM
    expect(document.querySelector('script[data-xss]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EC8 — ErrorBanner can be dismissed
// ---------------------------------------------------------------------------

describe('ErrorBanner dismiss from BoardList', () => {
  it('hides ErrorBanner after clicking its close button', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    vi.mocked(api.createBoard).mockRejectedValue({ status: 422, message: 'Bad input' });
    render(<BoardList />);
    await screen.findByText('No boards yet');
    const input = screen.getByRole('textbox', { name: /board name/i });
    fireEvent.change(input, { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /add board/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dismiss|close/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Validation error clears on new input
// ---------------------------------------------------------------------------

describe('validation error clears on typing', () => {
  it('clears inline validation error when user starts typing', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    render(<BoardList />);
    await screen.findByText('No boards yet');
    // trigger validation error
    fireEvent.click(screen.getByRole('button', { name: /add board/i }));
    expect(screen.getByText(/board name cannot be empty/i)).toBeInTheDocument();
    // start typing → error should clear
    const input = screen.getByRole('textbox', { name: /board name/i });
    fireEvent.change(input, { target: { value: 'H' } });
    expect(
      screen.queryByText(/board name cannot be empty/i),
    ).not.toBeInTheDocument();
  });
});
