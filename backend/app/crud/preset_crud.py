from __future__ import annotations

from datetime import datetime

from sqlmodel import Session, select, func

from app.models.preset import Preset, PresetCreate, PresetUpdate


def list_presets(
    session: Session,
    skip: int = 0,
    limit: int = 50,
    name: str | None = None,
) -> tuple[list[Preset], int]:
    stmt = select(Preset)
    count_stmt = select(func.count()).select_from(Preset)

    if name:
        stmt = stmt.where(Preset.name.contains(name))          # type: ignore[attr-defined]
        count_stmt = count_stmt.where(Preset.name.contains(name))  # type: ignore[attr-defined]

    total = session.exec(count_stmt).one()
    items = list(
        session.exec(
            stmt.offset(skip).limit(limit).order_by(Preset.created_at.desc())  # type: ignore[attr-defined]
        ).all()
    )
    return items, total


def get_preset(session: Session, preset_id: int) -> Preset | None:
    return session.get(Preset, preset_id)


def create_preset(session: Session, data: PresetCreate) -> Preset:
    db_obj = Preset.model_validate(data)
    # 若新建时直接启用，先把其他全禁用
    if db_obj.is_enabled:
        _disable_all(session)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_preset(session: Session, db_obj: Preset, patch: PresetUpdate) -> Preset:
    data = patch.model_dump(exclude_unset=True)
    # 若要启用此预设，先把其他全禁用
    if data.get("is_enabled"):
        _disable_all(session)
    for k, v in data.items():
        setattr(db_obj, k, v)
    db_obj.updated_at = datetime.utcnow()
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def toggle_preset(session: Session, preset_id: int) -> Preset | None:
    """
    切换启用状态：
    - 当前禁用 → 启用（同时禁用其他所有）
    - 当前启用 → 禁用
    """
    db_obj = get_preset(session, preset_id)
    if db_obj is None:
        return None

    if db_obj.is_enabled:
        db_obj.is_enabled = False
    else:
        _disable_all(session)
        db_obj.is_enabled = True

    db_obj.updated_at = datetime.utcnow()
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_preset(session: Session, preset_id: int) -> bool:
    db_obj = get_preset(session, preset_id)
    if db_obj is None:
        return False
    session.delete(db_obj)
    session.commit()
    return True


def get_enabled_preset_new(session: Session) -> Preset | None:
    """获取当前启用的预设（preset 模块专用，避免与 memory_crud 同名函数冲突）"""
    stmt = select(Preset).where(Preset.is_enabled == True)  # noqa: E712
    return session.exec(stmt).first()


# ── 内部工具 ───────────────────────────────────────────────────────────────────

def _disable_all(session: Session) -> None:
    """将所有预设设为禁用（不单独 commit，由调用方统一提交）"""
    presets = list(session.exec(select(Preset)).all())
    for p in presets:
        if p.is_enabled:
            p.is_enabled = False
            p.updated_at = datetime.utcnow()
            session.add(p)
