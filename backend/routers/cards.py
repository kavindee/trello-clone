"""Cards router — POST /lists/{list_id}/cards, PATCH /cards/{id}, DELETE /cards/{id}.

Position rules (PLAN.md)
------------------------
  Create : position = COUNT(existing cards in that list)  — 0-based append.
  Move   : position = MAX(position in target list) + 1    — append to bottom.
           If target list is empty MAX returns NULL → position = 0.
  Delete : positions of remaining cards are NOT reindexed (AC9).

PATCH / EC3 (same-list move is a no-op)
----------------------------------------
If the PATCH body supplies a list_id that equals the card's current list_id,
the entire operation is treated as a no-op: the card is returned unchanged and
no database write is performed.  This applies even when a title is also present
in the payload (SPEC EC3: "performs no write, returns the unchanged card object").

PATCH atomicity
---------------
When both title and list_id (pointing to a different list) are supplied, both
mutations are applied inside a single transaction (single db.commit()).
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(tags=["cards"])


# ---------------------------------------------------------------------------
# POST /lists/{list_id}/cards — AC8, AC13, AC14, AC15
# ---------------------------------------------------------------------------


@router.post(
    "/lists/{list_id}/cards",
    response_model=schemas.CardResponse,
    status_code=201,
)
def create_card(
    list_id: int,
    payload: schemas.CardCreate,
    db: Session = Depends(get_db),
):
    """Create a card at the bottom of a list (AC8).

    position = COUNT(existing cards in that list), giving a 0-based index that
    appends to the end regardless of any gaps left by prior deletes (AC9).

    Returns 404 if the list does not exist (AC15).
    Returns 422 if the title is invalid (AC14, EC5, EC7, EC9).
    """
    lst = db.get(models.List, list_id)
    if lst is None:
        raise HTTPException(
            status_code=404, detail=f"List {list_id} not found"
        )

    position: int = db.execute(
        select(func.count())
        .select_from(models.Card)
        .where(models.Card.list_id == list_id)
    ).scalar()

    card = models.Card(list_id=list_id, title=payload.title, position=position)
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


# ---------------------------------------------------------------------------
# PATCH /cards/{card_id} — AC10, AC12, AC13, AC14, AC15, EC3
# ---------------------------------------------------------------------------


@router.patch("/cards/{card_id}", response_model=schemas.CardResponse)
def patch_card(
    card_id: int,
    payload: schemas.CardPatch,
    db: Session = Depends(get_db),
):
    """Update a card's title and/or move it to another list.

    Rules:
    • At least one of `title` / `list_id` must be present — else 422 (AC14).
    • EC3: if list_id == card's current list_id the entire operation is a
      no-op; the unchanged card is returned with no write performed.
    • If list_id points to a different list: move card to the bottom of that
      list (position = MAX + 1, or 0 if the target is empty).
    • When both title and a different list_id are provided, both mutations are
      applied atomically in a single transaction.
    • Returns 404 if the card or the target list does not exist (AC15).
    """
    # ── Guard: at least one field required ───────────────────────────────
    if payload.title is None and payload.list_id is None:
        raise HTTPException(
            status_code=422,
            detail="At least one of 'title' or 'list_id' must be provided.",
        )

    # ── Fetch card ────────────────────────────────────────────────────────
    card = db.get(models.Card, card_id)
    if card is None:
        raise HTTPException(
            status_code=404, detail=f"Card {card_id} not found"
        )

    # ── EC3: same-list move → no-op ───────────────────────────────────────
    if payload.list_id is not None and payload.list_id == card.list_id:
        # SPEC EC3: "performs no write, returns the unchanged card object."
        # This applies even when a title is also supplied in the payload.
        return card

    # ── Apply title update ────────────────────────────────────────────────
    if payload.title is not None:
        card.title = payload.title

    # ── Apply list move ───────────────────────────────────────────────────
    if payload.list_id is not None:
        target = db.get(models.List, payload.list_id)
        if target is None:
            raise HTTPException(
                status_code=404,
                detail=f"List {payload.list_id} not found",
            )

        # MAX(position) in target list; NULL when the list is empty → use 0.
        max_pos = db.execute(
            select(func.max(models.Card.position)).where(
                models.Card.list_id == payload.list_id
            )
        ).scalar()

        card.list_id = payload.list_id
        card.position = (max_pos + 1) if max_pos is not None else 0

    # ── Single commit covers title + move atomically ──────────────────────
    db.commit()
    db.refresh(card)
    return card


# ---------------------------------------------------------------------------
# DELETE /cards/{card_id} — AC11, AC13, AC15
# ---------------------------------------------------------------------------


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(card_id: int, db: Session = Depends(get_db)):
    """Permanently delete a card (AC11).

    Positions of sibling cards are NOT reindexed (AC9).
    Returns 404 if the card does not exist (AC15).
    Returns 204 on success.
    """
    card = db.get(models.Card, card_id)
    if card is None:
        raise HTTPException(
            status_code=404, detail=f"Card {card_id} not found"
        )

    db.execute(delete(models.Card).where(models.Card.id == card_id))
    db.commit()
    return Response(status_code=204)
