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
no database write is performed.  This applies even when other fields are also
present in the payload (SPEC EC3: "performs no write, returns the unchanged card
object").

PATCH atomicity
---------------
All mutations (title, list move, description, start_date, due_date) are applied
inside a single transaction (single db.commit()).

Sentinel pattern
----------------
description / start_date / due_date use model_fields_set to distinguish
"not provided" (leave unchanged) from "explicitly null" (clear the field).
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
    Returns 422 if the title is invalid or start_date > due_date (AC14).
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

    card = models.Card(
        list_id=list_id,
        title=payload.title,
        position=position,
        description=payload.description,
        start_date=payload.start_date,
        due_date=payload.due_date,
    )
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
    """Update a card's fields and/or move it to another list.

    Rules:
    • At least one field must be present — else 422 (AC14).
    • EC3: if list_id == card's current list_id the entire operation is a
      no-op; the unchanged card is returned with no write performed.
    • If list_id points to a different list: move card to the bottom of that
      list (position = MAX + 1, or 0 if the target is empty).
    • All mutations are applied atomically in a single transaction.
    • Returns 404 if the card or the target list does not exist (AC15).
    • date-order validation (start_date <= due_date) is enforced in the schema.
    """
    # ── Detect which optional fields were explicitly provided ─────────────
    description_set = "description" in payload.model_fields_set
    start_date_set  = "start_date"  in payload.model_fields_set
    due_date_set    = "due_date"    in payload.model_fields_set

    # ── Guard: at least one field required ────────────────────────────────
    if (
        payload.title is None
        and payload.list_id is None
        and not description_set
        and not start_date_set
        and not due_date_set
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "At least one of 'title', 'list_id', 'description', "
                "'start_date', or 'due_date' must be provided."
            ),
        )

    # ── Fetch card ────────────────────────────────────────────────────────
    card = db.get(models.Card, card_id)
    if card is None:
        raise HTTPException(
            status_code=404, detail=f"Card {card_id} not found"
        )

    # ── EC3: same-list move → no-op (no write of any field) ───────────────
    if payload.list_id is not None and payload.list_id == card.list_id:
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
        max_pos = db.execute(
            select(func.max(models.Card.position)).where(
                models.Card.list_id == payload.list_id
            )
        ).scalar()
        card.list_id = payload.list_id
        card.position = (max_pos + 1) if max_pos is not None else 0

    # ── Apply description update ──────────────────────────────────────────
    if description_set:
        card.description = payload.description   # None clears; str sets

    # ── Apply start_date update ───────────────────────────────────────────
    if start_date_set:
        card.start_date = payload.start_date     # None clears; date sets

    # ── Apply due_date update ─────────────────────────────────────────────
    if due_date_set:
        card.due_date = payload.due_date         # None clears; date sets

    # ── Single commit covers all mutations atomically ─────────────────────
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
