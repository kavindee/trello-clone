/**
 * ListColumn — one kanban column (shell for Task 7; cards wired in Task 8).
 *
 * Responsibilities:
 *   - Render list name as column header
 *   - Delete list button: calls deleteList, then onDeleted on success;
 *     shows ErrorBanner on failure (EC8)
 *   - Render "No cards yet" placeholder (EC4) — cards added in Task 8
 *
 * Props:
 *   list       — the List to render
 *   allLists   — all lists on the board (used in Task 8 for card move dropdown)
 *   onDeleted  — called by parent after successful delete so it can update state
 */

import { useState } from 'react';
import { deleteList } from '../api';
import type { ApiError } from '../api';
import type { List } from '../types';
import ErrorBanner from './ErrorBanner';
import styles from '../styles/ListColumn.module.css';

interface Props {
  list: List;
  allLists: List[]; // used in Task 8 for card move dropdown
  onDeleted: () => void;
}

export default function ListColumn({ list, allLists: _allLists, onDeleted }: Props) {
  const [apiError, setApiError] = useState<ApiError | null>(null);

  async function handleDelete() {
    try {
      await deleteList(list.id);
      onDeleted();
    } catch (err) {
      setApiError(err as ApiError);
    }
  }

  return (
    <li className={styles.column}>
      {/* EC8 — error banner for delete failure */}
      {apiError !== null && (
        <ErrorBanner
          status={apiError.status}
          message={apiError.message}
          onDismiss={() => setApiError(null)}
        />
      )}

      {/* Column header */}
      <div className={styles.header}>
        {/* EC9 — name as text child, never innerHTML */}
        <span className={styles.listName}>{list.name}</span>
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          aria-label={`Delete list ${list.name}`}
        >
          Delete
        </button>
      </div>

      {/* Card area — cards wired in Task 8 */}
      <div className={styles.cardArea}>
        <p className={styles.empty}>No cards yet</p>
      </div>
    </li>
  );
}
