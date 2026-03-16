# AGENTS.md — Trello Clone

## Project

Full-stack Trello clone: FastAPI backend + React frontend + SQLite.

## Rules

- ALWAYS read SPEC.md and PLAN.md before writing any code
- ALWAYS write failing tests FIRST, then implement (TDD)
- NEVER hardcode secrets, URLs, or config — use environment variables via .env
- NEVER use `git add -A` — only stage files you created or modified
- NEVER skip verification — every task is checked against acceptance criteria
- Commit with conventional messages: feat:, fix:, test:, docs:, refactor:
- Keep functions under 30 lines. If longer, break into smaller functions.
- Update CHANGELOG.md after completing each task

## Tech Stack

- Backend: Python 3.11+, FastAPI, SQLAlchemy, SQLite, Pydantic
- Frontend: React 18+, Vite, TypeScript
- Testing: pytest (backend), Vitest (frontend)

## Lessons Learned

(Pi adds entries here as issues are discovered)
