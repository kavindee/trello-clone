"""AC16 — Cascade delete atomicity: failure-injection tests.

SPEC AC16:
  "If a board or list delete operation fails mid-cascade (e.g., simulated DB
  error), no child records are deleted and the parent record remains. All
  cascade deletes execute within a single database transaction. This must be
  verifiable by an automated test that injects a failure after the first
  delete statement."

Strategy
--------
The board cascade delete is implemented by `_cascade_delete_board` in
`routers/boards.py`.  Its internal sequence is:

  1. SELECT  — fetch list IDs for the board
  2. DELETE  — cards in those lists        ← first DELETE statement
  3. DELETE  — lists on the board          ← second DELETE statement (inject here)
  4. DELETE  — the board row itself

We monkeypatch `_cascade_delete_board` with a *partial* version that executes
only step 2 (deletes cards) and then raises RuntimeError.

The router wraps the cascade in try/except and calls `db.rollback()` on any
exception, so step 2's card deletions must be fully undone.  After the
simulated failure the test asserts that the board, its lists, and its cards
all still exist.

List-level cascade atomicity (EC2) is added in test_cascade.py when the lists
router is implemented in Task 3.
"""

from unittest.mock import patch

from sqlalchemy import delete, select

import models
import routers.boards as boards_mod
import routers.lists as lists_mod


# ---------------------------------------------------------------------------
# Helper — builds a board+list+card fixture via direct DB inserts
# ---------------------------------------------------------------------------


def _seed_board_with_children(client, db, board_name: str = "Atomic Board"):
    """Create a board via the API, then add a list+card directly to the DB.

    Returns (board_id, list_id, card_id).
    """
    resp = client.post("/boards", json={"name": board_name})
    assert resp.status_code == 201
    board_id: int = resp.json()["id"]

    lst = models.List(board_id=board_id, name="Test List", position=0)
    db.add(lst)
    db.flush()

    card = models.Card(list_id=lst.id, title="Test Card", position=0)
    db.add(card)
    db.commit()

    return board_id, lst.id, card.id


# ---------------------------------------------------------------------------
# Board cascade — AC16 / EC1
# ---------------------------------------------------------------------------


def test_board_cascade_is_atomic_on_mid_cascade_failure(client, db):
    """Injecting a failure after the first DELETE rolls back the entire cascade.

    The partial cascade deletes the child cards (first DELETE statement) and
    then raises RuntimeError before the lists and the board are deleted.
    The router must catch this, call db.rollback(), and return HTTP 500.
    After that, the board, list, and card must all still exist in the DB.
    """
    board_id, list_id, card_id = _seed_board_with_children(client, db)

    def _partial_cascade(bid: int, sess) -> None:
        """Simulate: cards deleted successfully, then failure before list/board delete."""
        list_ids = [
            row[0]
            for row in sess.execute(
                select(models.List.id).where(models.List.board_id == bid)
            ).fetchall()
        ]
        if list_ids:
            # Execute the first DELETE (cards) — this is what must be rolled back
            sess.execute(
                delete(models.Card).where(models.Card.list_id.in_(list_ids))
            )
        # Raise before deleting lists or the board
        raise RuntimeError("Injected mid-cascade failure (after first DELETE)")

    with patch.object(boards_mod, "_cascade_delete_board", _partial_cascade):
        resp = client.delete(f"/boards/{board_id}")

    # The endpoint must have returned a server error
    assert resp.status_code == 500, (
        f"Expected 500 from failed cascade, got {resp.status_code}"
    )

    # The rollback must have undone the card deletion and left everything intact
    db.expire_all()  # flush the session's identity-map cache

    board = db.get(models.Board, board_id)
    assert board is not None, "Board must survive a failed cascade delete"

    lst = db.get(models.List, list_id)
    assert lst is not None, "List must survive a failed cascade delete"

    card = db.get(models.Card, card_id)
    assert card is not None, (
        "Card must survive a failed cascade delete — "
        "the first DELETE statement must have been rolled back"
    )


def test_board_cascade_failure_does_not_affect_other_boards(client, db):
    """A failed board delete must leave unrelated boards completely untouched."""
    # Board whose delete will fail
    bad_board_id, _, _ = _seed_board_with_children(client, db, "Bad Board")
    # Unrelated board that must not be touched
    good_board_id = client.post("/boards", json={"name": "Good Board"}).json()["id"]

    def _failing_cascade(bid: int, sess) -> None:
        raise RuntimeError("Instant failure — nothing deleted")

    with patch.object(boards_mod, "_cascade_delete_board", _failing_cascade):
        client.delete(f"/boards/{bad_board_id}")

    # Good board must be completely unaffected
    assert client.get(f"/boards/{good_board_id}").status_code == 200


def test_successful_cascade_removes_all_children(client, db):
    """Sanity check: without any patch, cascade delete removes board+list+card."""
    board_id, list_id, card_id = _seed_board_with_children(client, db)

    resp = client.delete(f"/boards/{board_id}")
    assert resp.status_code == 204

    db.expire_all()
    assert db.get(models.Board, board_id) is None
    assert db.get(models.List, list_id) is None
    assert db.get(models.Card, card_id) is None


