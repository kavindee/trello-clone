"""Tests for the cards endpoints.

Covers:
  - AC8  — create a card (POST /lists/{id}/cards → 201)
  - AC9  — position assigned 0-based; no reindex after delete
  - AC10 — PATCH title: response carries updated title from DB (not local state)
  - AC11 — delete a card (DELETE /cards/{id} → 204)
  - AC12 — move card to another list; appends to bottom; persists after reload
  - AC13 — all three card endpoints respond with correct HTTP codes
  - AC14 — input validation: empty, whitespace, newlines, >255 → 422;
           PATCH with neither field → 422
  - AC15 — 404 for missing list (create/move) and missing card (patch/delete)
  - EC3  — PATCH list_id == current list_id → 200, no DB write, unchanged card
"""

import models


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_board(client, name: str = "Board") -> int:
    r = client.post("/boards", json={"name": name})
    assert r.status_code == 201
    return r.json()["id"]


def _make_list(client, board_id: int, name: str = "List") -> int:
    r = client.post(f"/boards/{board_id}/lists", json={"name": name})
    assert r.status_code == 201
    return r.json()["id"]


def _make_card(client, list_id: int, title: str = "Card") -> dict:
    r = client.post(f"/lists/{list_id}/cards", json={"title": title})
    assert r.status_code == 201, r.text
    return r.json()


def _get_card(db, card_id: int):
    """Fetch a card fresh from the DB (bypasses session cache)."""
    db.expire_all()
    return db.get(models.Card, card_id)


# ---------------------------------------------------------------------------
# POST /lists/{id}/cards — AC8, AC13
# ---------------------------------------------------------------------------


