/**
 * CardItem — single card with display / edit / delete / move.
 *
 * AC10  — title updated from API response body, never from local input
 * AC11  — delete card
 * AC12  — move card to another list via dropdown
 * EC3   — moving to same list: no API call
 * EC5   — whitespace title blocked in edit mode
 * EC7   — >255 char title blocked; live counter
 * EC8   — ErrorBanner on any failure; UI unchanged on failure
 * EC9   — title rendered as JSX text child, never innerHTML
 */

import { useState } from 'react';
import { deleteCard, updateCard } from '../api';
import type { ApiError } from '../api';
import type { Card, List } from '../types';
import ErrorBanner from './ErrorBanner';
import styles from '../styles/CardItem.module.css';

interface Props {
  card: Card;
  allLists: List[];
  onDeleted: () => void;
  onMoved: (cardId: number, targetListId: number) => void;
  onUpdated: (card: Card) => void;
}

const MAX_LEN = 255;

function validateTitle(value: string): string | null {
  if (value.trim() === '') return 'Card title cannot be empty';
  if (value.length > MAX_LEN) return 'Card title must be 255 characters or fewer';
  return null;
}

export default function CardItem({ card, allLists, onDeleted, onMoved, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(card.title);
  const [editError, setEditError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [targetListId, setTargetListId] = useState<number>(0);
  // AC10: display title is owned locally; on save it is set from the API
  // response body — NOT from the input value the user typed.
  const [displayTitle, setDisplayTitle] = useState(card.title);

  // Lists the user can move this card TO (all lists except the current one)
  const otherLists = allLists.filter((l) => l.id !== card.list_id);

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    try {
      await deleteCard(card.id);
      onDeleted();
    } catch (err) {
      setApiError(err as ApiError);
    }
  }

  // ── Move ──────────────────────────────────────────────────────────────────
  async function handleMove() {
    if (targetListId === 0) return; // nothing selected
    if (targetListId === card.list_id) return; // EC3: same list — no-op
    try {
      const updated = await updateCard(card.id, { list_id: targetListId });
      onMoved(card.id, updated.list_id);
      setTargetListId(0);
    } catch (err) {
      setApiError(err as ApiError);
    }
  }

  // ── Edit helpers ──────────────────────────────────────────────────────────
  function startEdit() {
    setEditValue(card.title);
    setEditError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditError(null);
  }

  async function handleSave() {
    const error = validateTitle(editValue);
    if (error !== null) {
      setEditError(error);
      return;
    }
    try {
      const updated = await updateCard(card.id, { title: editValue.trim() });
      setDisplayTitle(updated.title); // AC10: from API response, not local input
      onUpdated(updated);
      setEditing(false);
      setEditError(null);
    } catch (err) {
      setApiError(err as ApiError); // EC8: stay in edit mode, title unchanged
    }
  }

  const editCounterClass =
    editValue.length > MAX_LEN ? styles.counterOver : styles.counter;

  return (
    <li className={styles.card}>
      {/* EC8 — error banner */}
      {apiError !== null && (
        <ErrorBanner
          status={apiError.status}
          message={apiError.message}
          onDismiss={() => setApiError(null)}
        />
      )}

      {editing ? (
        /* ── Edit mode ───────────────────────────────────────────── */
        <div className={styles.editRow}>
          <input
            className={styles.editInput}
            type="text"
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setEditError(null);
            }}
            aria-label="Edit card title"
            autoFocus
          />
          <span className={editCounterClass} aria-live="polite">
            {editValue.length}/255
          </span>
          {editError !== null && (
            <span className={styles.validationError}>{editError}</span>
          )}
          <div className={styles.editButtons}>
            <button className={styles.saveBtn} onClick={handleSave} aria-label="Save">
              Save
            </button>
            <button className={styles.cancelBtn} onClick={cancelEdit} aria-label="Cancel">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* ── Display mode ────────────────────────────────────────── */
        <>
          <div className={styles.displayRow}>
            {/* EC9 — title as text child, never innerHTML */}
            <span className={styles.title}>{displayTitle}</span>
            <div className={styles.actions}>
              <button className={styles.editBtn} onClick={startEdit} aria-label="Edit">
                Edit
              </button>
              <button
                className={styles.deleteBtn}
                onClick={handleDelete}
                aria-label={`Delete card ${card.title}`}
              >
                Delete
              </button>
            </div>
          </div>

          {/* Move to list */}
          {otherLists.length > 0 && (
            <div className={styles.moveRow}>
              <select
                className={styles.moveSelect}
                value={targetListId === 0 ? '' : String(targetListId)}
                onChange={(e) => setTargetListId(Number(e.target.value))}
                aria-label="Move to list"
              >
                <option value="">Move to…</option>
                {otherLists.map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                className={styles.moveBtn}
                onClick={handleMove}
                disabled={targetListId === 0}
                aria-label="Confirm move"
              >
                Move
              </button>
            </div>
          )}
        </>
      )}
    </li>
  );
}
