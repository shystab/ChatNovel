const DSML_MARKER = /<\s*[|｜]{2}\s*DSML\s*[|｜]{2}/i;
const DSML_BLOCK = /<\s*[|｜]{2}\s*DSML\s*[|｜]{2}\s*tool_calls\s*>[\s\S]*?<\/\s*[|｜]{2}\s*DSML\s*[|｜]{2}\s*tool_calls\s*>/gi;

export function stripLeakedToolProtocol(content: string) {
  let value = (content || "").replace(DSML_BLOCK, "");
  const marker = value.search(DSML_MARKER);
  if (marker >= 0) value = value.slice(0, marker);
  return value.trim();
}