def test_create_card_returns_201(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    r = client.post(f"/lists/{lid}/cards", json={"title": "First"})
    assert r.status_code == 201


def test_create_card_response_schema(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    data = _make_card(client, lid, "My Card")
    assert isinstance(data["id"], int)
    assert data["list_id"] == lid
    assert data["title"] == "My Card"
    assert isinstance(data["position"], int)
    assert "created_at" in data


def test_create_first_card_position_zero(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid, "Alpha")
    assert card["position"] == 0


def test_create_second_card_position_one(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    _make_card(client, lid, "Alpha")
    beta = _make_card(client, lid, "Beta")
    assert beta["position"] == 1


def test_create_third_card_position_two(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    for t in ("X", "Y"):
        _make_card(client, lid, t)
    z = _make_card(client, lid, "Z")
    assert z["position"] == 2


def test_create_card_preserves_utf8_title(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    title = "修正 🐛 <b>bold</b>"
    card = _make_card(client, lid, title)
    assert card["title"] == title


def test_create_card_404_on_missing_list(client):
    r = client.post("/lists/99999/cards", json={"title": "Ghost"})
    assert r.status_code == 404


def test_create_card_404_detail_contains_list_id(client):
    r = client.post("/lists/99999/cards", json={"title": "Ghost"})
    assert "99999" in r.json()["detail"]


def test_cards_isolated_between_lists(client):
    bid = _make_board(client)
    l1 = _make_list(client, bid, "L1")
    l2 = _make_list(client, bid, "L2")
    c1 = _make_card(client, l1, "InL1")
    # c1's position is 0 in l1; first card in l2 must also be 0
    c2 = _make_card(client, l2, "InL2")
    assert c2["position"] == 0, "First card in L2 must start at position 0"
    assert c1["list_id"] != c2["list_id"]


# ---------------------------------------------------------------------------
# AC9 — position not reindexed after delete
# ---------------------------------------------------------------------------


def test_card_positions_not_reindexed_after_delete(client, db):
    """Deleting a middle card must NOT reindex the remaining cards' positions."""
    bid = _make_board(client)
    lid = _make_list(client, bid)
    a = _make_card(client, lid, "A")  # position 0
    b = _make_card(client, lid, "B")  # position 1
    c = _make_card(client, lid, "C")  # position 2

    client.delete(f"/cards/{b['id']}")

    db.expire_all()
    card_a = db.get(models.Card, a["id"])
    card_c = db.get(models.Card, c["id"])
    assert card_a.position == 0, "A must keep position 0"
    assert card_c.position == 2, "C must keep position 2 — no reindex"


# ---------------------------------------------------------------------------
# PATCH /cards/{id} — AC10, AC12, EC3
# ---------------------------------------------------------------------------


def test_patch_title_only_returns_200(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid, "Original")
    r = client.patch(f"/cards/{card['id']}", json={"title": "Updated"})
    assert r.status_code == 200


def test_patch_title_only_response_has_new_title(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid, "Original")
    data = client.patch(f"/cards/{card['id']}", json={"title": "Renamed"}).json()
    assert data["title"] == "Renamed"


def test_patch_title_only_list_unchanged(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid, "Original")
    data = client.patch(f"/cards/{card['id']}", json={"title": "New"}).json()
    assert data["list_id"] == lid


def test_patch_title_persists_in_db(client, db):
    """Title from PATCH response must match what is stored in the DB (AC10)."""
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid, "Before")
    client.patch(f"/cards/{card['id']}", json={"title": "After"})
    fresh = _get_card(db, card["id"])
    assert fresh.title == "After"


def test_patch_response_title_comes_from_db_not_echo(client, db):
    """Response title must reflect what was persisted, not just echo the input."""
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid, "Before")
    resp_data = client.patch(
        f"/cards/{card['id']}", json={"title": "Persisted Title"}
    ).json()
    fresh = _get_card(db, card["id"])
    assert resp_data["title"] == fresh.title


# ---------------------------------------------------------------------------
# PATCH — move to a different list (AC12)
# ---------------------------------------------------------------------------


def test_patch_move_returns_200(client):
    bid = _make_board(client)
    l1 = _make_list(client, bid, "L1")
    l2 = _make_list(client, bid, "L2")
    card = _make_card(client, l1, "Traveller")
    r = client.patch(f"/cards/{card['id']}", json={"list_id": l2})
    assert r.status_code == 200


def test_patch_move_response_has_new_list_id(client):
    bid = _make_board(client)
    l1 = _make_list(client, bid, "L1")
    l2 = _make_list(client, bid, "L2")
    card = _make_card(client, l1)
    data = client.patch(f"/cards/{card['id']}", json={"list_id": l2}).json()
    assert data["list_id"] == l2


def test_patch_move_to_empty_list_gets_position_zero(client):
    """Moving to an empty list must give position = 0 (MAX is NULL → 0)."""
    bid = _make_board(client)
    l1 = _make_list(client, bid, "L1")
    l2 = _make_list(client, bid, "L2")  # empty
    card = _make_card(client, l1)
    data = client.patch(f"/cards/{card['id']}", json={"list_id": l2}).json()
    assert data["position"] == 0


def test_patch_move_appends_to_bottom_of_target(client):
    """Moved card must receive position = MAX(target positions) + 1 (AC12)."""
    bid = _make_board(client)
    l1 = _make_list(client, bid, "L1")
    l2 = _make_list(client, bid, "L2")
    # Seed L2 with 3 cards at positions 0, 1, 2
    for t in ("A", "B", "C"):
        _make_card(client, l2, t)
    # Move a card from L1 into L2 — should land at position 3
    traveller = _make_card(client, l1, "Traveller")
    data = client.patch(f"/cards/{traveller['id']}", json={"list_id": l2}).json()
    assert data["position"] == 3


def test_patch_move_persists_after_reload(client, db):
    """Moved card must be in the target list when queried from DB (AC12)."""
    bid = _make_board(client)
    l1 = _make_list(client, bid, "L1")
    l2 = _make_list(client, bid, "L2")
    card = _make_card(client, l1)
    client.patch(f"/cards/{card['id']}", json={"list_id": l2})
    fresh = _get_card(db, card["id"])
    assert fresh.list_id == l2


def test_patch_move_source_list_id_gone(client, db):
    """After move the card must no longer be associated with the source list."""
    bid = _make_board(client)
    l1 = _make_list(client, bid, "L1")
    l2 = _make_list(client, bid, "L2")
    card = _make_card(client, l1)
    client.patch(f"/cards/{card['id']}", json={"list_id": l2})
    fresh = _get_card(db, card["id"])
    assert fresh.list_id != l1


def test_patch_move_404_on_missing_target_list(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid)
    r = client.patch(f"/cards/{card['id']}", json={"list_id": 99999})
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# PATCH — both title and list_id together (atomic, AC10 + AC12)
# ---------------------------------------------------------------------------


def test_patch_both_fields_returns_200(client):
    bid = _make_board(client)
    l1 = _make_list(client, bid, "L1")
    l2 = _make_list(client, bid, "L2")
    card = _make_card(client, l1, "Before")
    r = client.patch(
        f"/cards/{card['id']}", json={"title": "After", "list_id": l2}
    )
    assert r.status_code == 200


def test_patch_both_fields_applied_atomically(client, db):
    """Title update and list move must both be reflected in a single response."""
    bid = _make_board(client)
    l1 = _make_list(client, bid, "L1")
    l2 = _make_list(client, bid, "L2")
    card = _make_card(client, l1, "Original")
    data = client.patch(
        f"/cards/{card['id']}", json={"title": "Renamed", "list_id": l2}
    ).json()
    assert data["title"] == "Renamed"
    assert data["list_id"] == l2

    # Confirm DB is consistent
    fresh = _get_card(db, card["id"])
    assert fresh.title == "Renamed"
    assert fresh.list_id == l2


def test_patch_both_fields_position_appended(client):
    """When moved with a title change the position is still MAX+1."""
    bid = _make_board(client)
    l1 = _make_list(client, bid, "L1")
    l2 = _make_list(client, bid, "L2")
    _make_card(client, l2, "Existing")  # position 0 in L2
    card = _make_card(client, l1, "Mover")
    data = client.patch(
        f"/cards/{card['id']}", json={"title": "Moved", "list_id": l2}
    ).json()
    assert data["position"] == 1


# ---------------------------------------------------------------------------
# PATCH — EC3: same-list move is a no-op
# ---------------------------------------------------------------------------


def test_patch_same_list_id_returns_200(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid, "Stay")
    r = client.patch(f"/cards/{card['id']}", json={"list_id": lid})
    assert r.status_code == 200


def test_patch_same_list_id_returns_unchanged_card(client):
    """EC3: response must be the identical card — list_id and position same."""
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid, "Stay")
    data = client.patch(f"/cards/{card['id']}", json={"list_id": lid}).json()
    assert data["list_id"] == card["list_id"]
    assert data["position"] == card["position"]
    assert data["title"] == card["title"]
    assert data["id"] == card["id"]


def test_patch_same_list_id_no_db_write(client, db):
    """EC3: DB must be untouched after a same-list PATCH (no position change)."""
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid, "Stable")
    original_pos = card["position"]

    client.patch(f"/cards/{card['id']}", json={"list_id": lid})

    fresh = _get_card(db, card["id"])
    assert fresh.position == original_pos
    assert fresh.list_id == lid
    assert fresh.title == "Stable"


def test_patch_same_list_id_with_title_is_noop(client, db):
    """EC3 strict: same list_id is a no-op even when title is also provided."""
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid, "Original")

    resp = client.patch(
        f"/cards/{card['id']}", json={"title": "Would Change", "list_id": lid}
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Original"  # title NOT changed

    fresh = _get_card(db, card["id"])
    assert fresh.title == "Original"


# ---------------------------------------------------------------------------
# PATCH — 422 when neither field is present (AC14)
# ---------------------------------------------------------------------------


def test_patch_empty_body_returns_422(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid)
    r = client.patch(f"/cards/{card['id']}", json={})
    assert r.status_code == 422


def test_patch_explicit_nulls_returns_422(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid)
    r = client.patch(f"/cards/{card['id']}", json={"title": None, "list_id": None})
    assert r.status_code == 422


def test_patch_404_on_missing_card(client):
    r = client.patch("/cards/99999", json={"title": "Ghost"})
    assert r.status_code == 404


def test_patch_404_detail_contains_card_id(client):
    r = client.patch("/cards/99999", json={"title": "Ghost"})
    assert "99999" in r.json()["detail"]


# ---------------------------------------------------------------------------
# DELETE /cards/{id} — AC11, AC13, AC15
# ---------------------------------------------------------------------------


def test_delete_card_returns_204(client):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid)
    r = client.delete(f"/cards/{card['id']}")
    assert r.status_code == 204


