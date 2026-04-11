from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status
from sqlmodel import Session

from app.db.session import get_session
from app.models.preset import PresetCreate, PresetListResponse, PresetRead, PresetUpdate
from app.crud.preset_crud import (
    create_preset,
    delete_preset,
    get_preset,
    list_presets,
    toggle_preset,
    update_preset,
)

router = APIRouter()


# ── GET /  ── 列表（分页 + 按名搜索）────────────────────────────────────────────
@router.get("/", response_model=PresetListResponse)
def read_presets(
    session: Annotated[Session, Depends(get_session)],
    skip: int = Query(default=0, ge=0, description="跳过条数"),
    limit: int = Query(default=50, ge=1, le=200, description="每页条数"),
    name: str | None = Query(default=None, description="按名称模糊搜索"),
):
    items, total = list_presets(session, skip=skip, limit=limit, name=name)
    return PresetListResponse(items=items, total=total)  # type: ignore[arg-type]


# ── POST /  ── 创建 ───────────────────────────────────────────────────────────
@router.post("/", response_model=PresetRead, status_code=status.HTTP_201_CREATED)
def create_new_preset(
    data: Annotated[PresetCreate, Body(description="新预设内容")],
    session: Annotated[Session, Depends(get_session)],
):
    return create_preset(session, data)


# ── PUT /{id}  ── 更新 ────────────────────────────────────────────────────────
@router.put("/{preset_id}", response_model=PresetRead)
def update_existing_preset(
    preset_id: Annotated[int, Path(description="预设 ID")],
    patch: Annotated[PresetUpdate, Body(description="要更新的字段")],
    session: Annotated[Session, Depends(get_session)],
):
    db_obj = get_preset(session, preset_id)
    if db_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="预设不存在")
    return update_preset(session, db_obj, patch)


# ── DELETE /{id}  ── 删除 ─────────────────────────────────────────────────────
@router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_preset(
    preset_id: Annotated[int, Path(description="预设 ID")],
    session: Annotated[Session, Depends(get_session)],
):
    ok = delete_preset(session, preset_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="预设不存在")


# ── PATCH /{id}/toggle  ── 切换启用状态 ──────────────────────────────────────
@router.patch("/{preset_id}/toggle", response_model=PresetRead)
def toggle_existing_preset(
    preset_id: Annotated[int, Path(description="预设 ID")],
    session: Annotated[Session, Depends(get_session)],
):
    result = toggle_preset(session, preset_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="预设不存在")
    return result
