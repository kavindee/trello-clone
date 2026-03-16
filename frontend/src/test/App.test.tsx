/**
 * App.test.tsx
 *
 * Tests for hash-based routing in App.tsx:
 *   #/          → renders <BoardList /> (now real component)
 *   #/boards/1  → renders <BoardDetail id={1} /> placeholder
 *   unknown     → falls back to <BoardList />
 *
 * The api module is mocked so BoardList's useEffect fetch doesn't hit the
 * network during routing tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../App';
import * as api from '../api';

vi.mock('../api');

function setHash(hash: string) {
  window.location.hash = hash;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getBoards).mockResolvedValue([]);
  setHash('');
});

afterEach(() => {
  setHash('');
});

describe('App routing', () => {
  it('renders BoardList (Boards heading) at #/', async () => {
    setHash('#/');
    const { unmount } = render(<App />);
    // Real BoardList renders an <h1>Boards</h1>
    expect(await screen.findByRole('heading', { name: /boards/i })).toBeInTheDocument();
    unmount();
  });

  it('renders BoardList when hash is empty', async () => {
    setHash('');
    const { unmount } = render(<App />);
    expect(await screen.findByRole('heading', { name: /boards/i })).toBeInTheDocument();
    unmount();
  });

  it('renders BoardDetail placeholder at #/boards/:id', () => {
    setHash('#/boards/42');
    const { unmount } = render(<App />);
    expect(screen.getByTestId('board-detail')).toBeInTheDocument();
    expect(screen.getByTestId('board-detail').textContent).toContain('42');
    unmount();
  });

  it('renders BoardDetail with correct id for #/boards/1', () => {
    setHash('#/boards/1');
    const { unmount } = render(<App />);
    expect(screen.getByTestId('board-detail').textContent).toContain('1');
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
    expect(screen.getByTestId('board-detail').textContent).toContain('7');
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
