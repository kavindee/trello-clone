/**
 * CardModal — modal overlay for creating or editing a card.
 *
 * Create mode: title required, description / start_date / due_date optional.
 *   Calls createCard(listId, payload) on submit.
 *
 * Edit mode: pre-fills all fields from the card prop.
 *   Calls updateCard(card.id, changedFields) on submit.
 *   Shows a move-to-list dropdown when allLists has more than one entry.
 *
 * Closes on: Cancel button | backdrop click | Escape key.
 * Stays open on: API failure (shows ErrorBanner inside the modal).
 */

import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { createCard, updateCard } from '../api';
import type { ApiError } from '../api';
import type { Card, List } from '../types';
import ErrorBanner from './ErrorBanner';
import styles from '../styles/CardModal.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  mode: 'create' | 'edit';
  listId?: number;      // required in create mode
  card?: Card;          // required in edit mode
  allLists: List[];
  onSuccess: (card: Card) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TITLE = 255;
const MAX_DESC  = 1000;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" → local-time Date (avoids UTC midnight shifting the day). */
function parseDateStr(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local Date → "YYYY-MM-DD", or null. */
function formatDateToISO(d: Date | null): string | null {
  if (!d) return null;
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

function validateTitle(value: string): string | null {
  if (value.trim() === '') return 'Card title cannot be empty';
  if (value.length > MAX_TITLE) return `Card title must be ${MAX_TITLE} characters or fewer`;
  return null;
}

function validateDescription(value: string): string | null {
  if (value.length > MAX_DESC) return `Description must be ${MAX_DESC} characters or fewer`;
  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <label className={styles.label} htmlFor={htmlFor}>{children}</label>;
}

// ---------------------------------------------------------------------------
// CardModal component
// ---------------------------------------------------------------------------

export default function CardModal({
  mode,
  listId,
  card,
  allLists,
  onSuccess,
  onClose,
}: Props) {
  const [title, setTitle]           = useState(card?.title ?? '');
  const [description, setDesc]      = useState(card?.description ?? '');
  const [startDate, setStartDate]   = useState<string | null>(card?.start_date ?? null);
  const [dueDate, setDueDate]       = useState<string | null>(card?.due_date ?? null);
  const [targetListId, setTargetId] = useState<number>(0);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descError, setDescError]   = useState<string | null>(null);
  const [dateError, setDateError]   = useState<string | null>(null);
  const [apiError, setApiError]     = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Escape key closes the modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const tErr = validateTitle(title);
    const dErr = validateDescription(description);
    const dateErr =
      startDate && dueDate && startDate > dueDate
        ? 'Start date must be before due date'
        : null;
    setTitleError(tErr);
    setDescError(dErr);
    setDateError(dateErr);
    return tErr === null && dErr === null && dateErr === null;
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate() {
    const trimmedTitle = title.trim();
    const trimmedDesc  = description.trim() || null;
    const payload: Parameters<typeof createCard>[1] = { title: trimmedTitle };
    if (trimmedDesc)  payload.description = trimmedDesc;
    if (startDate)    payload.start_date  = startDate;
    if (dueDate)      payload.due_date    = dueDate;

    try {
      const newCard = await createCard(listId!, payload);
      onSuccess(newCard);
      onClose();
    } catch (err) {
      setApiError(err as ApiError);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  async function handleEdit() {
    const trimmedTitle = title.trim();
    const trimmedDesc  = description.trim() || null;
    const patch: Parameters<typeof updateCard>[1] = {};
    if (trimmedTitle !== card!.title)         patch.title       = trimmedTitle;
    if (trimmedDesc  !== card!.description)   patch.description = trimmedDesc;
    if (startDate    !== card!.start_date)    patch.start_date  = startDate;
    if (dueDate      !== card!.due_date)      patch.due_date    = dueDate;
    if (targetListId !== 0 && targetListId !== card!.list_id) {
      patch.list_id = targetListId;
    }
    if (Object.keys(patch).length === 0) { onClose(); return; }

    try {
      const updated = await updateCard(card!.id, patch);
      onSuccess(updated);
      onClose();
    } catch (err) {
      setApiError(err as ApiError);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    if (mode === 'create') await handleCreate();
    else                   await handleEdit();
    setSubmitting(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const otherLists = allLists.filter((l) => l.id !== card?.list_id);
  const titleCounterCls = title.length > MAX_TITLE ? styles.counterOver : styles.counter;
  const descCounterCls  = description.length > MAX_DESC  ? styles.counterOver : styles.counter;

  return (
    <div
      className={styles.backdrop}
      data-testid="card-modal-backdrop"
      onClick={onClose}
    >
      <div
        className={styles.modal}
        data-testid="card-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Error banner at top of modal */}
        {apiError !== null && (
          <ErrorBanner
            status={apiError.status}
            message={apiError.message}
            onDismiss={() => setApiError(null)}
          />
        )}

        <h2 className={styles.heading}>
          {mode === 'create' ? 'Add a card' : 'Edit card'}
        </h2>

        {/* Title */}
        <div className={styles.field}>
          <FieldLabel htmlFor="cm-title">Title *</FieldLabel>
          <input
            id="cm-title"
            className={styles.titleInput}
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleError(null); }}
            aria-label="Card title"
            autoFocus
          />
          <span className={titleCounterCls} aria-live="polite">
            {title.length}/255
          </span>
          {titleError !== null && (
            <span className={styles.errorMsg} role="status">{titleError}</span>
          )}
        </div>

        {/* Description */}
        <div className={styles.field}>
          <FieldLabel htmlFor="cm-desc">Description</FieldLabel>
          <textarea
            id="cm-desc"
            className={styles.descArea}
            value={description}
            onChange={(e) => { setDesc(e.target.value); setDescError(null); }}
            aria-label="Description"
            rows={3}
          />
          <span className={descCounterCls} aria-live="polite">
            {description.length}/1000
          </span>
          {descError !== null && (
            <span className={styles.errorMsg} role="status">{descError}</span>
          )}
        </div>

        {/* Date row */}
        <div className={styles.dateRow}>
          <div className={styles.dateGroup}>
            <FieldLabel htmlFor="cm-start">Start date</FieldLabel>
            <DatePicker
              selected={parseDateStr(startDate)}
              onChange={(d: Date | null) => { setStartDate(formatDateToISO(d)); setDateError(null); }}
              dateFormat="yyyy-MM-dd"
              placeholderText="No start date"
              isClearable={false}
              aria-label="Start date"
            />
          </div>
          <div className={styles.dateGroup}>
            <FieldLabel htmlFor="cm-due">Due date</FieldLabel>
            <DatePicker
              selected={parseDateStr(dueDate)}
              onChange={(d: Date | null) => { setDueDate(formatDateToISO(d)); setDateError(null); }}
              dateFormat="yyyy-MM-dd"
              placeholderText="No due date"
              isClearable={false}
              aria-label="Due date"
            />
          </div>
        </div>
        {dateError !== null && (
          <span className={styles.errorMsg} role="status">{dateError}</span>
        )}

        {/* Move-to-list dropdown (edit mode only) */}
        {mode === 'edit' && otherLists.length > 0 && (
          <div className={styles.field}>
            <FieldLabel htmlFor="cm-move">Move to list</FieldLabel>
            <select
              id="cm-move"
              className={styles.moveSelect}
              value={targetListId === 0 ? '' : String(targetListId)}
              onChange={(e) => setTargetId(Number(e.target.value))}
              aria-label="Move to list"
            >
              <option value="">— Keep current list —</option>
              {otherLists.map((l) => (
                <option key={l.id} value={String(l.id)}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className={styles.submitBtn}
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            aria-label={mode === 'create' ? 'Add card' : 'Save'}
          >
            {mode === 'create' ? 'Add Card' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
