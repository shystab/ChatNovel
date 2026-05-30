"""
AI 提供商抽象层 - 支持多种 AI 服务商

支持的提供商：
- deepseek (Deep Seek)
- openai (OpenAI)
- anthropic (Claude) - 预留

使用方法：
    1. 在 .env 中设置 AI_PROVIDER=deepseek
    2. 设置对应的 API Key
"""
from abc import ABC, abstractmethod
from typing import Annotated
from openai import OpenAI
from sqlmodel import Session
from app.core.config import settings
from app.core.security import decrypt_api_key
from openai.types.chat import ChatCompletionMessageParam
import json

class AIProviderError(RuntimeError):
    """把第三方 SDK 异常统一成业务异常，便于在 API 层转换成 HTTP 错误。"""


class BaseAIProvider(ABC):
    """AI 提供商基类"""
    
    @abstractmethod
    def chat(self, messages:  list[ChatCompletionMessageParam], **kwargs) -> str:
        """发送聊天请求，返回内容"""
        pass

    @abstractmethod
    def stream_chat(self, messages: list[ChatCompletionMessageParam], **kwargs):
        """
        流式聊天：逐步产出文本片段（token/chunk）。

        返回一个可迭代对象（generator）。
        """
        raise NotImplementedError


class DeepSeekProvider(BaseAIProvider):
    """Deep Seek 提供商"""
    
    def __init__(self, api_key: str | None = None):
        # 优先级：传入的 key > 环境变量中的 key
        final_key = api_key or settings.DEEPSEEK_API_KEY
        if not final_key:
            raise AIProviderError("未配置 DEEPSEEK_API_KEY")
        
        self.client = OpenAI(
            api_key=final_key,
            base_url=settings.DEEPSEEK_BASE_URL
        )
        self.model = settings.DEEPSEEK_MODEL
    
    def chat(self, messages: list[ChatCompletionMessageParam], **kwargs) -> str:
        tools = kwargs.get("tools")
        tool_choice = kwargs.get("tool_choice", "auto")
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 1000),
                tools=tools,
                tool_choice=tool_choice,
            )
            # 如果返回 tool_calls，序列化为 JSON 字符串返回
            if response.choices[0].message.tool_calls:
                tool_calls = []
                for i, tc in enumerate(response.choices[0].message.tool_calls):
                    tc_dict = tc.model_dump()
                    # DeepSeek 可能不返回 id，需要生成
                    if "id" not in tc_dict or not tc_dict["id"]:
                        tc_dict["id"] = f"call_{i}_{hash(tc_dict['function']['name']) % 10000:04d}"
                    tool_calls.append(tc_dict)
                return json.dumps(tool_calls)
            return response.choices[0].message.content or ""
        except Exception as e:
            raise AIProviderError(f"DeepSeek 调用失败: {e}") from e

    def stream_chat(self, messages: list[ChatCompletionMessageParam], **kwargs):
        # 调试日志
        import logging
        logging.debug(f"{self.__class__.__name__}.stream_chat called")
        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 1000),
                stream=True,
            )
            logging.debug(f"{self.__class__.__name__}.stream_chat stream type: {type(stream)}")
            for event in stream:
                delta = event.choices[0].delta
                content = getattr(delta, "content", None)
                if content:
                    yield content
        except Exception as e:
            raise AIProviderError(f"DeepSeek 流式调用失败: {e}") from e


class OpenAIProvider(BaseAIProvider):
    """OpenAI 提供商"""
    
    def __init__(self, api_key: str | None = None):
        # 优先级：传入的 key > 环境变量中的 key
        final_key = api_key or settings.OPENAI_API_KEY
        if not final_key:
            raise AIProviderError("未配置 OPENAI_API_KEY")

        self.client = OpenAI(
            api_key=final_key,
            base_url=settings.OPENAI_BASE_URL or "https://api.openai.com/v1"
        )
        self.model = settings.OPENAI_MODEL or "gpt-3.5-turbo"
    
    def chat(self, messages: list[ChatCompletionMessageParam], **kwargs) -> str:
        tools = kwargs.get("tools")
        tool_choice = kwargs.get("tool_choice", "auto")
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 1000),
                tools=tools,
                tool_choice=tool_choice,
            )
            # 如果返回 tool_calls，序列化为 JSON 字符串返回
            if response.choices[0].message.tool_calls:
                tool_calls = []
                for i, tc in enumerate(response.choices[0].message.tool_calls):
                    tc_dict = tc.model_dump()
                    # 确保有 id 字段
                    if "id" not in tc_dict or not tc_dict["id"]:
                        tc_dict["id"] = f"call_{i}_{hash(tc_dict['function']['name']) % 10000:04d}"
                    tool_calls.append(tc_dict)
                return json.dumps(tool_calls)
            return response.choices[0].message.content or ""
        except Exception as e:
            raise AIProviderError(f"OpenAI 调用失败: {e}") from e

    def stream_chat(self, messages: list[ChatCompletionMessageParam], **kwargs):
        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,  # type: ignore
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 1000),
                stream=True,
            )
            for event in stream:
                delta = event.choices[0].delta
                content = getattr(delta, "content", None)
                if content:
                    yield content
        except Exception as e:
            raise AIProviderError(f"OpenAI 流式调用失败: {e}") from e


class AIProviderFactory:
    """AI 提供商工厂"""
    
    _providers = {
        "deepseek": DeepSeekProvider,
        "openai": OpenAIProvider,
    }
    
    @classmethod
    def get_provider(
        cls, 
        provider_name: str | None = None,
        api_key: str | None = None
    ) -> BaseAIProvider:
        """获取 AI 提供商实例"""
        if provider_name is None:
            provider_name = settings.AI_PROVIDER
        
        provider_class = cls._providers.get(provider_name)
        
        if provider_class is None:
            raise AIProviderError(f"不支持的 AI 提供商: {provider_name}")
        
        return provider_class(api_key=api_key)


def get_ai_provider(session: Session | None = None) -> BaseAIProvider:
    """获取当前配置的 AI 提供商"""
    from app.crud.settings_crud import get_settings
    
    api_key = None
    provider_name = settings.AI_PROVIDER

    if session:
        db_settings = get_settings(session)
        if db_settings:
            # 1. 优先使用数据库中的供应商设置
            provider_name = db_settings.ai_provider or settings.AI_PROVIDER
            
            # 2. 尝试从数据库读取加密的 Key
            if provider_name == "deepseek" and db_settings.deepseek_api_key_enc:
                api_key = decrypt_api_key(db_settings.deepseek_api_key_enc)
            elif provider_name == "openai" and db_settings.openai_api_key_enc:
                api_key = decrypt_api_key(db_settings.openai_api_key_enc)

    return AIProviderFactory.get_provider(provider_name, api_key=api_key)
