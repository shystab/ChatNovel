from __future__ import annotations

from fastapi import Request, WebSocket, status
from fastapi.responses import JSONResponse

from app.core.config import settings


TOKEN_QUERY_NAME = "access_token"
TOKEN_HEADER_NAME = "x-app-token"


def _configured_token() -> str:
    return (settings.APP_ACCESS_TOKEN or "").strip()


def access_token_required() -> bool:
    return bool(_configured_token())


def _token_matches(token: str | None) -> bool:
    configured = _configured_token()
    return not configured or token == configured


def _extract_http_token(request: Request) -> str | None:
    header_token = request.headers.get(TOKEN_HEADER_NAME)
    if header_token:
        return header_token.strip()

    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()

    query_token = request.query_params.get(TOKEN_QUERY_NAME)
    return query_token.strip() if query_token else None


async def access_token_middleware(request: Request, call_next):
    if request.method == "OPTIONS" or not access_token_required():
        return await call_next(request)

    if _token_matches(_extract_http_token(request)):
        return await call_next(request)

    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": "需要有效访问口令"},
        headers={"WWW-Authenticate": "Bearer"},
    )


async def verify_websocket_access(websocket: WebSocket) -> bool:
    if not access_token_required():
        return True

    query_token = websocket.query_params.get(TOKEN_QUERY_NAME)
    header_token = websocket.headers.get(TOKEN_HEADER_NAME)
    auth = websocket.headers.get("authorization", "")
    bearer_token = auth[7:].strip() if auth.lower().startswith("bearer ") else None

    return _token_matches(header_token or bearer_token or query_token)
