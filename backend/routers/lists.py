"""Lists router — GET/POST /boards/{board_id}/lists, DELETE /lists/{list_id}.

Cascade delete strategy
-----------------------
Card rows are deleted explicitly in Python before the list row, within a
single transaction controlled by the caller.  SQLite FK-level cascade is NOT
used so that the EC2 failure-injection test can monkeypatch
`_cascade_delete_list` and verify that a mid-cascade exception rolls back all
changes atomically.

Position assignment
-------------------
`position = COUNT(existing lists on that board)` at insert time, 0-based.
Positions are never reindexed after a delete (AC6).
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(tags=["lists"])


# ---------------------------------------------------------------------------
# Cascade helper — module-level so tests can monkeypatch it (EC2 / AC16)
# ---------------------------------------------------------------------------


def _cascade_delete_list(list_id: int, db: Session) -> None:
    """Delete all cards in the list, then the list row — in the caller's tx.

    Step 1 — DELETE all cards whose list_id matches  ← first DELETE statement.
    Step 2 — DELETE the list row itself               ← second DELETE statement.

    The caller is responsible for committing or rolling back; this function
    intentionally does NOT call db.commit().
    """
    # Step 1: delete child cards (first DELETE — the one to roll back in EC2)
    db.execute(
        delete(models.Card).where(models.Card.list_id == list_id)
    )
    # Step 2: delete the list
    db.execute(
        delete(models.List).where(models.List.id == list_id)
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/boards/{board_id}/lists",
    response_model=list[schemas.ListResponse],
)
def get_lists(board_id: int, db: Session = Depends(get_db)):
    """Return all lists for a board ordered by position ASC (AC6).

    Returns 404 if the board does not exist (AC15).
    Returns an empty list if the board exists but has no lists (EC4).
    """
    board = db.get(models.Board, board_id)
    if board is None:
        raise HTTPException(
            status_code=404, detail=f"Board {board_id} not found"
        )

    lists = (
        db.execute(
            select(models.List)
            .where(models.List.board_id == board_id)
            .order_by(models.List.position.asc())
        )
        .scalars()
        .all()
    )
    return lists


@router.post(
    "/boards/{board_id}/lists",
    response_model=schemas.ListResponse,
    status_code=201,
)
def create_list(
    board_id: int,
    payload: schemas.ListCreate,
    db: Session = Depends(get_db),
):
    """Create a list on a board and append it to the right (AC5).

    position = COUNT(existing lists on that board), giving a 0-based index
    that appends to the end regardless of any gaps left by prior deletes.

    Returns 404 if the board does not exist (AC15).
    Returns 422 if the name is invalid (AC14, EC5, EC7, EC9).
    """
    board = db.get(models.Board, board_id)
    if board is None:
        raise HTTPException(
            status_code=404, detail=f"Board {board_id} not found"
        )

    # Count existing lists to determine the next position (0-based append)
    position: int = db.execute(
        select(func.count())
        .select_from(models.List)
        .where(models.List.board_id == board_id)
    ).scalar()

    lst = models.List(board_id=board_id, name=payload.name, position=position)
    db.add(lst)
    db.commit()
    db.refresh(lst)
    return lst


@router.delete("/lists/{list_id}", status_code=204)
def delete_list(list_id: int, db: Session = Depends(get_db)):
    """Delete a list and all its cards atomically (AC7, EC2, AC16).

    The cascade is performed by `_cascade_delete_list`.  Any exception from
    that helper triggers a rollback so that no partial deletes persist.

    Returns 404 if the list does not exist (AC15).
    Returns 204 on success.
    The parent board is NOT touched (EC6).
    """
    lst = db.get(models.List, list_id)
    if lst is None:
        raise HTTPException(
            status_code=404, detail=f"List {list_id} not found"
        )

    try:
        _cascade_delete_list(list_id, db)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete list — transaction rolled back",
        ) from exc

    return Response(status_code=204)
