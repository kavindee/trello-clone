/**
 * ListColumn.test.tsx
 *
 * Covers:
 *   T7 (kept)  — list name, delete button, deleteList call, onDeleted, ErrorBanner
 *   T8 (kept)  — getCards on mount, card rendering, "No cards yet", card callbacks,
 *                refreshSignal triggers re-fetch
 *   Modal      — "Add a card" button opens CardModal; onSuccess appends card;
 *                onClose dismisses modal
 *   Task D     — sort by due_date, filter by due_date (All / Due soon / Overdue),
 *                board-wide filter override
 *
 * NOTE: Card-creation validation (title, description, dates) is tested in
 * CardModal.test.tsx.  CardModal is mocked here so these tests remain fast
 * and isolated.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ListColumn from '../components/ListColumn';
import * as api from '../api';
import type { Card } from '../types';

vi.mock('../api');

// ── Mock CardModal so ListColumn tests don't depend on DatePicker ──────────
vi.mock('../components/CardModal', () => ({
  default: ({
    onSuccess,
    onClose,
    mode,
  }: {
    onSuccess: (card: Card) => void;
    onClose: () => void;
    mode: string;
  }) => (
    <div data-testid="card-modal">
      <span>mode:{mode}</span>
      <button
        aria-label="modal-submit"
        onClick={() =>
          onSuccess({
            id: 99,
            list_id: 3,
            title: 'Modal Card',
            position: 0,
            description: null,
            start_date: null,
            due_date: null,
            created_at: '',
          })
        }
      >
        Submit
      </button>
      <button aria-label="modal-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

const mockList = {
  id: 3,
  board_id: 1,
  name: 'In Progress',
  position: 1,
  deadline: null as string | null,
  created_at: '2025-01-01T00:00:00Z',
};

const mockAllLists = [
  { id: 1, board_id: 1, name: 'Todo', position: 0, deadline: null as string | null, created_at: '' },
  mockList,
  { id: 5, board_id: 1, name: 'Done', position: 2, deadline: null as string | null, created_at: '' },
];

const mockCards: Card[] = [
  { id: 10, list_id: 3, title: 'Card One', position: 0, description: null, start_date: null, due_date: null, created_at: '' },
  { id: 11, list_id: 3, title: 'Card Two', position: 1, description: null, start_date: null, due_date: null, created_at: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getCards).mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// T7 — list header & delete
// ---------------------------------------------------------------------------

describe('ListColumn — render (T7)', () => {
  it('renders the list name in the column header', () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders a delete button for the list', () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
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
// Modal — "Add a card" button
// ---------------------------------------------------------------------------

describe('ListColumn — Add a card modal', () => {
  it('renders an "Add a card" button', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    expect(screen.getByRole('button', { name: /add a card/i })).toBeInTheDocument();
  });

  it('clicking "Add a card" opens the CardModal', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    expect(screen.queryByTestId('card-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add a card/i }));
    expect(screen.getByTestId('card-modal')).toBeInTheDocument();
  });

  it('CardModal is opened in create mode', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    fireEvent.click(screen.getByRole('button', { name: /add a card/i }));
    expect(screen.getByText('mode:create')).toBeInTheDocument();
  });

  it('modal onSuccess appends new card to the column', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    fireEvent.click(screen.getByRole('button', { name: /add a card/i }));
    fireEvent.click(screen.getByRole('button', { name: /modal-submit/i }));
    expect(await screen.findByText('Modal Card')).toBeInTheDocument();
  });

  it('modal onSuccess closes the modal', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    fireEvent.click(screen.getByRole('button', { name: /add a card/i }));
    fireEvent.click(screen.getByRole('button', { name: /modal-submit/i }));
    await waitFor(() =>
      expect(screen.queryByTestId('card-modal')).not.toBeInTheDocument(),
    );
  });

  it('modal onClose dismisses modal without adding card', async () => {
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    fireEvent.click(screen.getByRole('button', { name: /add a card/i }));
    expect(screen.getByTestId('card-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /modal-close/i }));
    expect(screen.queryByTestId('card-modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Modal Card')).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByRole('combobox', { name: /move to/i }), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));
    await waitFor(() => expect(screen.queryByText('Card One')).not.toBeInTheDocument());
    expect(onCardMovedOut).toHaveBeenCalledWith(5);
  });
});

// ---------------------------------------------------------------------------
// Task D — sort and filter controls (use due_date instead of deadline)
// No fake timers: absolute dates prevent timing issues
//   '2020-01-01' is always overdue   '2099-12-31' is always future
//   todayISO is always "due today" = due soon
// ---------------------------------------------------------------------------

const _now = new Date();
const todayISO = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

const sortCards: Card[] = [
  { id: 20, list_id: 3, title: 'Future Card',      position: 0, description: null, start_date: null, due_date: '2099-12-31', created_at: '' },
  { id: 21, list_id: 3, title: 'No Deadline Card', position: 1, description: null, start_date: null, due_date: null,         created_at: '' },
  { id: 22, list_id: 3, title: 'Overdue Card',     position: 2, description: null, start_date: null, due_date: '2020-01-01', created_at: '' },
];

const filterCards: Card[] = [
  { id: 30, list_id: 3, title: 'Overdue Card',    position: 0, description: null, start_date: null, due_date: '2020-01-01', created_at: '' },
  { id: 31, list_id: 3, title: 'Soon Card',        position: 1, description: null, start_date: null, due_date: todayISO,    created_at: '' },
  { id: 32, list_id: 3, title: 'Future Card',      position: 2, description: null, start_date: null, due_date: '2099-12-31', created_at: '' },
  { id: 33, list_id: 3, title: 'No Deadline Card', position: 3, description: null, start_date: null, due_date: null,         created_at: '' },
];

/** DOM-order index of title text — for asserting sort order. */
function bodyIdx(title: string): number {
  return document.body.textContent?.indexOf(title) ?? -1;
}

