from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status
from sqlmodel import Session
from typing import Annotated

from app.db.session import get_session
from app.core.auth import CurrentUser, get_current_user
from app.models.memory import (
    PromptPresetCreate,
    PromptPresetRead,
    PromptPresetUpdate,
    MemorySummaryRead,
)
from app.crud import (
    list_presets,
    get_enabled_preset,
    get_preset_by_id,
    create_preset,
    update_preset,
    enable_preset,
    delete_preset,
    get_memory_summary,
    upsert_memory_summary,
)

router = APIRouter()

UID = "default_user"
PID = "default_project"


# ── 列出所有人格预设 ─────────────────────────────
@router.get("/presets", response_model=list[PromptPresetRead])
def read_all_presets(
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    user_id: str = UID,
    project_id: str = PID,
):
    return list_presets(session, user_id=current_user.username, project_id=project_id)


# ── 创建人格预设 ─────────────────────────────────
@router.post("/presets", response_model=PromptPresetRead, status_code=status.HTTP_201_CREATED)
def create_prompt_preset(
    preset: Annotated[PromptPresetCreate, Body(description="创建提示词预设")],
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    preset.user_id = current_user.username
    return create_preset(session, preset)


# ── 启用某个预设（单选，其余全禁用） ────────────────
@router.post("/presets/{preset_id}/enable", response_model=PromptPresetRead)
def enable_prompt_preset(
    preset_id: Annotated[int, Path(description="要启用的预设 ID")],
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    user_id: str = UID,
    project_id: str = PID,
):
    result = enable_preset(session, preset_id=preset_id, user_id=current_user.username, project_id=project_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="preset not found")
    return result


# ── 禁用所有预设（恢复默认人格） ────────────────────
@router.post("/presets/disable-all", status_code=status.HTTP_204_NO_CONTENT)
def disable_all(
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    user_id: str = UID,
    project_id: str = PID,
):
    from app.crud import disable_all_presets
    disable_all_presets(session, user_id=current_user.username, project_id=project_id)


# ── 更新某个预设内容 ─────────────────────────────
@router.patch("/presets/{preset_id}", response_model=PromptPresetRead)
def patch_preset(
    preset_id: Annotated[int, Path(description="预设 ID")],
    patch: Annotated[PromptPresetUpdate, Body(description="要更新的字段")],
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    db_obj = get_preset_by_id(session, preset_id)
    if db_obj is None or db_obj.user_id != current_user.username:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="preset not found")
    return update_preset(session, db_obj, patch)


# ── 删除某个预设 ─────────────────────────────────
@router.delete("/presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt_preset(
    preset_id: Annotated[int, Path(description="预设 ID")],
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    user_id: str = UID,
):
    ok = delete_preset(session, preset_id=preset_id, user_id=current_user.username)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="preset not found")


# ── 获取当前启用的预设 ───────────────────────────
@router.get("/preset", response_model=PromptPresetRead | None)
def read_enabled_preset(
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    user_id: str = UID,
    project_id: str = PID,
):
    return get_enabled_preset(session, user_id=current_user.username, project_id=project_id)


# ── 记忆摘要 ────────────────────────────────────
@router.get("/summary", response_model=MemorySummaryRead | None)
def read_memory_summary(
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    user_id: str = UID,
    project_id: str = PID,
):
    return get_memory_summary(session, user_id=current_user.username, project_id=project_id)


@router.put("/summary", response_model=MemorySummaryRead)
def write_memory_summary(
    summary: Annotated[str, Body(description="直接写入的摘要文本")],
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    user_id: str = UID,
    project_id: str = PID,
):
    return upsert_memory_summary(session, user_id=current_user.username, project_id=project_id, summary=summary)
