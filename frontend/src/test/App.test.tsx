/**
 * App.test.tsx
 *
 * Tests for hash-based routing in App.tsx.
 * All api calls are mocked to avoid network hits.
 *
 *   #/          → renders <BoardList /> (real component)
 *   #/boards/1  → renders <BoardDetail id={1} /> (real component)
 *   unknown     → falls back to <BoardList />
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../App';
import * as api from '../api';

vi.mock('../api');

const stubBoard = { id: 42, name: 'Stub Board 42', created_at: '' };

function setHash(hash: string) {
  window.location.hash = hash;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getBoards).mockResolvedValue([]);
  vi.mocked(api.getBoard).mockResolvedValue(stubBoard);
  vi.mocked(api.getLists).mockResolvedValue([]);
  setHash('');
});

afterEach(() => {
  setHash('');
});

describe('App routing', () => {
  it('renders BoardList (Boards heading) at #/', async () => {
    setHash('#/');
    const { unmount } = render(<App />);
    expect(await screen.findByRole('heading', { name: /boards/i })).toBeInTheDocument();
    unmount();
  });

  it('renders BoardList when hash is empty', async () => {
    setHash('');
    const { unmount } = render(<App />);
    expect(await screen.findByRole('heading', { name: /boards/i })).toBeInTheDocument();
    unmount();
  });

  it('renders BoardDetail at #/boards/:id — wrapper present', () => {
    setHash('#/boards/42');
    const { unmount } = render(<App />);
    // data-testid="board-detail" is on the wrapper div and renders synchronously
    expect(screen.getByTestId('board-detail')).toBeInTheDocument();
    unmount();
  });

  it('renders BoardDetail heading after data loads for #/boards/42', async () => {
    setHash('#/boards/42');
    const { unmount } = render(<App />);
    expect(await screen.findByRole('heading', { name: 'Stub Board 42' })).toBeInTheDocument();
    unmount();
  });

  it('falls back to BoardList for unknown hash', async () => {
    setHash('#/unknown/route');
    const { unmount } = render(<App />);
    expect(await screen.findByRole('heading', { name: /boards/i })).toBeInTheDocument();
    unmount();
  });

  it('falls back to BoardList for non-integer board id', async () => {
    setHash('#/boards/abc');
    const { unmount } = render(<App />);
    expect(await screen.findByRole('heading', { name: /boards/i })).toBeInTheDocument();
    unmount();
  });

  it('switches from BoardList to BoardDetail on hashchange', async () => {
    setHash('#/');
    const { unmount } = render(<App />);
    expect(await screen.findByRole('heading', { name: /boards/i })).toBeInTheDocument();

    await act(async () => {
      setHash('#/boards/7');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(screen.getByTestId('board-detail')).toBeInTheDocument();
    unmount();
  });

  it('switches from BoardDetail back to BoardList on hashchange', async () => {
    setHash('#/boards/3');
    const { unmount } = render(<App />);
    expect(screen.getByTestId('board-detail')).toBeInTheDocument();

    await act(async () => {
      setHash('#/');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(await screen.findByRole('heading', { name: /boards/i })).toBeInTheDocument();
    unmount();
  });
});
