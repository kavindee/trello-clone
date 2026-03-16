/**
 * BoardList — home page.
 *
 * Responsibilities:
 *   AC1  — create board form (inline validation, appends on success)
 *   AC2  — fetch all boards on mount, render as links ordered by created_at ASC
 *   AC3  — delete board button (removes from list on success)
 *   EC4  — "No boards yet" centered empty state
 *   EC5  — whitespace-only name blocked before API call
 *   EC7  — >255 char name blocked; live character counter
 *   EC8  — ErrorBanner on any API failure; UI state unchanged on failure
 *   EC9  — board names rendered as text content (React JSX, never innerHTML)
 */

import { useState, useEffect } from 'react';
import { getBoards, createBoard, deleteBoard } from '../api';
import type { ApiError } from '../api';
import type { Board } from '../types';
import ErrorBanner from './ErrorBanner';
import styles from '../styles/BoardList.module.css';

const MAX_NAME_LENGTH = 255;

function validate(value: string): string | null {
  if (value.trim() === '') return 'Board name cannot be empty';
  if (value.length > MAX_NAME_LENGTH) return 'Board name must be 255 characters or fewer';
  return null;
}

export default function BoardList() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // AC2 — fetch boards on mount
  useEffect(() => {
    getBoards()
      .then(setBoards)
      .catch((err: ApiError) => setApiError(err));
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
    setValidationError(null); // clear error as user types
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const error = validate(inputValue);
    if (error !== null) {
      setValidationError(error);
      return; // EC5/EC7: no API call on invalid input
    }
    setSubmitting(true);
    try {
      const board = await createBoard(inputValue.trim());
      setBoards((prev) => [...prev, board]); // AC1: append without reload
      setInputValue('');
    } catch (err) {
      setApiError(err as ApiError); // EC8: show banner, list unchanged
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteBoard(id);
      setBoards((prev) => prev.filter((b) => b.id !== id)); // AC3: remove without reload
    } catch (err) {
      setApiError(err as ApiError); // EC8: show banner, list unchanged
    }
  }

  const counterClass =
    inputValue.length > MAX_NAME_LENGTH ? styles.counterOver : styles.counter;

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Boards</h1>

      {/* EC8 — error banner */}
      {apiError !== null && (
        <ErrorBanner
          status={apiError.status}
          message={apiError.message}
          onDismiss={() => setApiError(null)}
        />
      )}

      {/* Create board form */}
      <form onSubmit={handleCreate} className={styles.form} noValidate>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Board name"
            aria-label="Board name"
            disabled={submitting}
          />
          <button
            className={styles.addButton}
            type="submit"
            disabled={submitting}
            aria-label="Add board"
          >
            Add Board
          </button>
        </div>

        {/* EC7 — character counter */}
        <span className={counterClass} aria-live="polite">
          {inputValue.length}/255
        </span>

        {/* EC5 / EC7 — inline validation message */}
        {validationError !== null && (
          <span className={styles.validationError} role="status">
            {validationError}
          </span>
        )}
      </form>

      {/* EC4 — empty state / AC2 — board list */}
      {boards.length === 0 ? (
        <p className={styles.empty}>No boards yet</p>
      ) : (
        <ul className={styles.list}>
          {boards.map((board) => (
            <li key={board.id} className={styles.item}>
              {/* EC9 — name rendered as JSX text child, never via innerHTML */}
              <a className={styles.boardLink} href={`#/boards/${board.id}`}>
                {board.name}
              </a>
              <button
                className={styles.deleteButton}
                onClick={() => handleDelete(board.id)}
                aria-label={`Delete ${board.name}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
