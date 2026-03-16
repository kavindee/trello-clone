/**
 * ErrorBanner — EC8 inline error display.
 *
 * Shows HTTP status + human-readable message above the affected area.
 * Auto-dismisses after 5 seconds; also has a manual close button (×).
 *
 * Usage:
 *   {error && (
 *     <ErrorBanner
 *       status={error.status}
 *       message={error.message}
 *       onDismiss={() => setError(null)}
 *     />
 *   )}
 */

import { useEffect, useRef } from 'react';
import styles from '../styles/ErrorBanner.module.css';

interface Props {
  status: number;
  message: string;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 5000;

export default function ErrorBanner({ status, message, onDismiss }: Props) {
  // Keep a stable ref to the latest onDismiss so the timer started on mount
  // always calls the current callback without restarting the 5-second clock.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []); // intentionally empty — timer runs once on mount, cleaned up on unmount

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.status}>{status}</span>
      <span className={styles.message}>{message}</span>
      <button
        className={styles.close}
        onClick={onDismiss}
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  );
}
