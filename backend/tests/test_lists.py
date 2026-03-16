"""Tests for the lists endpoints.

Covers:
  - AC5  — create a list (POST /boards/{id}/lists → 201)
  - AC6  — lists returned ordered by position ASC; no reindex after delete
  - AC7  — delete a list (DELETE /lists/{id} → 204)
  - AC13 — all three list endpoints respond with correct HTTP codes
  - AC14 — input validation: empty, whitespace-only, >255 chars, newlines → 422
  - AC15 — 404 for non-existent board ID and list ID
  - EC2  — cascade delete removes all cards belonging to the deleted list
  - EC6  — deleting the only list on a board leaves the board intact
"""

import models


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _create_board(client, name: str = "Test Board") -> int:
    resp = client.post("/boards", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_list(client, board_id: int, name: str = "Test List") -> dict:
    resp = client.post(f"/boards/{board_id}/lists", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# POST /boards/{id}/lists — AC5, AC13
# ---------------------------------------------------------------------------


def test_create_list_returns_201(client):
    board_id = _create_board(client)
    resp = client.post(f"/boards/{board_id}/lists", json={"name": "Backlog"})
    assert resp.status_code == 201


def test_create_list_response_schema(client):
    board_id = _create_board(client)
    resp = client.post(f"/boards/{board_id}/lists", json={"name": "Backlog"})
    data = resp.json()
    assert isinstance(data["id"], int)
    assert data["board_id"] == board_id
    assert data["name"] == "Backlog"
    assert isinstance(data["position"], int)
    assert "created_at" in data


def test_create_first_list_has_position_zero(client):
    board_id = _create_board(client)
    lst = _create_list(client, board_id, "First")
    assert lst["position"] == 0


def test_create_second_list_has_position_one(client):
    board_id = _create_board(client)
    _create_list(client, board_id, "First")
    second = _create_list(client, board_id, "Second")
    assert second["position"] == 1


def test_create_third_list_has_position_two(client):
    board_id = _create_board(client)
    for name in ("A", "B"):
        _create_list(client, board_id, name)
    third = _create_list(client, board_id, "C")
    assert third["position"] == 2


def test_create_list_preserves_utf8_name(client):
    board_id = _create_board(client)
    name = "進捗中 🔥"
    lst = _create_list(client, board_id, name)
    assert lst["name"] == name


def test_create_list_404_on_missing_board(client):
    resp = client.post("/boards/99999/lists", json={"name": "Ghost List"})
    assert resp.status_code == 404


def test_create_list_404_detail_contains_board_id(client):
    resp = client.post("/boards/99999/lists", json={"name": "Ghost List"})
    assert "99999" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# GET /boards/{id}/lists — AC6, AC13
# ---------------------------------------------------------------------------


def test_get_lists_returns_200(client):
    board_id = _create_board(client)
    resp = client.get(f"/boards/{board_id}/lists")
    assert resp.status_code == 200


def test_get_lists_empty_when_no_lists(client):
    board_id = _create_board(client)
    assert client.get(f"/boards/{board_id}/lists").json() == []


def test_get_lists_returns_all(client):
    board_id = _create_board(client)
    _create_list(client, board_id, "Todo")
    _create_list(client, board_id, "Doing")
    lists = client.get(f"/boards/{board_id}/lists").json()
    names = [l["name"] for l in lists]
    assert "Todo" in names
    assert "Doing" in names


def test_get_lists_ordered_by_position_asc(client):
    """Lists must come back in creation (position) order (AC6)."""
    board_id = _create_board(client)
    for name in ("Alpha", "Beta", "Gamma"):
        _create_list(client, board_id, name)
    lists = client.get(f"/boards/{board_id}/lists").json()
    assert [l["name"] for l in lists] == ["Alpha", "Beta", "Gamma"]
    assert [l["position"] for l in lists] == [0, 1, 2]


def test_get_lists_position_not_reindexed_after_delete(client, db):
    """Deleting a list must NOT reindex the positions of remaining lists (AC6)."""
    board_id = _create_board(client)
    a = _create_list(client, board_id, "A")  # position 0
    b = _create_list(client, board_id, "B")  # position 1
    c = _create_list(client, board_id, "C")  # position 2

    # Delete the middle list
    resp = client.delete(f"/lists/{b['id']}")
    assert resp.status_code == 204

    remaining = client.get(f"/boards/{board_id}/lists").json()
    by_name = {l["name"]: l["position"] for l in remaining}

    assert "A" in by_name and by_name["A"] == 0, "A must keep position 0"
    assert "C" in by_name and by_name["C"] == 2, "C must keep position 2 (no reindex)"
    assert "B" not in by_name, "B must be gone"


def test_get_lists_404_on_missing_board(client):
    resp = client.get("/boards/99999/lists")
    assert resp.status_code == 404


def test_get_lists_isolates_boards(client):
    """Lists for board A must not appear in board B's response."""
    board_a = _create_board(client, "Board A")
    board_b = _create_board(client, "Board B")
    _create_list(client, board_a, "Only in A")
    lists_b = client.get(f"/boards/{board_b}/lists").json()
    assert all(l["name"] != "Only in A" for l in lists_b)


# ---------------------------------------------------------------------------
# DELETE /lists/{id} — AC7, AC13, AC15
# ---------------------------------------------------------------------------


def test_delete_list_returns_204(client):
    board_id = _create_board(client)
    lst = _create_list(client, board_id)
    resp = client.delete(f"/lists/{lst['id']}")
    assert resp.status_code == 204


def test_delete_list_removes_from_get(client):
    board_id = _create_board(client)
    lst = _create_list(client, board_id, "Temp")
    client.delete(f"/lists/{lst['id']}")
    lists = client.get(f"/boards/{board_id}/lists").json()
    assert all(l["id"] != lst["id"] for l in lists)


def test_delete_list_404_on_missing(client):
    resp = client.delete("/lists/99999")
    assert resp.status_code == 404


def test_delete_list_404_detail_contains_id(client):
    resp = client.delete("/lists/99999")
    assert "99999" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Cascade — EC2: deleting a list removes all its cards
# ---------------------------------------------------------------------------


def test_delete_list_cascades_cards(client, db):
    """DELETE /lists/{id} must atomically remove all child cards (EC2)."""
    board_id = _create_board(client)
    lst = _create_list(client, board_id, "With Cards")
    list_id = lst["id"]

    # Add cards directly via the DB (cards API comes in Task 4)
    card_ids = []
    for i in range(3):
        card = models.Card(list_id=list_id, title=f"Card {i}", position=i)
        db.add(card)
        db.flush()
        card_ids.append(card.id)
    db.commit()

    resp = client.delete(f"/lists/{list_id}")
    assert resp.status_code == 204

    db.expire_all()
    for cid in card_ids:
        assert db.get(models.Card, cid) is None, f"Card {cid} must be deleted with list"


def test_delete_list_with_no_cards_succeeds(client):
    """Deleting an empty list must succeed (no cards to cascade)."""
    board_id = _create_board(client)
    lst = _create_list(client, board_id, "Empty List")
    assert client.delete(f"/lists/{lst['id']}").status_code == 204


# ---------------------------------------------------------------------------
# EC6 — deleting the only list leaves the board intact
# ---------------------------------------------------------------------------


def test_delete_only_list_board_remains(client):
    """After deleting the sole list, the board must still exist (EC6)."""
    board_id = _create_board(client, "Lonely Board")
    lst = _create_list(client, board_id, "The Only List")

    client.delete(f"/lists/{lst['id']}")

    # Board must still be retrievable
    assert client.get(f"/boards/{board_id}").status_code == 200


def test_delete_only_list_get_lists_returns_empty(client):
    """After deleting the sole list, GET lists must return [] not 404 (EC6)."""
    board_id = _create_board(client, "Lonely Board 2")
    lst = _create_list(client, board_id, "Last List")

    client.delete(f"/lists/{lst['id']}")

    resp = client.get(f"/boards/{board_id}/lists")
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# Input validation — AC14, EC5, EC7, EC9
# ---------------------------------------------------------------------------


class TestListCreateValidation:
    """POST /boards/{id}/lists — every invalid name must return 422."""

    def test_empty_name(self, client):
        board_id = _create_board(client)
        assert (
            client.post(f"/boards/{board_id}/lists", json={"name": ""}).status_code
            == 422
        )

    def test_whitespace_only_name(self, client):
        board_id = _create_board(client)
        assert (
            client.post(f"/boards/{board_id}/lists", json={"name": "   "}).status_code
            == 422
        )

    def test_tab_only_name(self, client):
        board_id = _create_board(client)
        assert (
            client.post(f"/boards/{board_id}/lists", json={"name": "\t"}).status_code
            == 422
        )

    def test_newline_in_name(self, client):
        board_id = _create_board(client)
        assert (
            client.post(
                f"/boards/{board_id}/lists", json={"name": "line1\nline2"}
            ).status_code
            == 422
        )

    def test_carriage_return_in_name(self, client):
        board_id = _create_board(client)
        assert (
            client.post(
                f"/boards/{board_id}/lists", json={"name": "line1\rline2"}
            ).status_code
            == 422
        )

    def test_name_exactly_255_chars_is_valid(self, client):
        board_id = _create_board(client)
        resp = client.post(f"/boards/{board_id}/lists", json={"name": "x" * 255})
        assert resp.status_code == 201

    def test_name_256_chars_rejected(self, client):
        board_id = _create_board(client)
        assert (
            client.post(
                f"/boards/{board_id}/lists", json={"name": "x" * 256}
            ).status_code
            == 422
        )

    def test_missing_name_field(self, client):
        board_id = _create_board(client)
        assert client.post(f"/boards/{board_id}/lists", json={}).status_code == 422

    def test_null_name_rejected(self, client):
        board_id = _create_board(client)
        assert (
            client.post(f"/boards/{board_id}/lists", json={"name": None}).status_code
            == 422
        )


# ---------------------------------------------------------------------------
# GET /lists/{id}/cards — spec gap fix: allows frontend to fetch cards per list
# ---------------------------------------------------------------------------


def _create_card(client, list_id: int, title: str = "Test Card") -> dict:
    resp = client.post(f"/lists/{list_id}/cards", json={"title": title})
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_get_cards_returns_200(client):
    board_id = _create_board(client)
    lst = _create_list(client, board_id)
    resp = client.get(f"/lists/{lst['id']}/cards")
    assert resp.status_code == 200


def test_get_cards_empty_when_no_cards(client):
    board_id = _create_board(client)
    lst = _create_list(client, board_id)
    assert client.get(f"/lists/{lst['id']}/cards").json() == []


def test_get_cards_returns_created_cards(client):
    board_id = _create_board(client)
    lst = _create_list(client, board_id)
    _create_card(client, lst["id"], "Alpha")
    _create_card(client, lst["id"], "Beta")
    cards = client.get(f"/lists/{lst['id']}/cards").json()
    titles = [c["title"] for c in cards]
    assert "Alpha" in titles
    assert "Beta" in titles


def test_get_cards_ordered_by_position_asc(client):
    """Cards must be returned in creation (position ASC) order (AC9)."""
    board_id = _create_board(client)
    lst = _create_list(client, board_id)
    for title in ("First", "Second", "Third"):
        _create_card(client, lst["id"], title)
    cards = client.get(f"/lists/{lst['id']}/cards").json()
    assert [c["title"] for c in cards] == ["First", "Second", "Third"]
    assert [c["position"] for c in cards] == [0, 1, 2]


def test_get_cards_response_schema(client):
    board_id = _create_board(client)
    lst = _create_list(client, board_id)
    _create_card(client, lst["id"], "My Card")
    card = client.get(f"/lists/{lst['id']}/cards").json()[0]
    assert isinstance(card["id"], int)
    assert card["list_id"] == lst["id"]
    assert card["title"] == "My Card"
    assert isinstance(card["position"], int)
    assert "created_at" in card


def test_get_cards_isolates_lists(client):
    """Cards for list A must not appear in list B's response."""
    board_id = _create_board(client)
    list_a = _create_list(client, board_id, "A")
    list_b = _create_list(client, board_id, "B")
    _create_card(client, list_a["id"], "Only in A")
    cards_b = client.get(f"/lists/{list_b['id']}/cards").json()
    assert all(c["title"] != "Only in A" for c in cards_b)


def test_get_cards_404_on_missing_list(client):
    resp = client.get("/lists/99999/cards")
    assert resp.status_code == 404


def test_get_cards_404_detail_contains_list_id(client):
    resp = client.get("/lists/99999/cards")
    assert "99999" in resp.json()["detail"]


def test_get_cards_position_not_reindexed_after_delete(client):
    """Deleting a card must not reindex siblings (AC9)."""
    board_id = _create_board(client)
    lst = _create_list(client, board_id)
    a = _create_card(client, lst["id"], "A")  # position 0
    b = _create_card(client, lst["id"], "B")  # position 1
    c = _create_card(client, lst["id"], "C")  # position 2
    client.delete(f"/cards/{b['id']}")
    cards = client.get(f"/lists/{lst['id']}/cards").json()
    by_title = {c["title"]: c["position"] for c in cards}
    assert by_title["A"] == 0
    assert by_title["C"] == 2  # position not reindexed