def test_delete_card_removes_from_db(client, db):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid)
    client.delete(f"/cards/{card['id']}")
    assert _get_card(db, card["id"]) is None


def test_delete_card_404_on_missing(client):
    r = client.delete("/cards/99999")
    assert r.status_code == 404


def test_delete_card_404_detail_contains_id(client):
    r = client.delete("/cards/99999")
    assert "99999" in r.json()["detail"]


def test_delete_card_does_not_delete_siblings(client, db):
    """Deleting one card must not remove other cards in the same list."""
    bid = _make_board(client)
    lid = _make_list(client, bid)
    a = _make_card(client, lid, "A")
    b = _make_card(client, lid, "B")
    c = _make_card(client, lid, "C")
    client.delete(f"/cards/{b['id']}")
    db.expire_all()
    assert db.get(models.Card, a["id"]) is not None
    assert db.get(models.Card, c["id"]) is not None


def test_delete_card_does_not_delete_list_or_board(client, db):
    bid = _make_board(client)
    lid = _make_list(client, bid)
    card = _make_card(client, lid)
    client.delete(f"/cards/{card['id']}")
    db.expire_all()
    assert db.get(models.List, lid) is not None
    assert db.get(models.Board, bid) is not None


# ---------------------------------------------------------------------------
# Input validation — AC14, EC5, EC7, EC9
# ---------------------------------------------------------------------------


