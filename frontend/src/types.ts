/**
 * TypeScript interfaces that exactly mirror the FastAPI response schemas.
 *
 * All `created_at` values are ISO-8601 datetime strings as returned by the
 * SQLite / Pydantic layer.  They are intentionally kept as `string` rather
 * than `Date` so the raw API value can be rendered directly without
 * client-side parsing.
 */

export interface Board {
  id: number;
  name: string;
  created_at: string;
}

export interface List {
  id: number;
  board_id: number;
  name: string;
  position: number;
  /** ISO date string "YYYY-MM-DD", or null when no deadline is set. */
  deadline: string | null;
  created_at: string;
}

export interface Card {
  id: number;
  list_id: number;
  title: string;
  position: number;
  /** Free-text description, or null when not set. */
  description: string | null;
  /** ISO date string "YYYY-MM-DD" start date, or null. */
  start_date: string | null;
  /** ISO date string "YYYY-MM-DD" due date, or null. */
  due_date: string | null;
  created_at: string;
}
