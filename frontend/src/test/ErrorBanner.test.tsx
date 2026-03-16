/**
 * ErrorBanner.test.tsx
 *
 * Tests for the EC8 error banner component:
 *   - renders HTTP status + human-readable message
 *   - auto-dismisses after 5 seconds
 *   - manual close button calls onDismiss
 *   - cleanup: timer cancelled on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ErrorBanner from '../components/ErrorBanner';

describe('ErrorBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the HTTP status code', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner status={404} message="Not found" onDismiss={onDismiss} />);
    expect(screen.getByText(/404/)).toBeInTheDocument();
  });

  it('renders the human-readable message', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner status={500} message="Internal Server Error" onDismiss={onDismiss} />);
    expect(screen.getByText(/Internal Server Error/)).toBeInTheDocument();
  });

  it('renders both status and message together', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner status={422} message="Value error" onDismiss={onDismiss} />);
    expect(screen.getByText(/422/)).toBeInTheDocument();
    expect(screen.getByText(/Value error/)).toBeInTheDocument();
  });

  it('has a close button', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner status={500} message="Oops" onDismiss={onDismiss} />);
    expect(screen.getByRole('button', { name: /dismiss|close/i })).toBeInTheDocument();
  });

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner status={500} message="Oops" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss|close/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after 5 seconds', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner status={500} message="Oops" onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does NOT auto-dismiss before 5 seconds', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner status={500} message="Oops" onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('cancels the timer when unmounted (no stale callback)', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(
      <ErrorBanner status={500} message="Oops" onDismiss={onDismiss} />,
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('uses role="alert" for accessibility', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner status={503} message="Service unavailable" onDismiss={onDismiss} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
