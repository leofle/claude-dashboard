#!/usr/bin/env bash
# Claude Code hook: Notification
SERVER="${CLAUDE_DASHBOARD_URL:-http://localhost:4321}"
PAYLOAD="$(cat)"
SESSION_ID="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id',''))" 2>/dev/null)"
MESSAGE="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null)"
TITLE="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title',''))" 2>/dev/null)"
NOTIFICATION_TYPE="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('notification_type','info'))" 2>/dev/null)"
CWD="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null)"
[ -z "$SESSION_ID" ] || [ -z "$MESSAGE" ] && exit 0
ESC_MSG="$(echo "$MESSAGE" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().rstrip()))" 2>/dev/null || echo "\"${MESSAGE}\"")"
ESC_TITLE="$(echo "$TITLE" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().rstrip()))" 2>/dev/null || echo "\"${TITLE}\"")"
curl -sf -X POST "${SERVER}/hooks/notification" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"${SESSION_ID}\",\"message\":${ESC_MSG},\"title\":${ESC_TITLE},\"notification_type\":\"${NOTIFICATION_TYPE}\",\"cwd\":\"${CWD}\"}" \
  --max-time 5 > /dev/null 2>&1 || true
exit 0
