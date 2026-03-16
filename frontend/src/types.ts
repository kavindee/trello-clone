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
  created_at: string;
}

export interface Card {
  id: number;
  list_id: number;
  title: string;
  position: number;
  created_at: string;
}
