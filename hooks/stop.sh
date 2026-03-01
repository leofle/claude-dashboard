#!/usr/bin/env bash
# Claude Code hook: Stop
SERVER="${CLAUDE_DASHBOARD_URL:-http://localhost:4321}"
PAYLOAD="$(cat)"
SESSION_ID="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id',''))" 2>/dev/null)"
[ -z "$SESSION_ID" ] && exit 0
curl -sf -X POST "${SERVER}/hooks/stop" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"${SESSION_ID}\"}" \
  --max-time 5 > /dev/null 2>&1 || true
exit 0
