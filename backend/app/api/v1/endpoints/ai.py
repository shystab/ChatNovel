"""
AI 辅助接口 - 提供写作辅助功能
"""
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status

from app.models.ai import AIWSRequest
from app.services.ai_service import AIService, get_ai_service
from app.services.ai_provider import AIProviderError
from app.core.config import settings
from app.db.session import get_session, engine
from app.crud.settings_crud import get_settings
from sqlmodel import Session

router = APIRouter()


def get_ai_service_with_db(session: Session = Depends(get_session)) -> AIService:
    return get_ai_service(session=session)


def check_api_key(session: Session | None = None) -> bool:
    """检查是否配置了 API Key"""
    provider = settings.AI_PROVIDER
    if session:
        db_settings = get_settings(session)
        if db_settings:
            provider = db_settings.ai_provider or provider
            if provider == "deepseek" and db_settings.deepseek_api_key_enc:
                return True
            if provider == "openai" and db_settings.openai_api_key_enc:
                return True
    if provider == "deepseek":
        return bool(settings.DEEPSEEK_API_KEY)
    elif provider == "openai":
        return bool(settings.OPENAI_API_KEY)
    return False


@router.get("/health")
def ai_health():
    provider = settings.AI_PROVIDER
    try:
        with Session(engine) as session:
            db_settings = get_settings(session)
            if db_settings and db_settings.ai_provider:
                provider = db_settings.ai_provider
    except Exception:
        pass
    if provider == "deepseek":
        configured = bool(settings.DEEPSEEK_API_KEY)
        model = settings.DEEPSEEK_MODEL
        base_url = settings.DEEPSEEK_BASE_URL
    else:
        configured = bool(settings.OPENAI_API_KEY)
        model = settings.OPENAI_MODEL
        base_url = settings.OPENAI_BASE_URL
    return {"provider": provider, "configured": configured, "model": model, "base_url": base_url}


# ──────────────────────────────────────────────
# WebSocket 统一接口（工具调用模式）
# ──────────────────────────────────────────────
@router.websocket("/ws")
async def ai_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        payload = await websocket.receive_json()
        req = AIWSRequest.model_validate(payload)

        with Session(engine) as session:
            if not check_api_key(session):
                provider_name = settings.AI_PROVIDER
                db_settings = get_settings(session)
                if db_settings and db_settings.ai_provider:
                    provider_name = db_settings.ai_provider
                await websocket.send_json({"type": "error", "message": f"请先配置 {provider_name.upper()}_API_KEY"})
                await websocket.close(code=1008)
                return

            ai_service = get_ai_service(session)

            # 调用统一流式入口（工具调用）
            stream = ai_service.stream_chat(
                messages=[{"role": m.role, "content": m.content} for m in req.messages],
                user_id=req.user_id,
                project_id=req.project_id,
                use_memory=req.use_memory,
                max_tokens=req.max_length,
                current_chapter_id=req.current_chapter_id,
                book_id=req.book_id,
                current_content=req.content or "",
                selected_doc_ids=req.selected_doc_ids,
            )

            buffer = ""
            since_last_analysis = 0
            for chunk in stream:
                buffer += chunk
                since_last_analysis += len(chunk)
                await websocket.send_json({"type": "token", "text": chunk})
                if req.analysis_enabled and since_last_analysis >= req.analysis_interval_chars:
                    analysis = ai_service.analyze_text_light(buffer, analysis_types=req.analysis_types)
                    await websocket.send_json({"type": "analysis", "data": analysis})
                    since_last_analysis = 0

            await websocket.send_json({"type": "done"})
            await websocket.close()
    except WebSocketDisconnect:
        return
    except AIProviderError as e:
        await websocket.send_json({"type": "error", "message": str(e)})
        await websocket.close(code=1011)
    except Exception as e:
        import traceback
        traceback.print_exc()
        await websocket.send_json({"type": "error", "message": f"server error: {e}"})
        await websocket.close(code=1011)