class TestCardCreateValidation:
    """POST /lists/{id}/cards — every invalid title must return 422."""

    def _lid(self, client):
        bid = _make_board(client)
        return _make_list(client, bid)

    def test_empty_title(self, client):
        lid = self._lid(client)
        assert client.post(f"/lists/{lid}/cards", json={"title": ""}).status_code == 422

    def test_whitespace_only_title(self, client):
        lid = self._lid(client)
        assert client.post(f"/lists/{lid}/cards", json={"title": "   "}).status_code == 422

    def test_tab_only_title(self, client):
        lid = self._lid(client)
        assert client.post(f"/lists/{lid}/cards", json={"title": "\t"}).status_code == 422

    def test_newline_in_title(self, client):
        lid = self._lid(client)
        assert (
            client.post(f"/lists/{lid}/cards", json={"title": "line1\nline2"}).status_code
            == 422
        )

    def test_carriage_return_in_title(self, client):
        lid = self._lid(client)
        assert (
            client.post(f"/lists/{lid}/cards", json={"title": "line1\rline2"}).status_code
            == 422
        )

    def test_title_exactly_255_chars_is_valid(self, client):
        lid = self._lid(client)
        assert (
            client.post(f"/lists/{lid}/cards", json={"title": "x" * 255}).status_code
            == 201
        )

    def test_title_256_chars_rejected(self, client):
        lid = self._lid(client)
        assert (
            client.post(f"/lists/{lid}/cards", json={"title": "x" * 256}).status_code
            == 422
        )

    def test_missing_title_field(self, client):
        lid = self._lid(client)
        assert client.post(f"/lists/{lid}/cards", json={}).status_code == 422

    def test_null_title_rejected(self, client):
        lid = self._lid(client)
        assert (
            client.post(f"/lists/{lid}/cards", json={"title": None}).status_code == 422
        )


class TestCardPatchTitleValidation:
    """PATCH /cards/{id} title field — invalid titles must return 422."""

    def _card(self, client):
        bid = _make_board(client)
        lid = _make_list(client, bid)
        return _make_card(client, lid)

    def test_empty_title(self, client):
        card = self._card(client)
        assert client.patch(f"/cards/{card['id']}", json={"title": ""}).status_code == 422

    def test_whitespace_only_title(self, client):
        card = self._card(client)
        assert (
            client.patch(f"/cards/{card['id']}", json={"title": "  "}).status_code == 422
        )

    def test_newline_in_title(self, client):
        card = self._card(client)
        assert (
            client.patch(
                f"/cards/{card['id']}", json={"title": "bad\ntitle"}
            ).status_code
            == 422
        )

    def test_title_256_chars_rejected(self, client):
        card = self._card(client)
        assert (
            client.patch(
                f"/cards/{card['id']}", json={"title": "x" * 256}
            ).status_code
            == 422
        )

    def test_title_255_chars_valid(self, client):
        card = self._card(client)
        assert (
            client.patch(
                f"/cards/{card['id']}", json={"title": "x" * 255}
            ).status_code
            == 200
        )