def test_board_cascade_handles_board_with_multiple_lists_and_cards(client, db):
    """Atomicity holds when multiple lists and cards are present."""
    resp = client.post("/boards", json={"name": "Multi-list Board"})
    board_id = resp.json()["id"]

    list_ids = []
    card_ids = []
    for i in range(3):
        lst = models.List(board_id=board_id, name=f"List {i}", position=i)
        db.add(lst)
        db.flush()
        list_ids.append(lst.id)
        for j in range(2):
            card = models.Card(list_id=lst.id, title=f"Card {i}-{j}", position=j)
            db.add(card)
            db.flush()
            card_ids.append(card.id)
    db.commit()

    # Inject failure after first DELETE (cards)
    def _partial_cascade(bid: int, sess) -> None:
        lids = [
            r[0]
            for r in sess.execute(
                select(models.List.id).where(models.List.board_id == bid)
            ).fetchall()
        ]
        if lids:
            sess.execute(delete(models.Card).where(models.Card.list_id.in_(lids)))
        raise RuntimeError("Injected failure")

    with patch.object(boards_mod, "_cascade_delete_board", _partial_cascade):
        resp = client.delete(f"/boards/{board_id}")
    assert resp.status_code == 500

    db.expire_all()
    # Board must still exist
    assert db.get(models.Board, board_id) is not None
    # All lists must still exist
    for lid in list_ids:
        assert db.get(models.List, lid) is not None, f"List {lid} must be intact"
    # All cards must still exist
    for cid in card_ids:
        assert db.get(models.Card, cid) is not None, f"Card {cid} must be intact"


# ---------------------------------------------------------------------------
# List cascade — EC2 / AC16
# ---------------------------------------------------------------------------


def _seed_list_with_cards(
    client, db, board_id: int, list_name: str = "Test List"
) -> tuple[int, list[int]]:
    """Create a list via the API, then add cards directly to the DB.

    Returns (list_id, [card_id, ...]).
    """
    resp = client.post(f"/boards/{board_id}/lists", json={"name": list_name})
    assert resp.status_code == 201, resp.text
    list_id: int = resp.json()["id"]

    card_ids: list[int] = []
    for i in range(2):
        card = models.Card(list_id=list_id, title=f"Card {i}", position=i)
        db.add(card)
        db.flush()
        card_ids.append(card.id)
    db.commit()

    return list_id, card_ids


def test_list_cascade_is_atomic_on_mid_cascade_failure(client, db):
    """EC2: injecting a failure after the first DELETE rolls back card deletions.

    The partial cascade executes DELETE cards (first statement) and then
    raises RuntimeError before DELETE list.  The router must catch this,
    call db.rollback(), and return HTTP 500.  After that, both the list and
    all its cards must still exist.
    """
    board_id = client.post("/boards", json={"name": "EC2 Board"}).json()["id"]
    list_id, card_ids = _seed_list_with_cards(client, db, board_id)

    def _partial_cascade(lid: int, sess) -> None:
        """Delete cards (first DELETE) then raise before deleting the list."""
        sess.execute(
            delete(models.Card).where(models.Card.list_id == lid)
        )
        raise RuntimeError("Injected mid-cascade failure (after first DELETE)")

    with patch.object(lists_mod, "_cascade_delete_list", _partial_cascade):
        resp = client.delete(f"/lists/{list_id}")

    assert resp.status_code == 500, (
        f"Expected 500 from failed list cascade, got {resp.status_code}"
    )

    db.expire_all()

    lst = db.get(models.List, list_id)
    assert lst is not None, "List must survive a failed cascade delete"

    for cid in card_ids:
        assert db.get(models.Card, cid) is not None, (
            f"Card {cid} must survive — first DELETE must have been rolled back"
        )


def test_list_cascade_failure_does_not_affect_sibling_lists(client, db):
    """A failed list delete must leave sibling lists completely untouched."""
    board_id = client.post("/boards", json={"name": "Sibling Board"}).json()["id"]
    bad_list_id, _ = _seed_list_with_cards(client, db, board_id, "Bad List")
    good_list_id = client.post(
        f"/boards/{board_id}/lists", json={"name": "Good List"}
    ).json()["id"]

    def _failing_cascade(lid: int, sess) -> None:
        raise RuntimeError("Instant failure — nothing deleted")

    with patch.object(lists_mod, "_cascade_delete_list", _failing_cascade):
        client.delete(f"/lists/{bad_list_id}")

    # Good list must still be accessible
    lists = client.get(f"/boards/{board_id}/lists").json()
    assert any(lst["id"] == good_list_id for lst in lists), (
        "Good list must be unaffected by a failed sibling delete"
    )


def test_list_cascade_failure_leaves_board_intact(client, db):
    """A failed list delete must leave the parent board intact."""
    board_id = client.post("/boards", json={"name": "Board Stays"}).json()["id"]
    list_id, _ = _seed_list_with_cards(client, db, board_id)

    def _failing_cascade(lid: int, sess) -> None:
        raise RuntimeError("Instant failure")

    with patch.object(lists_mod, "_cascade_delete_list", _failing_cascade):
        client.delete(f"/lists/{list_id}")

    assert client.get(f"/boards/{board_id}").status_code == 200, (
        "Board must survive a failed list cascade delete"
    )


def test_successful_list_cascade_removes_list_and_cards(client, db):
    """Sanity check: a clean list delete removes the list and all its cards."""
    board_id = client.post("/boards", json={"name": "Sanity Board"}).json()["id"]
    list_id, card_ids = _seed_list_with_cards(client, db, board_id)

    resp = client.delete(f"/lists/{list_id}")
    assert resp.status_code == 204

    db.expire_all()
    assert db.get(models.List, list_id) is None, "List must be deleted"
    for cid in card_ids:
        assert db.get(models.Card, cid) is None, f"Card {cid} must be deleted"
