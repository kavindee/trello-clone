/**
 * CardItem — single card: preview / edit / delete / move.
 *
 * AC10  — all displayed card data (title, description, dates) comes from
 *          the API response body returned by CardModal.onSuccess, never
 *          from local component state or user input
 * AC11  — delete card
 * AC12  — move card to another list via dropdown
 * EC3   — moving to same list: no API call
 * EC8   — ErrorBanner on delete / move failure; UI unchanged on failure
 * EC9   — title + description rendered as JSX text children, never innerHTML
 *
 * Click interactions:
 *   - Clicking anywhere on the card opens CardModal in preview mode
 *   - Clicking the Edit button opens CardModal in edit mode directly
 *     (stopPropagation so the card's onClick does not also fire)
 *   - Clicking Delete deletes the card
 *     (stopPropagation so the card's onClick does not also fire)
 *   - The move-row has stopPropagation so interacting with it doesn't
 *     open the preview modal
 *
 * Single <CardModal /> instance — modalMode controls which mode is shown:
 *   preview → onEdit() switches to edit mode (modal stays open)
 *   edit    → onSuccess() updates displayCard (AC10) and closes modal
 */

import { useState } from "react";
import { deleteCard, updateCard } from "../api";
import type { ApiError } from "../api";
import type { Card, List } from "../types";
import CardModal from "./CardModal";
import ErrorBanner from "./ErrorBanner";
import styles from "../styles/CardItem.module.css";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  card: Card;
  allLists: List[];
  onDeleted: () => void;
  onMoved: (cardId: number, targetListId: number) => void;
  onUpdated: (card: Card) => void;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

type DueDateStatus = "overdue" | "soon" | "future";

function getDueDateStatus(dueDate: string | null): DueDateStatus | null {
  if (!dueDate) return null;
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (due < today) return "overdue";
  if (due <= tomorrow) return "soon";
  return "future";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  const status = getDueDateStatus(dueDate);
  if (!status || !dueDate) return null;
  const cls =
    status === "overdue"
      ? styles.deadlineOverdue
      : status === "soon"
        ? styles.deadlineSoon
        : styles.deadlineFuture;
  return (
    <span className={cls} data-testid={`due-date-${status}`}>
      Due: {dueDate}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CardItem component
// ---------------------------------------------------------------------------

export default function CardItem({
  card,
  allLists,
  onDeleted,
  onMoved,
  onUpdated,
}: Props) {
  // AC10: displayCard is always set from API response, never from local input
  const [displayCard, setDisplayCard] = useState<Card>(card);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"preview" | "edit">("preview");
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [targetListId, setTargetListId] = useState<number>(0);

  const otherLists = allLists.filter((l) => l.id !== displayCard.list_id);

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    try {
      await deleteCard(displayCard.id);
      onDeleted();
    } catch (err) {
      setApiError(err as ApiError);
    }
  }

  // ── Move ──────────────────────────────────────────────────────────────────
  async function handleMove() {
    if (targetListId === 0) return;
    if (targetListId === displayCard.list_id) return; // EC3
    try {
      const updated = await updateCard(displayCard.id, {
        list_id: targetListId,
      });
      onMoved(displayCard.id, updated.list_id);
      setTargetListId(0);
    } catch (err) {
      setApiError(err as ApiError);
    }
  }

  // ── Modal callbacks ───────────────────────────────────────────────────────

  /** Preview → Edit: keep the modal open, just switch mode. */
  function handleEditFromPreview() {
    setModalMode("edit");
  }

  /** Edit onSuccess: update displayCard from API response body (AC10). */
  function handleEditSuccess(updatedCard: Card) {
    const moved = updatedCard.list_id !== displayCard.list_id;
    setDisplayCard(updatedCard); // AC10: always from API response body
    setModalOpen(false);
    if (moved) {
      onMoved(updatedCard.id, updatedCard.list_id);
    } else {
      onUpdated(updatedCard);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <li
      className={styles.card}
      onClick={() => {
        setModalMode("preview");
        setModalOpen(true);
      }}
    >
      {apiError !== null && (
        <ErrorBanner
          status={apiError.status}
          message={apiError.message}
          onDismiss={() => setApiError(null)}
        />
      )}

      {/* Title row + action buttons */}
      <div className={styles.displayRow}>
        <span className={styles.title}>{displayCard.title}</span>
        <div className={styles.actions}>
          {/* <button
            className={styles.editBtn}
            onClick={(e) => {
              e.stopPropagation();
              setModalMode('edit');
              setModalOpen(true);
            }}
            aria-label="Edit"
          >
            Edit
          </button> */}
          <button
            className={styles.deleteBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            aria-label={`Delete card ${displayCard.title}`}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Description — plain text, only when set */}
      {displayCard.description !== null && displayCard.description !== "" && (
        <p className={styles.description} data-testid="card-description">
          {displayCard.description}
        </p>
      )}

      {/* Due-date badge */}
      <DueDateBadge dueDate={displayCard.due_date} />

      {/* Start-date label */}
      {displayCard.start_date !== null && (
        <span className={styles.startDateLabel}>
          Start: {displayCard.start_date}
        </span>
      )}

      {/* Move-to-list dropdown — stopPropagation so clicks here don't open preview */}
      {otherLists.length > 0 && (
        <div className={styles.moveRow} onClick={(e) => e.stopPropagation()}>
          <select
            className={styles.moveSelect}
            value={targetListId === 0 ? "" : String(targetListId)}
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

      {/* Single modal instance — mode prop controls preview vs edit */}
      {modalOpen && (
        <CardModal
          mode={modalMode}
          card={displayCard}
          allLists={allLists}
          onSuccess={handleEditSuccess}
          onEdit={handleEditFromPreview}
          onClose={() => setModalOpen(false)}
        />
      )}
    </li>
  );
}