describe('ListColumn — sort by deadline (Task D)', () => {
  it('default renders cards in position (creation) order', async () => {
    vi.mocked(api.getCards).mockResolvedValue([...sortCards]);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('Future Card');
    expect(bodyIdx('Future Card')).toBeLessThan(bodyIdx('No Deadline Card'));
    expect(bodyIdx('No Deadline Card')).toBeLessThan(bodyIdx('Overdue Card'));
  });

  it('sort toggle reorders cards by due_date ASC, nulls last', async () => {
    vi.mocked(api.getCards).mockResolvedValue([...sortCards]);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('Future Card');
    fireEvent.click(screen.getByRole('button', { name: /sort by deadline/i }));
    expect(bodyIdx('Overdue Card')).toBeLessThan(bodyIdx('Future Card'));
    expect(bodyIdx('Future Card')).toBeLessThan(bodyIdx('No Deadline Card'));
  });

  it('sort toggle shows active label when on', async () => {
    vi.mocked(api.getCards).mockResolvedValue([]);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('No cards yet');
    fireEvent.click(screen.getByRole('button', { name: /sort by deadline/i }));
    expect(screen.getByRole('button', { name: /sort: deadline/i })).toBeInTheDocument();
  });

  it('clicking sort toggle again returns to position order', async () => {
    vi.mocked(api.getCards).mockResolvedValue([...sortCards]);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('Future Card');
    fireEvent.click(screen.getByRole('button', { name: /sort by deadline/i }));
    fireEvent.click(screen.getByRole('button', { name: /sort: deadline/i }));
    expect(bodyIdx('Future Card')).toBeLessThan(bodyIdx('No Deadline Card'));
    expect(bodyIdx('No Deadline Card')).toBeLessThan(bodyIdx('Overdue Card'));
  });
});

describe('ListColumn — filter cards (Task D)', () => {
  it('default "All" filter shows all cards', async () => {
    vi.mocked(api.getCards).mockResolvedValue([...filterCards]);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('Overdue Card');
    expect(screen.getByText('Overdue Card')).toBeInTheDocument();
    expect(screen.getByText('Soon Card')).toBeInTheDocument();
    expect(screen.getByText('Future Card')).toBeInTheDocument();
    expect(screen.getByText('No Deadline Card')).toBeInTheDocument();
  });

  it('"Due soon" filter shows only cards due today', async () => {
    vi.mocked(api.getCards).mockResolvedValue([...filterCards]);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('Overdue Card');
    fireEvent.click(screen.getByRole('button', { name: /filter: all/i }));
    expect(screen.getByRole('button', { name: /filter: due soon/i })).toBeInTheDocument();
    expect(screen.getByText('Soon Card')).toBeInTheDocument();
    expect(screen.queryByText('Overdue Card')).not.toBeInTheDocument();
    expect(screen.queryByText('Future Card')).not.toBeInTheDocument();
    expect(screen.queryByText('No Deadline Card')).not.toBeInTheDocument();
  });

  it('"Overdue" filter shows only past-due cards', async () => {
    vi.mocked(api.getCards).mockResolvedValue([...filterCards]);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('Overdue Card');
    fireEvent.click(screen.getByRole('button', { name: /filter: all/i }));
    fireEvent.click(screen.getByRole('button', { name: /filter: due soon/i }));
    expect(screen.getByRole('button', { name: /filter: overdue/i })).toBeInTheDocument();
    expect(screen.getByText('Overdue Card')).toBeInTheDocument();
    expect(screen.queryByText('Soon Card')).not.toBeInTheDocument();
    expect(screen.queryByText('Future Card')).not.toBeInTheDocument();
  });

  it('"All" filter cycle: Overdue → All restores all cards', async () => {
    vi.mocked(api.getCards).mockResolvedValue([...filterCards]);
    render(<ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />);
    await screen.findByText('Overdue Card');
    fireEvent.click(screen.getByRole('button', { name: /filter: all/i }));
    fireEvent.click(screen.getByRole('button', { name: /filter: due soon/i }));
    fireEvent.click(screen.getByRole('button', { name: /filter: overdue/i }));
    expect(screen.getByRole('button', { name: /filter: all/i })).toBeInTheDocument();
    expect(screen.getByText('Overdue Card')).toBeInTheDocument();
    expect(screen.getByText('Soon Card')).toBeInTheDocument();
    expect(screen.getByText('Future Card')).toBeInTheDocument();
  });

  it('board-wide filter prop overrides local filter', async () => {
    vi.mocked(api.getCards).mockResolvedValue([...filterCards]);
    const { rerender } = render(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} boardFilter="all" />,
    );
    await screen.findByText('Overdue Card');
    rerender(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} boardFilter="overdue" />,
    );
    expect(screen.getByText('Overdue Card')).toBeInTheDocument();
    expect(screen.queryByText('Soon Card')).not.toBeInTheDocument();
    expect(screen.queryByText('Future Card')).not.toBeInTheDocument();
  });

  it('board-wide filter disables per-column filter button', async () => {
    vi.mocked(api.getCards).mockResolvedValue([]);
    render(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} boardFilter="overdue" />,
    );
    await screen.findByText('No cards yet');
    expect(screen.getByTestId('column-filter-btn')).toBeDisabled();
  });
});
