"""Tests for the /boards endpoints.

Covers:
  - AC1  — create a board (POST /boards → 201)
  - AC2  — list all boards ordered by created_at ASC (GET /boards)
  - AC3  — delete a board (DELETE /boards/{id} → 204)
  - AC4  — get single board (GET /boards/{id})
  - AC13 — all four board endpoints respond with correct HTTP codes
  - AC14 — input validation: empty, whitespace-only, >255 chars, newlines → 422
  - AC15 — 404 for non-existent board ID
  - EC1  — cascade delete removes all child lists and cards
  - CORS — Access-Control-Allow-Origin header present on /boards responses
"""

import models


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _create_board(client, name: str = "My Board") -> dict:
    resp = client.post("/boards", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# CORS (Sub-task 2a verification via TestClient)
# ---------------------------------------------------------------------------


def test_cors_header_on_list_boards(client):
    """GET /boards with Origin header must echo back Allow-Origin (SPEC §3)."""
    resp = client.get("/boards", headers={"Origin": "http://localhost:5173"})
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_header_on_post_board(client):
    """POST /boards must also carry the CORS header."""
    resp = client.post(
        "/boards",
        json={"name": "CORS Test"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_preflight(client):
    """OPTIONS preflight must return 200 with the Allow-Origin header."""
    resp = client.options(
        "/boards",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"


# ---------------------------------------------------------------------------
# POST /boards — AC1, AC13
# ---------------------------------------------------------------------------


def test_create_board_returns_201(client):
    resp = client.post("/boards", json={"name": "Sprint 1"})
    assert resp.status_code == 201


def test_create_board_response_schema(client):
    resp = client.post("/boards", json={"name": "Sprint 1"})
    data = resp.json()
    assert isinstance(data["id"], int)
    assert data["name"] == "Sprint 1"
    assert "created_at" in data


def test_create_board_id_is_auto_increment(client):
    id1 = _create_board(client, "Board A")["id"]
    id2 = _create_board(client, "Board B")["id"]
    assert id2 > id1


def test_create_board_preserves_utf8_name(client):
    name = "バックログ 🚀"
    data = _create_board(client, name)
    assert data["name"] == name


# ---------------------------------------------------------------------------
# GET /boards — AC2, AC13
# ---------------------------------------------------------------------------


def test_list_boards_empty(client):
    resp = client.get("/boards")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_boards_returns_all(client):
    _create_board(client, "Alpha")
    _create_board(client, "Beta")
    boards = client.get("/boards").json()
    names = [b["name"] for b in boards]
    assert "Alpha" in names
    assert "Beta" in names


def test_list_boards_ordered_by_created_at_asc(client):
    """Boards must come back oldest-first (AC2)."""
    _create_board(client, "First")
    _create_board(client, "Second")
    _create_board(client, "Third")
    boards = client.get("/boards").json()
    names = [b["name"] for b in boards]
    assert names == ["First", "Second", "Third"]


# ---------------------------------------------------------------------------
# GET /boards/{id} — AC4, AC13, AC15
# ---------------------------------------------------------------------------


def test_get_board_returns_200(client):
    board_id = _create_board(client)["id"]
    resp = client.get(f"/boards/{board_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == board_id


def test_get_board_returns_correct_name(client):
    board_id = _create_board(client, "Detail Board")["id"]
    data = client.get(f"/boards/{board_id}").json()
    assert data["name"] == "Detail Board"


def test_get_board_404_on_missing(client):
    resp = client.get("/boards/99999")
    assert resp.status_code == 404


def test_get_board_404_detail_message(client):
    resp = client.get("/boards/99999")
    assert "99999" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# DELETE /boards/{id} — AC3, AC13, AC15
# ---------------------------------------------------------------------------


def test_delete_board_returns_204(client):
    board_id = _create_board(client)["id"]
    resp = client.delete(f"/boards/{board_id}")
    assert resp.status_code == 204


def test_delete_board_removes_from_list(client):
    board_id = _create_board(client, "Gone")["id"]
    client.delete(f"/boards/{board_id}")
    boards = client.get("/boards").json()
    assert all(b["id"] != board_id for b in boards)


def test_delete_board_404_on_missing(client):
    resp = client.delete("/boards/99999")
    assert resp.status_code == 404


def test_delete_board_then_get_returns_404(client):
    board_id = _create_board(client)["id"]
    client.delete(f"/boards/{board_id}")
    assert client.get(f"/boards/{board_id}").status_code == 404


# ---------------------------------------------------------------------------
# CASCADE DELETE — EC1: board delete removes all child lists and cards
# ---------------------------------------------------------------------------


def test_delete_board_cascades_lists_and_cards(client, db):
    """Deleting a board must remove every child list and card (EC1)."""
    board_id = _create_board(client, "Cascade Board")["id"]

    # Create two lists with one card each directly in the DB
    lst1 = models.List(board_id=board_id, name="List 1", position=0)
    lst2 = models.List(board_id=board_id, name="List 2", position=1)
    db.add_all([lst1, lst2])
    db.flush()

    card1 = models.Card(list_id=lst1.id, title="Card A", position=0)
    card2 = models.Card(list_id=lst2.id, title="Card B", position=0)
    db.add_all([card1, card2])
    db.commit()

    lst1_id, lst2_id = lst1.id, lst2.id
    card1_id, card2_id = card1.id, card2.id

    # Delete the board
    resp = client.delete(f"/boards/{board_id}")
    assert resp.status_code == 204

    # Verify all children are gone
    db.expire_all()
    assert db.get(models.List, lst1_id) is None, "List 1 must be deleted"
    assert db.get(models.List, lst2_id) is None, "List 2 must be deleted"
    assert db.get(models.Card, card1_id) is None, "Card A must be deleted"
    assert db.get(models.Card, card2_id) is None, "Card B must be deleted"


def test_delete_board_with_no_lists_succeeds(client):
    """Deleting a board that has no children must still succeed."""
    board_id = _create_board(client, "Empty Board")["id"]
    assert client.delete(f"/boards/{board_id}").status_code == 204


# ---------------------------------------------------------------------------
# Input validation — AC14, EC5, EC7, EC9
# ---------------------------------------------------------------------------


class TestBoardCreateValidation:
    """POST /boards — every invalid input must return 422."""

    def test_empty_name(self, client):
        assert client.post("/boards", json={"name": ""}).status_code == 422

    def test_whitespace_only_name(self, client):
        assert client.post("/boards", json={"name": "   "}).status_code == 422

    def test_tab_only_name(self, client):
        assert client.post("/boards", json={"name": "\t"}).status_code == 422

    def test_newline_in_name(self, client):
        assert client.post("/boards", json={"name": "line1\nline2"}).status_code == 422

    def test_carriage_return_in_name(self, client):
        assert client.post("/boards", json={"name": "line1\rline2"}).status_code == 422

    def test_name_exactly_255_chars_is_valid(self, client):
        resp = client.post("/boards", json={"name": "x" * 255})
        assert resp.status_code == 201

    def test_name_256_chars_rejected(self, client):
        assert client.post("/boards", json={"name": "x" * 256}).status_code == 422

    def test_missing_name_field(self, client):
        assert client.post("/boards", json={}).status_code == 422

    def test_null_name_rejected(self, client):
        assert client.post("/boards", json={"name": None}).status_code == 422
