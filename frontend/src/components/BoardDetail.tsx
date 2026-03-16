/**
 * BoardDetail — board detail page.
 *
 * Responsibilities:
 *   AC4  — fetch board metadata + lists on mount (Promise.all)
 *   AC5  — create list form (inline validation, appends on success)
 *   AC7  — delete list via ListColumn.onDeleted callback (removes from state)
 *   EC4  — "No lists yet" empty state
 *   EC5  — whitespace list name blocked before API call
 *   EC6  — last list removed → "No lists yet" shown, board intact
 *   EC7  — >255 char name blocked; live character counter
 *   EC8  — ErrorBanner on any API failure; UI state unchanged on failure
 *   EC9  — list names rendered as JSX text, never innerHTML (via ListColumn)
 */

import { useState, useEffect } from 'react';
import { getBoard, getLists, createList } from '../api';
import type { ApiError } from '../api';
import type { Board, List } from '../types';
import ListColumn, { type FilterMode } from './ListColumn';
import ErrorBanner from './ErrorBanner';
import styles from '../styles/BoardDetail.module.css';

interface Props {
  id: number;
}

const MAX_NAME_LENGTH = 255;

function validate(value: string): string | null {
  if (value.trim() === '') return 'List name cannot be empty';
  if (value.length > MAX_NAME_LENGTH) return 'List name must be 255 characters or fewer';
  return null;
}

export default function BoardDetail({ id }: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // refreshSignals: keyed by list.id; incrementing tells that ListColumn to re-fetch cards
  const [listRefreshSignals, setListRefreshSignals] = useState<Record<number, number>>({});
  // Task D — board-wide filter (overrides per-column when != 'all')
  const [boardFilter, setBoardFilter] = useState<FilterMode>('all');

  // AC4 — fetch board + lists in parallel
  useEffect(() => {
    Promise.all([getBoard(id), getLists(id)])
      .then(([boardData, listsData]) => {
        setBoard(boardData);
        setLists(listsData);
      })
      .catch((err: ApiError) => {
        if (err.status === 404) {
          setNotFound(true);
        } else {
          setLoadError(err);
        }
      });
  }, [id]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
    setValidationError(null);
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
      const list = await createList(id, inputValue.trim());
      setLists((prev) => [...prev, list]); // AC5: append without reload
      setInputValue('');
    } catch (err) {
      setApiError(err as ApiError); // EC8: show banner, list unchanged
    } finally {
      setSubmitting(false);
    }
  }

  // Called by ListColumn after it successfully deletes — update parent state
  function handleListDeleted(listId: number) {
    setLists((prev) => prev.filter((l) => l.id !== listId));
  }

  // Called by ListColumn when a card moves out to another list → refresh target
  function handleCardMovedOut(targetListId: number) {
    setListRefreshSignals((prev) => ({
      ...prev,
      [targetListId]: (prev[targetListId] ?? 0) + 1,
    }));
  }

  const counterClass =
    inputValue.length > MAX_NAME_LENGTH ? styles.counterOver : styles.counter;

  // ── "Board not found" state ──────────────────────────────────────────────
  if (notFound) {
    return (
      <div className={styles.page} data-testid="board-detail">
        <div className={styles.notFound}>
          <h1 className={styles.notFoundHeading}>Board not found</h1>
          <a className={styles.notFoundBack} href="#/">
            ← Back to boards
          </a>
        </div>
      </div>
    );
  }

  // ── Normal (loading / loaded) state ─────────────────────────────────────
  return (
    <div className={styles.page} data-testid="board-detail">
      {/* Top bar: back link + board name */}
      <div className={styles.topBar}>
        <a className={styles.backLink} href="#/">
          ← Back
        </a>
        {board !== null && (
          <h1 className={styles.boardName}>{board.name}</h1>
        )}
      </div>

      {/* Task D — board-wide filter bar */}
      {board !== null && (
        <div className={styles.filterBar}>
          {(['all', 'due-soon', 'overdue'] as FilterMode[]).map((f) => (
            <button
              key={f}
              className={`${styles.filterBarBtn} ${boardFilter === f ? styles.filterBarBtnActive : ''}`}
              onClick={() => setBoardFilter(f)}
              aria-label={`Board filter: ${f === 'all' ? 'All' : f === 'due-soon' ? 'Due soon' : 'Overdue'}`}
              aria-pressed={boardFilter === f}
              type="button"
            >
              {f === 'all' ? 'All' : f === 'due-soon' ? 'Due soon' : 'Overdue'}
            </button>
          ))}
        </div>
      )}

      {/* EC8 — error banners (load error + create/mutation errors) */}
      <div className={styles.notifications}>
        {loadError !== null && (
          <ErrorBanner
            status={loadError.status}
            message={loadError.message}
            onDismiss={() => setLoadError(null)}
          />
        )}
        {apiError !== null && (
          <ErrorBanner
            status={apiError.status}
            message={apiError.message}
            onDismiss={() => setApiError(null)}
          />
        )}
      </div>

      {/* Board canvas: list columns + add-list form */}
      <div className={styles.canvas}>
        {lists.length === 0 && board !== null ? (
          <p className={styles.empty}>No lists yet</p>
        ) : (
          <ul style={{ display: 'contents' }}>
            {lists.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                allLists={lists}
                onDeleted={() => handleListDeleted(list.id)}
                refreshSignal={listRefreshSignals[list.id] ?? 0}
                onCardMovedOut={handleCardMovedOut}
                boardFilter={boardFilter}
              />
            ))}
          </ul>
        )}

        {/* Add list form (shown once board is loaded) */}
        {board !== null && (
          <form
            className={styles.addListForm}
            onSubmit={handleCreate}
            noValidate
          >
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="List name"
                aria-label="List name"
                disabled={submitting}
              />
              <button
                className={styles.addButton}
                type="submit"
                disabled={submitting}
                aria-label="Add list"
              >
                Add List
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
        )}
      </div>
    </div>
  );
}
