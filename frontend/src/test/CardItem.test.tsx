/**
 * CardItem.test.tsx
 *
 * Covers:
 *   AC10 — card data (title, description, dates) updated from API response
 *           body via CardModal onSuccess, never from local input state
 *   AC11 — delete removes card
 *   AC12 — move to another list via dropdown
 *   EC3  — move to same list: no API call
 *   EC8  — ErrorBanner on delete/move failure; UI unchanged
 *   EC9  — title + description rendered as text, not innerHTML
 *
 *   Display  — description shown/hidden based on card.description
 *   Display  — due_date badge (overdue/soon/future/none) based on card.due_date
 *   Display  — start_date label shown/hidden based on card.start_date
 *   Preview  — clicking card container opens preview modal
 *   Preview  — clicking Edit button opens edit modal (not preview)
 *   Preview  — clicking Delete does not open modal
 *   Preview  — Edit button click does not bubble to card container
 *   Edit     — onSuccess updates displayed card from API response (AC10)
 *   Edit     — onClose dismisses modal, card unchanged
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CardItem from '../components/CardItem';
import type { Card } from '../types';

vi.mock('../api');
import * as api from '../api';

// ── Mock CardModal ─────────────────────────────────────────────────────────
// Mirrors the real CardModal's prop surface.
// - stopPropagation on the root div replicates portal isolation: clicks
//   inside the mock won't bubble to the <li>'s onClick handler, just as the
//   real portal-rendered modal is not a DOM descendant of the card.
// - Save button only shown in non-preview modes (onSuccess provided & used).
// - "Edit from preview" button only shown in preview mode (onEdit provided).
vi.mock('../components/CardModal', () => ({
  default: ({
    onSuccess,
    onClose,
    onEdit,
    card: modalCard,
    mode,
  }: {
    onSuccess?: (card: Card) => void;
    onClose: () => void;
    onEdit?: () => void;
    card?: Card;
    mode: string;
  }) => (
    <div data-testid="edit-modal" onClick={(e) => e.stopPropagation()}>
      <span data-testid="modal-mode">{mode}</span>
      {modalCard && (
        <span data-testid="modal-card-title">{modalCard.title}</span>
      )}
      {/* Save only available in create/edit modes */}
      {mode !== 'preview' && onSuccess && (
        <button
          aria-label="modal-save"
          onClick={() =>
            onSuccess({
              id: 7,
              list_id: 3,
              title: 'Server Title',
              position: 0,
              description: 'Server Desc',
              start_date: '2025-02-01',
              due_date: '2025-12-31',
              created_at: '2025-01-01T00:00:00Z',
            })
          }
        >
          Save
        </button>
      )}
      {/* Edit-from-preview button only in preview mode */}
      {mode === 'preview' && onEdit && (
        <button aria-label="modal-edit-from-preview" onClick={onEdit}>
          Edit from preview
        </button>
      )}
      <button aria-label="modal-cancel" onClick={onClose}>Cancel</button>
    </div>
  ),
}));

// ── Absolute dates — no fake timers needed ─────────────────────────────────
// '2020-01-01' is always overdue  |  '2099-12-31' is always future
const _n = new Date();
const todayISO = `${_n.getFullYear()}-${String(_n.getMonth() + 1).padStart(2, '0')}-${String(_n.getDate()).padStart(2, '0')}`;

// ── Base mock card ─────────────────────────────────────────────────────────
const mockCard: Card = {
  id: 7,
  list_id: 3,
  title: 'Fix the bug',
  position: 0,
  description: null,
  start_date: null,
  due_date: null,
  created_at: '2025-01-01T00:00:00Z',
};

