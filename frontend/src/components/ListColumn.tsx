/**
 * ListColumn — full kanban column (Tasks 7 / 8 / D / Modal).
 *
 * Task D additions:
 *   - Sort toggle: sorts visible cards by due_date ASC, nulls last (local state)
 *   - Filter cycle: All → Due soon → Overdue → All (local state)
 *   - boardFilter prop: when set to 'due-soon' or 'overdue', overrides the
 *     per-column filter and disables the filter button
 *
 * Modal addition:
 *   - "Add a card" button replaces the inline create-card form.
 *   - Opens <CardModal mode="create" /> to collect title + description + dates.
 */

import { useState, useEffect } from 'react';
import { deleteList, getCards } from '../api';
import type { ApiError } from '../api';
import type { Card, List } from '../types';
import CardItem from './CardItem';
import CardModal from './CardModal';
import ErrorBanner from './ErrorBanner';
import styles from '../styles/ListColumn.module.css';

// ── Exported type so BoardDetail can use it ────────────────────────────────
export type FilterMode = 'all' | 'due-soon' | 'overdue';

interface Props {
  list: List;
  allLists: List[];
  onDeleted: () => void;
  refreshSignal?: number;
  onCardMovedOut?: (targetListId: number) => void;
  /** When set to a non-'all' value, overrides per-column filter. */
  boardFilter?: FilterMode;
}

// ---------------------------------------------------------------------------
// Sort + filter logic (pure, no side-effects — operates on card due_date)
// ---------------------------------------------------------------------------

function applyFilter(cards: Card[], filter: FilterMode): Card[] {
  if (filter === 'all') return cards;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return cards.filter((c) => {
    if (!c.due_date) return false;
    const [y, m, d] = c.due_date.split('-').map(Number);
    const dl = new Date(y, m - 1, d);
    if (filter === 'due-soon') return dl >= today && dl <= tomorrow;
    if (filter === 'overdue') return dl < today;
    return true;
  });
}

function applySort(cards: Card[], sortOn: boolean): Card[] {
  if (!sortOn) return cards;
  return [...cards].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;    // nulls last
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date); // ISO strings sort lexicographically
  });
}

function cycleFilter(f: FilterMode): FilterMode {
  if (f === 'all') return 'due-soon';
  if (f === 'due-soon') return 'overdue';
  return 'all';
}

const FILTER_LABEL: Record<FilterMode, string> = {
  'all':      'Filter: All',
  'due-soon': 'Filter: Due soon',
  'overdue':  'Filter: Overdue',
};

// ---------------------------------------------------------------------------
// ListColumn component
// ---------------------------------------------------------------------------

export default function ListColumn({
  list,
  allLists,
  onDeleted,
  refreshSignal = 0,
  onCardMovedOut,
  boardFilter = 'all',
}: Props) {
  const [cards, setCards]       = useState<Card[]>([]);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  // Sort + filter (Task D)
  const [sortByDeadline, setSortByDeadline] = useState(false);
  const [filterMode, setFilterMode]         = useState<FilterMode>('all');

  useEffect(() => {
    getCards(list.id)
      .then(setCards)
      .catch((err: ApiError) => setApiError(err));
  }, [list.id, refreshSignal]);

  // Board-wide filter overrides local when active
  const effectiveFilter: FilterMode = boardFilter !== 'all' ? boardFilter : filterMode;
  const filterDisabled = boardFilter !== 'all';

  // Derive visible cards: filter first, then sort
  const visibleCards = applySort(applyFilter(cards, effectiveFilter), sortByDeadline);

  // ── Delete list ───────────────────────────────────────────────────────────
  async function handleDeleteList() {
    try {
      await deleteList(list.id);
      onDeleted();
    } catch (err) {
      setApiError(err as ApiError);
    }
  }

  // ── Modal callbacks ───────────────────────────────────────────────────────
  function handleModalSuccess(card: Card) {
    setCards((prev) => [...prev, card]);
    setShowAddModal(false);
  }

  // ── Card callbacks ────────────────────────────────────────────────────────
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

  return (
    <li className={styles.column}>
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

      {/* ── Task D: Sort + Filter toolbar ─────────────────────────────────── */}
      <div className={styles.toolbar}>
        <button
          className={`${styles.toolbarBtn} ${sortByDeadline ? styles.toolbarBtnActive : ''}`}
          type="button"
          onClick={() => setSortByDeadline((v) => !v)}
          aria-label={sortByDeadline ? 'Sort: deadline ↑' : 'Sort by deadline'}
          aria-pressed={sortByDeadline}
        >
          {sortByDeadline ? 'Sort: deadline ↑' : 'Sort by deadline'}
        </button>
        <button
          className={`${styles.toolbarBtn} ${effectiveFilter !== 'all' ? styles.toolbarBtnActive : ''}`}
          type="button"
          onClick={() => { if (!filterDisabled) setFilterMode((f) => cycleFilter(f)); }}
          aria-label={FILTER_LABEL[effectiveFilter]}
          aria-pressed={effectiveFilter !== 'all'}
          disabled={filterDisabled}
          data-testid="column-filter-btn"
        >
          {FILTER_LABEL[effectiveFilter]}
        </button>
      </div>

      {/* Card list */}
      <ul className={styles.cardArea}>
        {visibleCards.length === 0 ? (
          <p className={styles.empty}>No cards yet</p>
        ) : (
          visibleCards.map((card) => (
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

      {/* ── "Add a card" button ────────────────────────────────────────────── */}
      <button
        className={styles.addCardBtn}
        type="button"
        onClick={() => setShowAddModal(true)}
        aria-label="Add a card"
      >
        + Add a card
      </button>

      {/* ── Card creation modal ───────────────────────────────────────────── */}
      {showAddModal && (
        <CardModal
          mode="create"
          listId={list.id}
          allLists={allLists}
          onSuccess={handleModalSuccess}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </li>
  );
}
