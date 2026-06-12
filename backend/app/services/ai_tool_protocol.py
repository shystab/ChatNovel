from __future__ import annotations

import html
import json
import re
from typing import Any


_DSML_MARKER_RE = re.compile(r"<\s*[|｜]{2}\s*DSML\s*[|｜]{2}", re.IGNORECASE)
_DSML_INVOKE_RE = re.compile(
    r'<\s*[|｜]{2}\s*DSML\s*[|｜]{2}\s*invoke\s+name="([^"]+)"\s*>(.*?)'
    r"</\s*[|｜]{2}\s*DSML\s*[|｜]{2}\s*invoke\s*>",
    re.IGNORECASE | re.DOTALL,
)
_DSML_PARAMETER_RE = re.compile(
    r'<\s*[|｜]{2}\s*DSML\s*[|｜]{2}\s*parameter\s+name="([^"]+)"(?:\s+[^>]*)?>(.*?)'
    r"</\s*[|｜]{2}\s*DSML\s*[|｜]{2}\s*parameter\s*>",
    re.IGNORECASE | re.DOTALL,
)
_DSML_BLOCK_RE = re.compile(
    r"<\s*[|｜]{2}\s*DSML\s*[|｜]{2}\s*tool_calls\s*>.*?"
    r"</\s*[|｜]{2}\s*DSML\s*[|｜]{2}\s*tool_calls\s*>",
    re.IGNORECASE | re.DOTALL,
)


def contains_tool_protocol(text: str) -> bool:
    return bool(_DSML_MARKER_RE.search(text or ""))


def strip_tool_protocol(text: str) -> str:
    """Remove leaked DSML tool markup from a user-facing model response."""
    value = _DSML_BLOCK_RE.sub("", text or "")
    marker = _DSML_MARKER_RE.search(value)
    if marker:
        value = value[:marker.start()]
    return value.strip()


def parse_tool_calls(raw: str) -> list[dict[str, Any]]:
    """Parse native JSON tool calls and text-form DSML fallbacks."""
    text = (raw or "").strip()
    if not text:
        return []

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = None

    if isinstance(parsed, dict) and isinstance(parsed.get("tool_calls"), list):
        parsed = parsed["tool_calls"]
    if isinstance(parsed, list):
        return [call for call in parsed if _valid_tool_call(call)]

    calls: list[dict[str, Any]] = []
    for index, match in enumerate(_DSML_INVOKE_RE.finditer(text)):
        name = html.unescape(match.group(1)).strip()
        arguments: dict[str, str] = {}
        for parameter in _DSML_PARAMETER_RE.finditer(match.group(2)):
            key = html.unescape(parameter.group(1)).strip()
            value = html.unescape(parameter.group(2)).strip()
            if key:
                arguments[key] = value
        if name:
            calls.append({
                "id": f"dsml_{index}_{name}",
                "type": "function",
                "function": {"name": name, "arguments": arguments},
            })
    return calls


def _valid_tool_call(call: object) -> bool:
    if not isinstance(call, dict):
        return False
    function = call.get("function")
    return isinstance(function, dict) and bool(function.get("name"))
