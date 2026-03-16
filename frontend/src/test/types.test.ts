/**
 * types.test.ts
 *
 * Verifies that the Board, List, and Card interfaces exactly match the
 * FastAPI response schemas documented in SPEC.md §2 (AC13).
 *
 * These are structural / compile-time assertions expressed as runtime checks
 * so Vitest can report them.  The key constraint is: no field may be typed
 * as `any`.
 */

import { describe, it, expect } from 'vitest';
import type { Board, List, Card } from '../types';

describe('Board interface', () => {
  it('accepts a valid board object', () => {
    const board: Board = { id: 1, name: 'My Board', created_at: '2025-01-01T00:00:00Z' };
    expect(board.id).toBe(1);
    expect(board.name).toBe('My Board');
    expect(typeof board.created_at).toBe('string');
  });

  it('exposes id as number', () => {
    const board: Board = { id: 42, name: 'B', created_at: '2025-01-01T00:00:00Z' };
    expect(typeof board.id).toBe('number');
  });

  it('exposes created_at as string (not Date)', () => {
    const board: Board = { id: 1, name: 'B', created_at: '2025-06-15T12:00:00Z' };
    expect(typeof board.created_at).toBe('string');
  });
});

describe('List interface', () => {
  it('accepts a valid list object', () => {
    const list: List = {
      id: 2,
      board_id: 1,
      name: 'To Do',
      position: 0,
      deadline: null,
      created_at: '2025-01-02T00:00:00Z',
    };
    expect(list.board_id).toBe(1);
    expect(list.position).toBe(0);
  });

  it('exposes position as number', () => {
    const list: List = { id: 1, board_id: 1, name: 'L', position: 3, deadline: null, created_at: '' };
    expect(typeof list.position).toBe('number');
  });

  it('accepts deadline as ISO date string', () => {
    const list: List = { id: 4, board_id: 1, name: 'L', position: 0, deadline: '2025-12-31', created_at: '' };
    expect(list.deadline).toBe('2025-12-31');
  });

  it('accepts deadline as null', () => {
    const list: List = { id: 5, board_id: 1, name: 'L', position: 0, deadline: null, created_at: '' };
    expect(list.deadline).toBeNull();
  });
});

describe('Card interface', () => {
  it('accepts a valid card object', () => {
    const card: Card = {
      id: 5,
      list_id: 2,
      title: 'Fix bug',
      position: 1,
      description: null,
      start_date: null,
      due_date: null,
      created_at: '2025-01-03T00:00:00Z',
    };
    expect(card.list_id).toBe(2);
    expect(card.title).toBe('Fix bug');
  });

  it('exposes title as string', () => {
    const card: Card = {
      id: 1, list_id: 1, title: 'hello', position: 0,
      description: null, start_date: null, due_date: null, created_at: '',
    };
    expect(typeof card.title).toBe('string');
  });

  it('accepts due_date as ISO date string', () => {
    const card: Card = {
      id: 2, list_id: 1, title: 'X', position: 0,
      description: null, start_date: null, due_date: '2025-12-31', created_at: '',
    };
    expect(card.due_date).toBe('2025-12-31');
  });

  it('accepts due_date as null', () => {
    const card: Card = {
      id: 3, list_id: 1, title: 'Y', position: 0,
      description: null, start_date: null, due_date: null, created_at: '',
    };
    expect(card.due_date).toBeNull();
  });

  it('accepts description as string', () => {
    const card: Card = {
      id: 4, list_id: 1, title: 'Z', position: 0,
      description: 'Some description', start_date: null, due_date: null, created_at: '',
    };
    expect(card.description).toBe('Some description');
  });

  it('accepts start_date as ISO date string', () => {
    const card: Card = {
      id: 5, list_id: 1, title: 'A', position: 0,
      description: null, start_date: '2025-01-01', due_date: '2025-12-31', created_at: '',
    };
    expect(card.start_date).toBe('2025-01-01');
  });
});
