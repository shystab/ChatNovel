"""
设置 API 接口 - HTTP 请求处理
"""
from fastapi import APIRouter, Body, Depends
from sqlmodel import Session
from typing import Annotated

from app.db.session import get_session  # 获取数据库会话的依赖
from app.models.setting import Setting, SettingUpdate, SettingResponse  # Pydantic 模型
from app.crud.settings_crud import get_settings, update_settings  # CRUD 函数


# 创建路由实例
# 路由的作用：将相关的接口组织在一起
router = APIRouter()


def _to_response(db_settings: Setting) -> SettingResponse:
    return SettingResponse(
        **db_settings.model_dump(),
        has_deepseek_key=bool(db_settings.deepseek_api_key_enc),
        has_openai_key=bool(db_settings.openai_api_key_enc)
    )


@router.get("/", response_model=SettingResponse)
def read_settings(
    session: Annotated[Session, Depends(get_session)]
):
    """
    GET /api/v1/settings - 获取设置
    
    说明：
        - 返回当前保存的设置
        - 如果没有设置，返回默认设置
    
    返回：
        - Setting 对象（包含所有设置字段）
    """
    # 调用 CRUD 函数获取设置
    settings = get_settings(session)
    
    # 如果没有设置，返回默认值
    if not settings:
        # 创建默认设置并保存到数据库
        settings = Setting(
            theme="light",
            font_size=16,
            auto_save_interval=30,
            language="zh-CN",
            editor_mode="write",
        )
        session.add(settings)
        session.commit()
        session.refresh(settings)
    
    return _to_response(settings)


@router.patch("/", response_model=SettingResponse)
def update_all_settings(
    settings: Annotated[SettingUpdate, Body(description="设置更新数据（仅传入需要修改的字段）")],
    session: Annotated[Session, Depends(get_session)]
):
    """
    PATCH /api/v1/settings - 更新设置
    
    说明：
        - 使用 PATCH 方法（部分更新）
        - 只更新传入的字段，未传入的字段保持不变
    
    请求体（示例）：
        {
            "theme": "dark"        # 只更新主题，其他不变
        }
    
    返回：
        - 更新后的 Setting 对象
    """
    # 调用 CRUD 函数更新设置
    updated = update_settings(session, settings)
    return _to_response(updated)
