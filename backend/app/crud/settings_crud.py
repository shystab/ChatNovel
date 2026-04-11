"""
设置 CRUD 操作 - 数据库增删改查
"""
from sqlmodel import Session, select
from app.models.setting import Setting, SettingUpdate
from app.core.security import encrypt_api_key


def get_settings(session: Session) -> Setting | None:
    """
    获取设置
    
    说明：
        - 由于是全局设置，只需要查询第一条记录
        - 如果没有记录，返回 None
    
    返回：
        - Setting 对象：如果存在
        - None：如果不存在
    """
    # 查询数据库中的第一条设置记录
    statement = select(Setting)
    return session.exec(statement).first()


def update_settings(session: Session, settings_data: SettingUpdate) -> Setting:
    """
    更新设置
    
    说明：
        - 如果存在则更新，不存在则创建
        - 使用 PATCH 逻辑：只更新传入的字段
    
    参数：
        - session: 数据库会话
        - settings_data: 要更新的设置数据（可以是部分字段）
    
    返回：
        - 更新后的 Setting 对象
    """
    # 查询当前设置
    db_settings = get_settings(session)
    
    # 处理 API Key 加密
    update_data = settings_data.model_dump(exclude_unset=True)
    
    if "deepseek_api_key" in update_data:
        val = update_data.pop("deepseek_api_key")
        if val:
            update_data["deepseek_api_key_enc"] = encrypt_api_key(val)
        else:
            update_data["deepseek_api_key_enc"] = None

    if "openai_api_key" in update_data:
        val = update_data.pop("openai_api_key")
        if val:
            update_data["openai_api_key_enc"] = encrypt_api_key(val)
        else:
            update_data["openai_api_key_enc"] = None

    if db_settings:
        # 存在则更新（只更新传入的字段）
        # 遍历要更新的字段
        for field, value in update_data.items():
            # 使用 setattr 动态设置属性
            setattr(db_settings, field, value)
        
        # 提交到数据库
        session.add(db_settings)
        session.commit()
        # 刷新以获取最新数据
        session.refresh(db_settings)
    else:
        # 不存在则创建新记录
        db_settings = Setting(
            theme=update_data.get("theme", "light"),
            font_size=update_data.get("font_size", 16),
            auto_save_interval=update_data.get("auto_save_interval", 30),
            language=update_data.get("language", "zh-CN"),
            editor_mode=update_data.get("editor_mode", "write"),
            ai_provider=update_data.get("ai_provider", "deepseek"),
            temperature=update_data.get("temperature", 0.7),
            max_tokens=update_data.get("max_tokens", 2000),
            deepseek_api_key_enc=update_data.get("deepseek_api_key_enc"),
            openai_api_key_enc=update_data.get("openai_api_key_enc"),
        )
        session.add(db_settings)
        session.commit()
        session.refresh(db_settings)
    
    return db_settings
