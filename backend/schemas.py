"""Pydantic request/response schemas for Board, List, and Card."""

from datetime import date, datetime
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Shared validation helpers
# ---------------------------------------------------------------------------

_NAME_FIELD = Annotated[str, Field(min_length=1, max_length=255)]


def _reject_whitespace_and_newlines(v: str) -> str:
    """Strip and reject blank strings; reject strings containing newlines."""
    if "\n" in v or "\r" in v:
        raise ValueError("Title must not contain newline characters.")
    if not v.strip():
        raise ValueError("Title must not be blank or whitespace only.")
    return v


# ---------------------------------------------------------------------------
# Board schemas
# ---------------------------------------------------------------------------

class BoardCreate(BaseModel):
    name: _NAME_FIELD

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _reject_whitespace_and_newlines(v)


class BoardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime


# ---------------------------------------------------------------------------
# List schemas
# ---------------------------------------------------------------------------

class ListCreate(BaseModel):
    name: _NAME_FIELD

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _reject_whitespace_and_newlines(v)


class ListPatch(BaseModel):
    """PATCH /lists/{id} — at least one field required (enforced in router).

    deadline sentinel: use model_fields_set to distinguish
      - not provided  → leave deadline unchanged
      - null          → clear the deadline
      - "YYYY-MM-DD"  → set the deadline
    """

    name: Optional[_NAME_FIELD] = None
    deadline: Optional[date] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _reject_whitespace_and_newlines(v)


class ListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    board_id: int
    name: str
    position: int
    deadline: Optional[date] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Card schemas
# ---------------------------------------------------------------------------

class CardCreate(BaseModel):
    title: _NAME_FIELD
    description: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        return _reject_whitespace_and_newlines(v)

    @model_validator(mode="after")
    def validate_date_order(self) -> "CardCreate":
        if self.start_date is not None and self.due_date is not None:
            if self.start_date > self.due_date:
                raise ValueError(
                    "start_date must be before or equal to due_date"
                )
        return self


class CardPatch(BaseModel):
    """PATCH /cards/{id} — at least one field required (enforced in router).

    Sentinel pattern for nullable fields — use model_fields_set to distinguish:
      - not provided  → leave field unchanged
      - null          → clear the field (set to NULL)
      - value         → update the field
    """

    title: Optional[_NAME_FIELD] = None
    list_id: Optional[int] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _reject_whitespace_and_newlines(v)

    @model_validator(mode="after")
    def validate_date_order(self) -> "CardPatch":
        if self.start_date is not None and self.due_date is not None:
            if self.start_date > self.due_date:
                raise ValueError(
                    "start_date must be before or equal to due_date"
                )
        return self


class CardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    list_id: int
    title: str
    position: int
    description: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    created_at: datetime
