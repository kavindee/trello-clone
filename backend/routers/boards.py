"""Boards router — GET/POST /boards, GET/DELETE /boards/{board_id}.

Cascade delete strategy
-----------------------
Child rows (cards → lists → board) are deleted explicitly in Python within a
single transaction.  SQLite FK-level cascade is intentionally NOT used so that
the failure-injection test (AC16) can monkeypatch `_cascade_delete_board` and
verify that a mid-cascade exception leaves every record intact.
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(tags=["boards"])


# ---------------------------------------------------------------------------
# Cascade helper — module-level so tests can monkeypatch it
# ---------------------------------------------------------------------------


def _cascade_delete_board(board_id: int, db: Session) -> None:
    """Delete all cards, all lists, then the board — in the caller's tx.

    Step 1 — collect list IDs for the board (SELECT).
    Step 2 — DELETE all cards whose list_id is in that set  ← first DELETE.
    Step 3 — DELETE all lists on the board                  ← second DELETE.
    Step 4 — DELETE the board row itself                    ← third DELETE.

    The caller is responsible for committing or rolling back the transaction.
    The function intentionally does NOT call db.commit() so that the caller
    controls atomicity.
    """
    # Step 1: collect list IDs
    list_ids: list[int] = [
        row[0]
        for row in db.execute(
            select(models.List.id).where(models.List.board_id == board_id)
        ).fetchall()
    ]

    # Step 2: delete child cards (first DELETE statement)
    if list_ids:
        db.execute(
            delete(models.Card).where(models.Card.list_id.in_(list_ids))
        )

    # Step 3: delete child lists
    db.execute(
        delete(models.List).where(models.List.board_id == board_id)
    )

    # Step 4: delete the board
    db.execute(
        delete(models.Board).where(models.Board.id == board_id)
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/boards", response_model=list[schemas.BoardResponse])
def list_boards(db: Session = Depends(get_db)):
    """Return all boards ordered by created_at ASC, then id ASC (AC2)."""
    boards = (
        db.execute(
            select(models.Board).order_by(
                models.Board.created_at.asc(),
                models.Board.id.asc(),
            )
        )
        .scalars()
        .all()
    )
    return boards


@router.post("/boards", response_model=schemas.BoardResponse, status_code=201)
def create_board(payload: schemas.BoardCreate, db: Session = Depends(get_db)):
    """Create a new board (AC1).  Validation is handled by BoardCreate."""
    board = models.Board(name=payload.name)
    db.add(board)
    db.commit()
    db.refresh(board)
    return board


@router.get("/boards/{board_id}", response_model=schemas.BoardResponse)
def get_board(board_id: int, db: Session = Depends(get_db)):
    """Return a single board by ID; 404 if not found (AC4, AC15)."""
    board = db.get(models.Board, board_id)
    if board is None:
        raise HTTPException(
            status_code=404, detail=f"Board {board_id} not found"
        )
    return board


@router.delete("/boards/{board_id}", status_code=204)
def delete_board(board_id: int, db: Session = Depends(get_db)):
    """Delete a board and all child lists/cards atomically (AC3, EC1, AC16).

    The cascade is performed by `_cascade_delete_board`.  If that function
    raises for any reason the transaction is rolled back so that no partial
    deletes persist.
    """
    board = db.get(models.Board, board_id)
    if board is None:
        raise HTTPException(
            status_code=404, detail=f"Board {board_id} not found"
        )

    try:
        _cascade_delete_board(board_id, db)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete board — transaction rolled back",
        ) from exc

    return Response(status_code=204)
