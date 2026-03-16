/**
 * App.test.tsx
 *
 * Tests for hash-based routing in App.tsx:
 *   #/          → renders <BoardList /> placeholder
 *   #/boards/1  → renders <BoardDetail id={1} /> placeholder
 *   unknown     → falls back to <BoardList />
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../App';

function setHash(hash: string) {
  window.location.hash = hash;
}

describe('App routing', () => {
  beforeEach(() => {
    setHash('');
  });

  afterEach(() => {
    setHash('');
  });

  it('renders BoardList placeholder at #/', async () => {
    setHash('#/');
    const { unmount } = render(<App />);
    expect(screen.getByTestId('board-list')).toBeInTheDocument();
    unmount();
  });

  it('renders BoardList placeholder when hash is empty', () => {
    setHash('');
    const { unmount } = render(<App />);
    expect(screen.getByTestId('board-list')).toBeInTheDocument();
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

  it('falls back to BoardList for unknown hash', () => {
    setHash('#/unknown/route');
    const { unmount } = render(<App />);
    expect(screen.getByTestId('board-list')).toBeInTheDocument();
    unmount();
  });

  it('falls back to BoardList for non-integer board id', () => {
    setHash('#/boards/abc');
    const { unmount } = render(<App />);
    expect(screen.getByTestId('board-list')).toBeInTheDocument();
    unmount();
  });

  it('switches from BoardList to BoardDetail on hashchange', async () => {
    setHash('#/');
    const { unmount } = render(<App />);
    expect(screen.getByTestId('board-list')).toBeInTheDocument();

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

    expect(screen.getByTestId('board-list')).toBeInTheDocument();
    unmount();
  });
});
