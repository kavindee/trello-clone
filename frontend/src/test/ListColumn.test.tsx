/**
 * ListColumn.test.tsx
 *
 * Unit tests for the ListColumn shell (Task 7).
 * Cards are NOT rendered yet — that is Task 8.
 *
 * Covers:
 *   - renders list name in column header
 *   - renders a delete button for the list
 *   - shows "No cards yet" placeholder (EC4)
 *   - clicking delete calls deleteList(list.id)
 *   - calls onDeleted() after successful delete
 *   - shows ErrorBanner on deleteList failure (EC8)
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ListColumn — render', () => {
  it('renders the list name in the column header', () => {
    render(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />,
    );
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders a delete button for the list', () => {
    render(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows "No cards yet" placeholder text (EC4)', () => {
    render(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={vi.fn()} />,
    );
    expect(screen.getByText('No cards yet')).toBeInTheDocument();
  });
});

describe('ListColumn — delete', () => {
  it('calls deleteList with the correct list id on button click', async () => {
    vi.mocked(api.deleteList).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={onDeleted} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() =>
      expect(api.deleteList).toHaveBeenCalledWith(mockList.id),
    );
  });

  it('calls onDeleted() after successful delete', async () => {
    vi.mocked(api.deleteList).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={onDeleted} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it('shows ErrorBanner on deleteList failure (EC8)', async () => {
    vi.mocked(api.deleteList).mockRejectedValue({ status: 500, message: 'Server error' });
    const onDeleted = vi.fn();
    render(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={onDeleted} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/Server error/)).toBeInTheDocument();
  });

  it('does NOT call onDeleted() on failure', async () => {
    vi.mocked(api.deleteList).mockRejectedValue({ status: 500, message: 'Oops' });
    const onDeleted = vi.fn();
    render(
      <ListColumn list={mockList} allLists={mockAllLists} onDeleted={onDeleted} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await screen.findByRole('alert');
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
