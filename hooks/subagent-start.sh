#!/usr/bin/env bash
# Claude Code hook: SubagentStart
SERVER="${CLAUDE_DASHBOARD_URL:-http://localhost:4321}"
PAYLOAD="$(cat)"
SESSION_ID="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id',''))" 2>/dev/null)"
PARENT_SESSION_ID="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('parent_session_id',''))" 2>/dev/null)"
CWD="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null)"
[ -z "$SESSION_ID" ] && exit 0
curl -sf -X POST "${SERVER}/hooks/subagent-start" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"${SESSION_ID}\",\"parent_session_id\":\"${PARENT_SESSION_ID}\",\"cwd\":\"${CWD}\"}" \
  --max-time 5 > /dev/null 2>&1 || true
exit 0
