/**
 * CardItem.test.tsx
 *
 * Covers:
 *   AC10 — edit title updates from API response body, not local state
 *   AC11 — delete removes card
 *   AC12 — move to another list
 *   EC3  — move to same list: no API call
 *   EC5  — whitespace title blocked in edit mode
 *   EC7  — 256-char title blocked in edit mode
 *   EC8  — ErrorBanner on any API failure; UI unchanged
 *   EC9  — title rendered as text, not innerHTML
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CardItem from '../components/CardItem';

// Mock the entire api module
vi.mock('../api');
import * as api from '../api';

const mockCard = {
  id: 7,
  list_id: 3,
  title: 'Fix the bug',
  position: 0,
  created_at: '2025-01-01T00:00:00Z',
};

const mockAllLists = [
  { id: 3, board_id: 1, name: 'In Progress', position: 1, created_at: '' },
  { id: 1, board_id: 1, name: 'Todo', position: 0, created_at: '' },
  { id: 5, board_id: 1, name: 'Done', position: 2, created_at: '' },
];

const defaultProps = {
  card: mockCard,
  allLists: mockAllLists,
  onDeleted: vi.fn(),
  onMoved: vi.fn(),
  onUpdated: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Display mode
// ---------------------------------------------------------------------------

describe('CardItem — display mode', () => {
  it('renders card title as text (EC9)', () => {
    render(<CardItem {...defaultProps} />);
    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
  });

  it('does NOT inject title as innerHTML', () => {
    const xssCard = { ...mockCard, title: '<script>alert(1)</script>' };
    render(<CardItem {...defaultProps} card={xssCard} />);
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script[data-xss]')).toBeNull();
  });

  it('renders an Edit button', () => {
    render(<CardItem {...defaultProps} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('renders a Delete button', () => {
    render(<CardItem {...defaultProps} />);
    expect(screen.getByRole('button', { name: /delete card/i })).toBeInTheDocument();
  });

  it('renders a Move dropdown showing only OTHER lists', () => {
    render(<CardItem {...defaultProps} />);
    // Should list Todo and Done, but NOT In Progress (card's current list)
    const options = screen.getAllByRole('option');
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain('Todo');
    expect(optionTexts).toContain('Done');
    expect(optionTexts).not.toContain('In Progress');
  });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

describe('CardItem — delete', () => {
  it('calls deleteCard(card.id) on delete button click', async () => {
    vi.mocked(api.deleteCard).mockResolvedValue(undefined);
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /delete card/i }));
    await waitFor(() => expect(api.deleteCard).toHaveBeenCalledWith(mockCard.id));
  });

  it('calls onDeleted() after successful delete', async () => {
    vi.mocked(api.deleteCard).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(<CardItem {...defaultProps} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole('button', { name: /delete card/i }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it('shows ErrorBanner on delete failure (EC8)', async () => {
    vi.mocked(api.deleteCard).mockRejectedValue({ status: 500, message: 'DB error' });
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /delete card/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it('does NOT call onDeleted() on delete failure', async () => {
    vi.mocked(api.deleteCard).mockRejectedValue({ status: 500, message: 'Oops' });
    const onDeleted = vi.fn();
    render(<CardItem {...defaultProps} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole('button', { name: /delete card/i }));
    await screen.findByRole('alert');
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Move
// ---------------------------------------------------------------------------

describe('CardItem — move to another list (AC12)', () => {
  it('calls updateCard with { list_id } on confirm', async () => {
    vi.mocked(api.updateCard).mockResolvedValue({ ...mockCard, list_id: 5, position: 0 });
    render(<CardItem {...defaultProps} />);
    fireEvent.change(screen.getByRole('combobox', { name: /move to/i }), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));
    await waitFor(() =>
      expect(api.updateCard).toHaveBeenCalledWith(mockCard.id, { list_id: 5 }),
    );
  });

  it('calls onMoved(cardId, targetListId) after successful move', async () => {
    vi.mocked(api.updateCard).mockResolvedValue({ ...mockCard, list_id: 5, position: 0 });
    const onMoved = vi.fn();
    render(<CardItem {...defaultProps} onMoved={onMoved} />);
    fireEvent.change(screen.getByRole('combobox', { name: /move to/i }), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));
    await waitFor(() => expect(onMoved).toHaveBeenCalledWith(mockCard.id, 5));
  });

  it('does NOT call API when no list is selected', async () => {
    render(<CardItem {...defaultProps} />);
    // Dropdown starts on empty/placeholder; clicking confirm without selecting
    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));
    await waitFor(() => expect(api.updateCard).not.toHaveBeenCalled());
  });

  it('does NOT call API when same list is selected (EC3)', async () => {
    render(<CardItem {...defaultProps} />);
    // Manually set value to current list id (3) — same list no-op
    fireEvent.change(screen.getByRole('combobox', { name: /move to/i }), {
      target: { value: String(mockCard.list_id) },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));
    await waitFor(() => expect(api.updateCard).not.toHaveBeenCalled());
  });

  it('shows ErrorBanner on move failure (EC8)', async () => {
    vi.mocked(api.updateCard).mockRejectedValue({ status: 404, message: 'List gone' });
    render(<CardItem {...defaultProps} />);
    fireEvent.change(screen.getByRole('combobox', { name: /move to/i }), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/404/)).toBeInTheDocument();
  });

  it('does NOT call onMoved() on move failure', async () => {
    vi.mocked(api.updateCard).mockRejectedValue({ status: 500, message: 'Fail' });
    const onMoved = vi.fn();
    render(<CardItem {...defaultProps} onMoved={onMoved} />);
    fireEvent.change(screen.getByRole('combobox', { name: /move to/i }), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));
    await screen.findByRole('alert');
    expect(onMoved).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Edit mode
// ---------------------------------------------------------------------------

describe('CardItem — edit mode', () => {
  it('clicking Edit switches to edit mode with pre-filled input', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const input = screen.getByRole('textbox', { name: /edit card title/i });
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('Fix the bug');
  });

  it('shows character counter in edit mode', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByText('11/255')).toBeInTheDocument(); // "Fix the bug".length = 11
  });

  it('Cancel returns to display mode, no API call', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
    expect(api.updateCard).not.toHaveBeenCalled();
  });

  it('blocks empty title in edit mode — inline message, no API call (EC5)', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /edit card title/i }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.getByText(/card title cannot be empty/i)).toBeInTheDocument();
    expect(api.updateCard).not.toHaveBeenCalled();
  });

  it('blocks 256-char title in edit mode — inline message, no API call (EC7)', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /edit card title/i }), {
      target: { value: 'a'.repeat(256) },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(
      screen.getByText(/card title must be 255 characters or fewer/i),
    ).toBeInTheDocument();
    expect(api.updateCard).not.toHaveBeenCalled();
  });

  it('calls updateCard({ title }) with trimmed value on save', async () => {
    vi.mocked(api.updateCard).mockResolvedValue({ ...mockCard, title: 'Updated' });
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /edit card title/i }), {
      target: { value: '  Updated  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() =>
      expect(api.updateCard).toHaveBeenCalledWith(mockCard.id, { title: 'Updated' }),
    );
  });

  it('updates title from API response body, NOT local input (AC10)', async () => {
    // API returns a DIFFERENT title than what the user typed
    vi.mocked(api.updateCard).mockResolvedValue({ ...mockCard, title: 'Server Title' });
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /edit card title/i }), {
      target: { value: 'Local Input Title' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    // Should show the server-returned title, not the local value
    expect(await screen.findByText('Server Title')).toBeInTheDocument();
    expect(screen.queryByText('Local Input Title')).not.toBeInTheDocument();
  });

  it('calls onUpdated(card) with the API response card', async () => {
    const updatedCard = { ...mockCard, title: 'Server Title' };
    vi.mocked(api.updateCard).mockResolvedValue(updatedCard);
    const onUpdated = vi.fn();
    render(<CardItem {...defaultProps} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /edit card title/i }), {
      target: { value: 'Server Title' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updatedCard));
  });

  it('shows ErrorBanner on save failure, stays in edit mode (EC8)', async () => {
    vi.mocked(api.updateCard).mockRejectedValue({ status: 500, message: 'Save fail' });
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /edit card title/i }), {
      target: { value: 'New title' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Still in edit mode (save button still visible)
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    // Original title NOT updated
    expect(screen.queryByText('Fix the bug')).not.toBeInTheDocument();
  });

  it('does NOT call onUpdated() on save failure', async () => {
    vi.mocked(api.updateCard).mockRejectedValue({ status: 500, message: 'Fail' });
    const onUpdated = vi.fn();
    render(<CardItem {...defaultProps} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /edit card title/i }), {
      target: { value: 'X' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await screen.findByRole('alert');
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('returns to display mode after successful save', async () => {
    vi.mocked(api.updateCard).mockResolvedValue({ ...mockCard, title: 'Saved' });
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /edit card title/i }), {
      target: { value: 'Saved' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    // Edit button back (display mode)
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });
});
