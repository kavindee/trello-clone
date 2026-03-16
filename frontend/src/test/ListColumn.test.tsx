/**
 * ListColumn.test.tsx  (Task 8 — complete)
 *
 * Covers:
 *   T7 (kept) — list name, delete button, deleteList call, onDeleted, ErrorBanner
 *   T8 (new)  — getCards on mount, card rendering, "No cards yet", create card
 *               form validation, create success/failure, card deleted/moved/updated
 *               callbacks, refreshSignal triggers re-fetch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ListColumn from '../components/ListColumn';
import * as api from '../api';

vi.mock('../api');

const mockList = {
  id: 3,
  board_id: 1,
  name: 'In Progress',
  position: 1,
  created_at: '2025-01-01T00:00:00Z',
};

const mockAllLists = [
  { id: 1, board_id: 1, name: 'Todo', position: 0, created_at: '' },
  mockList,
  { id: 5, board_id: 1, name: 'Done', position: 2, created_at: '' },
];

const mockCards = [
  { id: 10, list_id: 3, title: 'Card One', position: 0, created_at: '' },
  { id: 11, list_id: 3, title: 'Card Two', position: 1, created_at: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getCards).mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// T7 — list header & delete (unchanged)
// ---------------------------------------------------------------------------

describe('ListColumn — render (T7)', () => {
  it('renders the list name in the column header', () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders a delete button for the list', () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    // There may be multiple "Delete" buttons once cards are rendered;
    // just check at least one exists
    expect(screen.getAllByRole('button', { name: /delete/i }).length).toBeGreaterThan(0);
  });

  it('shows "No cards yet" when no cards (EC4)', async () => {
    vi.mocked(api.getCards).mockResolvedValue([]);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    expect(await screen.findByText('No cards yet')).toBeInTheDocument();
  });
});

describe('ListColumn — delete list (T7)', () => {
  it('calls deleteList with the correct list id', async () => {
    vi.mocked(api.deleteList).mockResolvedValue(undefined);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    // The delete-list button has aria-label including the list name
    fireEvent.click(screen.getByRole('button', { name: /delete list/i }));
    await waitFor(() => expect(api.deleteList).toHaveBeenCalledWith(mockList.id));
  });

  it('calls onDeleted() after successful list delete', async () => {
    vi.mocked(api.deleteList).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole('button', { name: /delete list/i }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it('shows ErrorBanner on deleteList failure (EC8)', async () => {
    vi.mocked(api.deleteList).mockRejectedValue({ status: 500, message: 'Server error' });
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete list/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it('does NOT call onDeleted() on list delete failure', async () => {
    vi.mocked(api.deleteList).mockRejectedValue({ status: 500, message: 'Oops' });
    const onDeleted = vi.fn();
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole('button', { name: /delete list/i }));
    await screen.findByRole('alert');
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T8 — card fetch on mount
// ---------------------------------------------------------------------------

describe('ListColumn — fetch cards on mount', () => {
  it('calls getCards with list.id on mount', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await waitFor(() => expect(api.getCards).toHaveBeenCalledWith(mockList.id));
  });

  it('renders fetched card titles', async () => {
    vi.mocked(api.getCards).mockResolvedValue(mockCards);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    expect(await screen.findByText('Card One')).toBeInTheDocument();
    expect(screen.getByText('Card Two')).toBeInTheDocument();
  });

  it('hides "No cards yet" when cards exist', async () => {
    vi.mocked(api.getCards).mockResolvedValue(mockCards);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('Card One');
    expect(screen.queryByText('No cards yet')).not.toBeInTheDocument();
  });

  it('re-fetches cards when refreshSignal increments', async () => {
    vi.mocked(api.getCards).mockResolvedValue([]);
    const { rerender } = render(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} refreshSignal={0} />,
    );
    await screen.findByText('No cards yet');
    expect(api.getCards).toHaveBeenCalledTimes(1);

    vi.mocked(api.getCards).mockResolvedValue([mockCards[0]]);
    rerender(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} refreshSignal={1} />,
    );
    expect(await screen.findByText('Card One')).toBeInTheDocument();
    expect(api.getCards).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// T8 — create card form
// ---------------------------------------------------------------------------

describe('ListColumn — create card form', () => {
  it('shows character counter 0/255', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    expect(screen.getByText('0/255')).toBeInTheDocument();
  });

  it('updates counter as user types', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Hello' },
    });
    expect(screen.getByText('5/255')).toBeInTheDocument();
  });

  it('blocks empty submit — inline message, no API call (EC5)', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    expect(screen.getByText(/card title cannot be empty/i)).toBeInTheDocument();
    expect(api.createCard).not.toHaveBeenCalled();
  });

  it('blocks whitespace submit — inline message, no API call (EC5)', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    expect(screen.getByText(/card title cannot be empty/i)).toBeInTheDocument();
    expect(api.createCard).not.toHaveBeenCalled();
  });

  it('blocks 256-char submit — inline message, no API call (EC7)', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'a'.repeat(256) },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    expect(screen.getByText(/card title must be 255 characters or fewer/i)).toBeInTheDocument();
    expect(api.createCard).not.toHaveBeenCalled();
  });

  it('calls createCard with list.id and trimmed title', async () => {
    const newCard = { id: 20, list_id: 3, title: 'New Task', position: 0, created_at: '' };
    vi.mocked(api.createCard).mockResolvedValue(newCard);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: '  New Task  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    await waitFor(() =>
      expect(api.createCard).toHaveBeenCalledWith(mockList.id, 'New Task'),
    );
  });

  it('appends new card without reload', async () => {
    vi.mocked(api.getCards).mockResolvedValue([mockCards[0]]);
    const newCard = { id: 20, list_id: 3, title: 'New Task', position: 1, created_at: '' };
    vi.mocked(api.createCard).mockResolvedValue(newCard);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('Card One');
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'New Task' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    expect(await screen.findByText('New Task')).toBeInTheDocument();
    expect(screen.getByText('Card One')).toBeInTheDocument();
  });

  it('clears input after successful create', async () => {
    const newCard = { id: 20, list_id: 3, title: 'T', position: 0, created_at: '' };
    vi.mocked(api.createCard).mockResolvedValue(newCard);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    const input = screen.getByRole('textbox', { name: /card title/i });
    fireEvent.change(input, { target: { value: 'T' } });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
  });

  it('shows ErrorBanner on createCard failure (EC8)', async () => {
    vi.mocked(api.createCard).mockRejectedValue({ status: 500, message: 'DB fail' });
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'X' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T8 — card callbacks
// ---------------------------------------------------------------------------

describe('ListColumn — card callbacks', () => {
  it('removes card from state when onDeleted is fired', async () => {
    vi.mocked(api.getCards).mockResolvedValue([...mockCards]);
    vi.mocked(api.deleteCard).mockResolvedValue(undefined);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('Card One');
    // Each CardItem renders a delete button; click the one for Card One
    const items = screen.getAllByRole('listitem');
    const cardOneItem = items.find((el) => el.textContent?.includes('Card One'));
    const deleteBtn = cardOneItem!.querySelector('button[aria-label*="Delete card"]')!;
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(screen.queryByText('Card One')).not.toBeInTheDocument());
    expect(screen.getByText('Card Two')).toBeInTheDocument();
  });

  it('removes card when onMoved fires and calls onCardMovedOut', async () => {
    vi.mocked(api.getCards).mockResolvedValue([mockCards[0]]);
    vi.mocked(api.updateCard).mockResolvedValue({
      ...mockCards[0],
      list_id: 5,
      position: 0,
    });
    const onCardMovedOut = vi.fn();
    render(
      <ListColumn
        list={mockList}
        allLists={mockAllLists}
        onDeleted={vi.fn()}
        onCardMovedOut={onCardMovedOut}
      />,
    );
    await screen.findByText('Card One');
    // Select the target list in the move dropdown
    fireEvent.change(screen.getByRole('combobox', { name: /move to/i }), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));
    await waitFor(() => expect(screen.queryByText('Card One')).not.toBeInTheDocument());
    expect(onCardMovedOut).toHaveBeenCalledWith(5);
  });
});