const mockAllLists = [
  { id: 3, board_id: 1, name: 'In Progress', position: 1, deadline: null as string | null, created_at: '' },
  { id: 1, board_id: 1, name: 'Todo',        position: 0, deadline: null as string | null, created_at: '' },
  { id: 5, board_id: 1, name: 'Done',        position: 2, deadline: null as string | null, created_at: '' },
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
// Display mode — title
// ---------------------------------------------------------------------------

describe('CardItem — display mode', () => {
  it('renders card title as text (EC9)', () => {
    render(<CardItem {...defaultProps} />);
    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
  });

  it('does NOT inject title as innerHTML (EC9)', () => {
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
    const optionTexts = screen.getAllByRole('option').map((o) => o.textContent);
    expect(optionTexts).toContain('Todo');
    expect(optionTexts).toContain('Done');
    expect(optionTexts).not.toContain('In Progress');
  });
});

// ---------------------------------------------------------------------------
// Display mode — description
// ---------------------------------------------------------------------------

describe('CardItem — description display', () => {
  it('renders description when set', () => {
    render(<CardItem {...defaultProps} card={{ ...mockCard, description: 'Needs fixing ASAP' }} />);
    expect(screen.getByText('Needs fixing ASAP')).toBeInTheDocument();
  });

  it('does not render description when null', () => {
    render(<CardItem {...defaultProps} card={{ ...mockCard, description: null }} />);
    expect(screen.queryByTestId('card-description')).not.toBeInTheDocument();
  });

  it('renders description as plain text, not innerHTML (EC9)', () => {
    const xssDesc = '<img src=x onerror="alert(1)">';
    render(<CardItem {...defaultProps} card={{ ...mockCard, description: xssDesc }} />);
    expect(screen.getByText(xssDesc)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Display mode — due_date badge
// ---------------------------------------------------------------------------

describe('CardItem — due_date badge', () => {
  it('shows no badge when due_date is null', () => {
    render(<CardItem {...defaultProps} card={{ ...mockCard, due_date: null }} />);
    expect(screen.queryByTestId('due-date-overdue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('due-date-soon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('due-date-future')).not.toBeInTheDocument();
  });

  it('shows red overdue badge when due_date is in the past', () => {
    render(<CardItem {...defaultProps} card={{ ...mockCard, due_date: '2020-01-01' }} />);
    expect(screen.getByTestId('due-date-overdue')).toBeInTheDocument();
    expect(screen.queryByTestId('due-date-soon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('due-date-future')).not.toBeInTheDocument();
  });

  it('shows yellow due-soon badge when due_date is today', () => {
    render(<CardItem {...defaultProps} card={{ ...mockCard, due_date: todayISO }} />);
    expect(screen.getByTestId('due-date-soon')).toBeInTheDocument();
    expect(screen.queryByTestId('due-date-overdue')).not.toBeInTheDocument();
  });

  it('shows grey future badge when due_date is far away', () => {
    render(<CardItem {...defaultProps} card={{ ...mockCard, due_date: '2099-12-31' }} />);
    expect(screen.getByTestId('due-date-future')).toBeInTheDocument();
    expect(screen.queryByTestId('due-date-overdue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('due-date-soon')).not.toBeInTheDocument();
  });

  it('badge shows the due_date string', () => {
    render(<CardItem {...defaultProps} card={{ ...mockCard, due_date: '2020-01-01' }} />);
    expect(screen.getByTestId('due-date-overdue').textContent).toMatch(/2020-01-01/);
  });
});

// ---------------------------------------------------------------------------
// Display mode — start_date label
// ---------------------------------------------------------------------------

describe('CardItem — start_date label', () => {
  it('shows start date label when start_date is set', () => {
    render(<CardItem {...defaultProps} card={{ ...mockCard, start_date: '2025-03-15' }} />);
    expect(screen.getByText(/Start:.*2025-03-15/)).toBeInTheDocument();
  });

  it('does not render start date label when start_date is null', () => {
    render(<CardItem {...defaultProps} card={{ ...mockCard, start_date: null }} />);
    expect(screen.queryByText(/Start:/)).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));
    await waitFor(() => expect(api.updateCard).not.toHaveBeenCalled());
  });

  it('does NOT call API when same list is selected (EC3)', async () => {
    render(<CardItem {...defaultProps} />);
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
// Preview modal — card click opens preview; Edit button opens edit
// ---------------------------------------------------------------------------

describe('CardItem — preview modal (card click)', () => {
  it('clicking the card container opens the modal in preview mode', () => {
    render(<CardItem {...defaultProps} />);
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
    // Click the title text — it bubbles up to the <li> onClick
    fireEvent.click(screen.getByText('Fix the bug'));
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-mode').textContent).toBe('preview');
  });

  it('clicking the Edit button opens the modal in edit mode (not preview)', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-mode').textContent).toBe('edit');
  });

  it('Edit button click does not bubble to card container (mode stays edit, not preview)', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    // If stopPropagation was absent the li onClick would also fire, setting
    // modalMode back to 'preview' (last setState wins in batch).
    expect(screen.getByTestId('modal-mode').textContent).toBe('edit');
  });

  it('clicking Delete does not open the modal', async () => {
    vi.mocked(api.deleteCard).mockResolvedValue(undefined);
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /delete card/i }));
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
  });

  it('modal passes current card so preview is pre-filled', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByText('Fix the bug'));
    expect(screen.getByTestId('modal-card-title').textContent).toBe('Fix the bug');
  });

  it('onClose (Cancel) dismisses the preview modal', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByText('Fix the bug'));
    fireEvent.click(screen.getByRole('button', { name: /modal-cancel/i }));
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
  });

  it('"Edit from preview" button switches modal to edit mode', () => {
    render(<CardItem {...defaultProps} />);
    // Open in preview mode
    fireEvent.click(screen.getByText('Fix the bug'));
    expect(screen.getByTestId('modal-mode').textContent).toBe('preview');
    // Click the "Edit from preview" button inside the mock modal
    fireEvent.click(screen.getByRole('button', { name: /modal-edit-from-preview/i }));
    // Modal stays open, mode switches to edit
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-mode').textContent).toBe('edit');
  });
});

// ---------------------------------------------------------------------------
// Edit — CardModal integration
// ---------------------------------------------------------------------------

describe('CardItem — edit via CardModal', () => {
  it('clicking Edit opens CardModal', () => {
    render(<CardItem {...defaultProps} />);
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
  });

  it('CardModal opens in edit mode', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByTestId('modal-mode').textContent).toBe('edit');
  });

  it('CardModal receives current card so fields are pre-filled', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByTestId('modal-card-title').textContent).toBe('Fix the bug');
  });

  it('onSuccess updates displayed title from API response body (AC10)', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    // mock modal calls onSuccess with server card title 'Server Title'
    fireEvent.click(screen.getByRole('button', { name: /modal-save/i }));
    // displayed title must come from API response, not any local input
    expect(screen.getByText('Server Title')).toBeInTheDocument();
    expect(screen.queryByText('Fix the bug')).not.toBeInTheDocument();
  });

  it('onSuccess updates description from API response body', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /modal-save/i }));
    // mock modal returns description: 'Server Desc'
    expect(screen.getByText('Server Desc')).toBeInTheDocument();
  });

  it('onSuccess calls onUpdated with the API response card', () => {
    const onUpdated = vi.fn();
    render(<CardItem {...defaultProps} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /modal-save/i }));
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Server Title', description: 'Server Desc' }),
    );
  });

  it('onSuccess closes the modal', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /modal-save/i }));
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
  });

  it('onClose dismisses modal without changing displayed card', () => {
    render(<CardItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /modal-cancel/i }));
    // modal gone
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
    // title unchanged
    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
  });

  it('onClose does NOT call onUpdated', () => {
    const onUpdated = vi.fn();
    render(<CardItem {...defaultProps} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /modal-cancel/i }));
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
