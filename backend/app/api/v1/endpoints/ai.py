"""
AI 辅助接口 - 提供写作辅助功能
"""
from fastapi import APIRouter, Body, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from typing import Annotated

from app.models.ai import AIWSRequest
from app.services.ai_service import AIService, get_ai_service
from app.services.ai_provider import AIProviderError
from app.core.config import settings
from app.db.session import get_session, engine
from app.crud.preset_crud import get_preset
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
# REST 接口（直接调用工具函数）
# ──────────────────────────────────────────────
@router.post("/suggest")
async def ai_suggest(
    content: str = Body(..., embed=True),
    max_length: int = Body(200, embed=True),
    current_chapter_id: int | None = Body(None, embed=True),
    book_id: int | None = Body(None, embed=True),
    user_id: str = Body("default_user", embed=True),
    project_id: str = Body("default_project", embed=True),
    use_memory: bool = Body(True, embed=True),
    session: Session = Depends(get_session),
):
    if not check_api_key(session):
        raise HTTPException(status_code=400, detail=f"请先配置 {settings.AI_PROVIDER.upper()}_API_KEY")
    ai_service = get_ai_service(session)
    # 调用续写工具函数（流式生成，但 REST 返回完整结果）
    gen = ai_service.continue_writing(
        content=content,
        max_length=max_length,
        current_chapter_id=current_chapter_id,
        book_id=book_id,
        user_id=user_id,
        project_id=project_id,
        use_memory=use_memory,
    )
    result = "".join(list(gen))
    return {"suggestion": result, "reason": "根据当前内容续写"}


@router.post("/rewrite")
async def ai_rewrite(
    text: str = Body(..., embed=True),
    style: str = Body("清晰流畅", embed=True),
    session: Session = Depends(get_session),
):
    if not check_api_key(session):
        raise HTTPException(status_code=400, detail=f"请先配置 {settings.AI_PROVIDER.upper()}_API_KEY")
    ai_service = get_ai_service(session)
    result = ai_service.rewrite_text(text, style)
    return {"rewritten": result, "reason": f"风格：{style}"}


@router.post("/check")
async def ai_check(
    text: str = Body(..., embed=True),
    session: Session = Depends(get_session),
):
    if not check_api_key(session):
        raise HTTPException(status_code=400, detail=f"请先配置 {settings.AI_PROVIDER.upper()}_API_KEY")
    ai_service = get_ai_service(session)
    result_str = ai_service.check_grammar(text)
    # 解析 JSON，若失败则返回原始字符串
    try:
        import json
        result = json.loads(result_str)
    except:
        result = {"issues": [], "suggestions": [result_str]}
    return result


@router.post("/plot")
async def ai_plot(
    description: str = Body(..., embed=True),
    session: Session = Depends(get_session),
):
    if not check_api_key(session):
        raise HTTPException(status_code=400, detail=f"请先配置 {settings.AI_PROVIDER.upper()}_API_KEY")
    ai_service = get_ai_service(session)
    result_str = ai_service.suggest_plot(description)
    try:
        import json
        result = json.loads(result_str)
    except:
        result = {"suggestions": [result_str]}
    return result


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