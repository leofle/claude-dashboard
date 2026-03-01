#!/usr/bin/env bash
# Claude Code hook: PostToolUse
SERVER="${CLAUDE_DASHBOARD_URL:-http://localhost:4321}"
PAYLOAD="$(cat)"
SESSION_ID="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id',''))" 2>/dev/null)"
TOOL_NAME="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null)"
TOOL_USE_ID="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_use_id',''))" 2>/dev/null)"
TOOL_INPUT="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('tool_input',{})))" 2>/dev/null || echo "{}")"
TOOL_RESPONSE="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('tool_response','')))" 2>/dev/null || echo '""')"
CWD="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null)"
[ -z "$SESSION_ID" ] && exit 0
curl -sf -X POST "${SERVER}/hooks/post-tool-use" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"${SESSION_ID}\",\"tool_name\":\"${TOOL_NAME}\",\"tool_use_id\":\"${TOOL_USE_ID}\",\"tool_input\":${TOOL_INPUT},\"tool_response\":${TOOL_RESPONSE},\"cwd\":\"${CWD}\"}" \
  --max-time 5 > /dev/null 2>&1 || true
exit 0
