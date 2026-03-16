/**
 * CardModal.test.tsx
 *
 * Covers:
 *   - Renders title input, description textarea, date pickers, submit/cancel
 *   - Create mode: validation (empty, whitespace, >255, desc >1000, date order)
 *   - Create mode: successful creation → onSuccess called, modal closes
 *   - Create mode: API failure → ErrorBanner inside modal, modal stays open
 *   - Edit mode: pre-fills fields from card prop
 *   - Edit mode: successful update → onSuccess called
 *   - Backdrop click → onClose called
 *   - Escape key → onClose called
 *   - Cancel button → onClose called, no API call
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CardModal from '../components/CardModal';
import * as api from '../api';
import type { Card } from '../types';

vi.mock('../api');

// ── Mock react-datepicker as a plain text input ────────────────────────────
vi.mock('react-datepicker', () => ({
  default: ({
    selected,
    onChange,
    placeholderText,
    'aria-label': ariaLabel,
  }: {
    selected: Date | null;
    onChange: (d: Date | null) => void;
    placeholderText?: string;
    'aria-label'?: string;
  }) => (
    <input
      type="text"
      aria-label={ariaLabel ?? placeholderText ?? 'date'}
      value={
        selected
          ? `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`
          : ''
      }
      onChange={(e) => {
        const v = e.target.value;
        if (!v) { onChange(null); return; }
        const [y, m, d] = v.split('-').map(Number);
        onChange(new Date(y, m - 1, d));
      }}
    />
  ),
}));
vi.mock('react-datepicker/dist/react-datepicker.css', () => ({}));

// ── Helpers ────────────────────────────────────────────────────────────────

const mockAllLists = [
  { id: 1, board_id: 1, name: 'Todo',   position: 0, deadline: null as string | null, created_at: '' },
  { id: 2, board_id: 1, name: 'In Prog',position: 1, deadline: null as string | null, created_at: '' },
  { id: 3, board_id: 1, name: 'Done',   position: 2, deadline: null as string | null, created_at: '' },
];

const mockCard: Card = {
  id: 7,
  list_id: 2,
  title: 'Existing card',
  position: 0,
  description: 'Existing desc',
  start_date: '2025-03-01',
  due_date: '2025-09-30',
  created_at: '2025-01-01T00:00:00Z',
};

const createdCard: Card = {
  id: 10,
  list_id: 1,
  title: 'New card',
  position: 0,
  description: null,
  start_date: null,
  due_date: null,
  created_at: '2025-06-01T00:00:00Z',
};

const defaultCreateProps = {
  mode: 'create' as const,
  listId: 1,
  allLists: mockAllLists,
  onSuccess: vi.fn(),
  onClose: vi.fn(),
};

const defaultEditProps = {
  mode: 'edit' as const,
  card: mockCard,
  allLists: mockAllLists,
  onSuccess: vi.fn(),
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

describe('CardModal — render (create mode)', () => {
  it('renders title input', () => {
    render(<CardModal {...defaultCreateProps} />);
    expect(screen.getByRole('textbox', { name: /card title/i })).toBeInTheDocument();
  });

  it('renders description textarea', () => {
    render(<CardModal {...defaultCreateProps} />);
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
  });

  it('renders start date and due date pickers', () => {
    render(<CardModal {...defaultCreateProps} />);
    expect(screen.getByRole('textbox', { name: /start date/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /due date/i })).toBeInTheDocument();
  });

  it('renders "Add Card" submit button in create mode', () => {
    render(<CardModal {...defaultCreateProps} />);
    expect(screen.getByRole('button', { name: /add card/i })).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<CardModal {...defaultCreateProps} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders "Save" submit button in edit mode', () => {
    render(<CardModal {...defaultEditProps} />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Title validation
// ---------------------------------------------------------------------------

describe('CardModal — title validation', () => {
  it('blocks empty title — shows error, no API call', () => {
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    expect(screen.getByText(/card title cannot be empty/i)).toBeInTheDocument();
    expect(api.createCard).not.toHaveBeenCalled();
  });

  it('blocks whitespace-only title — shows error, no API call', () => {
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    expect(screen.getByText(/card title cannot be empty/i)).toBeInTheDocument();
    expect(api.createCard).not.toHaveBeenCalled();
  });

  it('blocks 256-char title — shows error, no API call', () => {
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'a'.repeat(256) },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    expect(screen.getByText(/255 characters/i)).toBeInTheDocument();
    expect(api.createCard).not.toHaveBeenCalled();
  });

  it('shows character counter for title', () => {
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Hello' },
    });
    expect(screen.getByText('5/255')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Description validation
// ---------------------------------------------------------------------------

describe('CardModal — description validation', () => {
  it('shows character counter for description', () => {
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /description/i }), {
      target: { value: 'hi' },
    });
    expect(screen.getByText('2/1000')).toBeInTheDocument();
  });

  it('blocks description >1000 chars — shows error, no API call', () => {
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Title' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /description/i }), {
      target: { value: 'x'.repeat(1001) },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    expect(screen.getByText(/1000 characters/i)).toBeInTheDocument();
    expect(api.createCard).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Date order validation
// ---------------------------------------------------------------------------

describe('CardModal — date order validation', () => {
  it('blocks start_date > due_date — shows error, no API call', () => {
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Title' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /start date/i }), {
      target: { value: '2025-12-31' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /due date/i }), {
      target: { value: '2025-01-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    expect(screen.getByText(/start date must be before due date/i)).toBeInTheDocument();
    expect(api.createCard).not.toHaveBeenCalled();
  });

  it('allows start_date == due_date', async () => {
    vi.mocked(api.createCard).mockResolvedValue(createdCard);
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Title' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /start date/i }), {
      target: { value: '2025-06-15' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /due date/i }), {
      target: { value: '2025-06-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    await waitFor(() => expect(api.createCard).toHaveBeenCalled());
  });

  it('allows start_date < due_date', async () => {
    vi.mocked(api.createCard).mockResolvedValue(createdCard);
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Title' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /start date/i }), {
      target: { value: '2025-01-01' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /due date/i }), {
      target: { value: '2025-12-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    await waitFor(() => expect(api.createCard).toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// Create mode — success
// ---------------------------------------------------------------------------

describe('CardModal — create success', () => {
  it('calls createCard with listId and title-only payload', async () => {
    vi.mocked(api.createCard).mockResolvedValue(createdCard);
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: '  New card  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    await waitFor(() =>
      expect(api.createCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'New card' }),
      ),
    );
  });

  it('calls createCard with description when provided', async () => {
    vi.mocked(api.createCard).mockResolvedValue(createdCard);
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Title' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /description/i }), {
      target: { value: 'My description' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    await waitFor(() =>
      expect(api.createCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ description: 'My description' }),
      ),
    );
  });

  it('calls onSuccess(card) after successful create', async () => {
    vi.mocked(api.createCard).mockResolvedValue(createdCard);
    const onSuccess = vi.fn();
    render(<CardModal {...defaultCreateProps} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'New card' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(createdCard));
  });

  it('calls onClose after successful create', async () => {
    vi.mocked(api.createCard).mockResolvedValue(createdCard);
    const onClose = vi.fn();
    render(<CardModal {...defaultCreateProps} onClose={onClose} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'New card' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

// ---------------------------------------------------------------------------
// Create mode — API failure
// ---------------------------------------------------------------------------

describe('CardModal — create API failure', () => {
  it('shows ErrorBanner on create failure', async () => {
    vi.mocked(api.createCard).mockRejectedValue({ status: 500, message: 'DB error' });
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Title' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it('modal stays open (submit button still visible) on failure', async () => {
    vi.mocked(api.createCard).mockRejectedValue({ status: 500, message: 'Fail' });
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Title' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /add card/i })).toBeInTheDocument();
  });

  it('does NOT call onSuccess on failure', async () => {
    vi.mocked(api.createCard).mockRejectedValue({ status: 500, message: 'Fail' });
    const onSuccess = vi.fn();
    render(<CardModal {...defaultCreateProps} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Title' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add card/i }));
    await screen.findByRole('alert');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Close behaviours
// ---------------------------------------------------------------------------

describe('CardModal — close behaviours', () => {
  it('Cancel button calls onClose without API call', () => {
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultCreateProps.onClose).toHaveBeenCalledTimes(1);
    expect(api.createCard).not.toHaveBeenCalled();
  });

  it('backdrop click calls onClose', () => {
    render(<CardModal {...defaultCreateProps} />);
    const backdrop = screen.getByTestId('card-modal-backdrop');
    fireEvent.click(backdrop);
    expect(defaultCreateProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside modal box does NOT call onClose', () => {
    render(<CardModal {...defaultCreateProps} />);
    const box = screen.getByTestId('card-modal-box');
    fireEvent.click(box);
    expect(defaultCreateProps.onClose).not.toHaveBeenCalled();
  });

  it('Escape key calls onClose', () => {
    render(<CardModal {...defaultCreateProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultCreateProps.onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Edit mode — pre-fill
// ---------------------------------------------------------------------------

describe('CardModal — edit mode', () => {
  it('pre-fills title from card prop', () => {
    render(<CardModal {...defaultEditProps} />);
    const titleInput = screen.getByRole('textbox', { name: /card title/i }) as HTMLInputElement;
    expect(titleInput.value).toBe('Existing card');
  });

  it('pre-fills description from card prop', () => {
    render(<CardModal {...defaultEditProps} />);
    const descInput = screen.getByRole('textbox', { name: /description/i }) as HTMLInputElement;
    expect(descInput.value).toBe('Existing desc');
  });

  it('pre-fills start_date from card prop', () => {
    render(<CardModal {...defaultEditProps} />);
    const startInput = screen.getByRole('textbox', { name: /start date/i }) as HTMLInputElement;
    expect(startInput.value).toBe('2025-03-01');
  });

  it('pre-fills due_date from card prop', () => {
    render(<CardModal {...defaultEditProps} />);
    const dueInput = screen.getByRole('textbox', { name: /due date/i }) as HTMLInputElement;
    expect(dueInput.value).toBe('2025-09-30');
  });

  it('calls updateCard and onSuccess on edit save', async () => {
    const updatedCard = { ...mockCard, title: 'Updated title' };
    vi.mocked(api.updateCard).mockResolvedValue(updatedCard);
    const onSuccess = vi.fn();
    render(<CardModal {...defaultEditProps} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Updated title' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() =>
      expect(api.updateCard).toHaveBeenCalledWith(
        mockCard.id,
        expect.objectContaining({ title: 'Updated title' }),
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(updatedCard));
  });

  it('shows ErrorBanner on edit save failure', async () => {
    vi.mocked(api.updateCard).mockRejectedValue({ status: 500, message: 'Edit fail' });
    render(<CardModal {...defaultEditProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: /card title/i }), {
      target: { value: 'Changed title' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });
});
