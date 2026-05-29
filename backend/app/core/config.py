"""
配置管理 - 使用 Pydantic V2 语法
"""
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置类"""
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # 基础配置
    API_V1_STR: str = Field(default="/api/v1", description="API 版本路径")
    PROJECT_NAME: str = Field(default="Novel IDE Backend", description="项目名称")
    VERSION: str = Field(default="0.1.0", description="版本号")
    
    # 数据库配置
    DATABASE_URL: str = Field(default="sqlite:///./novel_ide.db", description="数据库连接 URL")
    SQL_ECHO: bool = Field(default=False, description="SQLAlchemy echo（打印 SQL）")
    NOVEL_WORKSPACE_DIR: str = Field(default="./workspace", description="小说作品文件夹根目录")
    
    # AI 配置
    AI_PROVIDER: str = Field(default="deepseek", description="AI 提供商")
    DEEPSEEK_API_KEY: str | None = Field(default=None, description="DeepSeek API Key")
    DEEPSEEK_BASE_URL: str = Field(default="https://api.deepseek.com", description="DeepSeek API base_url")
    DEEPSEEK_MODEL: str = Field(default="deepseek-chat", description="DeepSeek 模型")
    
    OPENAI_API_KEY: str | None = Field(default=None, description="OpenAI API Key")
    OPENAI_BASE_URL: str = Field(default="https://api.openai.com/v1", description="OpenAI API base_url")
    OPENAI_MODEL: str = Field(default="gpt-3.5-turbo", description="OpenAI 模型")
    
    # CORS 配置
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["*"], description="CORS 允许的源")


# 创建全局配置实例
settings = Settings()
