/**
 * ListColumn — full kanban column (Task 7 shell → Task 8 complete).
 *
 * Responsibilities:
 *   - Fetch this list's cards on mount via getCards(list.id)
 *   - Re-fetch when refreshSignal increments (triggered by a card move-in)
 *   - Render each card as a <CardItem /> (AC9 — position order preserved)
 *   - "No cards yet" empty state (EC4)
 *   - Create card form with validation (EC5, EC7) and ErrorBanner (EC8)
 *   - Delete list button → calls deleteList, then onDeleted on success (EC8)
 *   - Card callbacks: onDeleted, onMoved, onUpdated → mutate local cards state
 *
 * Props:
 *   list           — the List to render
 *   allLists       — all lists on the board (for CardItem move dropdown)
 *   onDeleted      — called after this LIST is successfully deleted
 *   refreshSignal  — increment to trigger a card re-fetch (move-in case)
 *   onCardMovedOut — called with targetListId after a card moves out
 */

import { useState, useEffect } from 'react';
import { deleteList, getCards, createCard } from '../api';
import type { ApiError } from '../api';
import type { Card, List } from '../types';
import CardItem from './CardItem';
import ErrorBanner from './ErrorBanner';
import styles from '../styles/ListColumn.module.css';

interface Props {
  list: List;
  allLists: List[];
  onDeleted: () => void;
  refreshSignal?: number;
  onCardMovedOut?: (targetListId: number) => void;
}

const MAX_LEN = 255;

function validateTitle(value: string): string | null {
  if (value.trim() === '') return 'Card title cannot be empty';
  if (value.length > MAX_LEN) return 'Card title must be 255 characters or fewer';
  return null;
}

export default function ListColumn({
  list,
  allLists,
  onDeleted,
  refreshSignal = 0,
  onCardMovedOut,
}: Props) {
  const [cards, setCards] = useState<Card[]>([]);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [createInput, setCreateInput] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch cards on mount and whenever refreshSignal changes (card moved in)
  useEffect(() => {
    getCards(list.id)
      .then(setCards)
      .catch((err: ApiError) => setApiError(err));
  }, [list.id, refreshSignal]);

  // ── Delete list ───────────────────────────────────────────────────────────
  async function handleDeleteList() {
    try {
      await deleteList(list.id);
      onDeleted();
    } catch (err) {
      setApiError(err as ApiError);
    }
  }

  // ── Create card ───────────────────────────────────────────────────────────
  async function handleCreateCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const error = validateTitle(createInput);
    if (error !== null) {
      setCreateError(error);
      return;
    }
    setSubmitting(true);
    try {
      const card = await createCard(list.id, createInput.trim());
      setCards((prev) => [...prev, card]);
      setCreateInput('');
    } catch (err) {
      setApiError(err as ApiError);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Card callbacks (from CardItem) ────────────────────────────────────────
  function handleCardDeleted(cardId: number) {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }

  function handleCardMoved(cardId: number, targetListId: number) {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    if (onCardMovedOut) onCardMovedOut(targetListId);
  }

  function handleCardUpdated(updatedCard: Card) {
    setCards((prev) => prev.map((c) => (c.id === updatedCard.id ? updatedCard : c)));
  }

  const counterClass = createInput.length > MAX_LEN ? styles.counterOver : styles.counter;

  return (
    <li className={styles.column}>
      {/* EC8 — error banner */}
      {apiError !== null && (
        <ErrorBanner
          status={apiError.status}
          message={apiError.message}
          onDismiss={() => setApiError(null)}
        />
      )}

      {/* Column header */}
      <div className={styles.header}>
        <span className={styles.listName}>{list.name}</span>
        <button
          className={styles.deleteButton}
          onClick={handleDeleteList}
          aria-label={`Delete list ${list.name}`}
        >
          Delete
        </button>
      </div>

      {/* Card list — EC4: "No cards yet" when empty */}
      <ul className={styles.cardArea}>
        {cards.length === 0 ? (
          <p className={styles.empty}>No cards yet</p>
        ) : (
          cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              allLists={allLists}
              onDeleted={() => handleCardDeleted(card.id)}
              onMoved={(cardId, targetListId) => handleCardMoved(cardId, targetListId)}
              onUpdated={handleCardUpdated}
            />
          ))
        )}
      </ul>

      {/* Create card form */}
      <form className={styles.createForm} onSubmit={handleCreateCard} noValidate>
        <div className={styles.createRow}>
          <input
            className={styles.createInput}
            type="text"
            value={createInput}
            onChange={(e) => {
              setCreateInput(e.target.value);
              setCreateError(null);
            }}
            placeholder="Card title"
            aria-label="Card title"
            disabled={submitting}
          />
          <button
            className={styles.createButton}
            type="submit"
            disabled={submitting}
            aria-label="Add card"
          >
            Add
          </button>
        </div>
        <span className={counterClass} aria-live="polite">
          {createInput.length}/255
        </span>
        {createError !== null && (
          <span className={styles.createError}>{createError}</span>
        )}
      </form>
    </li>
  );
}
