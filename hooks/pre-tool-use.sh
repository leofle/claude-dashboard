#!/usr/bin/env bash
# Claude Code hook: PreToolUse
# Input: { session_id, cwd, tool_name, tool_input, tool_use_id, ... }
SERVER="${CLAUDE_DASHBOARD_URL:-http://localhost:4321}"
APPROVAL_TIMEOUT="${APPROVAL_TIMEOUT:-60}"
PAYLOAD="$(cat)"
SESSION_ID="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id',''))" 2>/dev/null)"
TOOL_NAME="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null)"
TOOL_USE_ID="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_use_id',''))" 2>/dev/null)"
TOOL_INPUT="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('tool_input',{})))" 2>/dev/null || echo "{}")"
CWD="$(echo "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null)"
[ -z "$SESSION_ID" ] && exit 0

RESPONSE="$(curl -sf -X POST "${SERVER}/hooks/pre-tool-use" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"${SESSION_ID}\",\"tool_name\":\"${TOOL_NAME}\",\"tool_use_id\":\"${TOOL_USE_ID}\",\"tool_input\":${TOOL_INPUT},\"cwd\":\"${CWD}\"}" \
  --max-time 15 2>/dev/null)" || exit 0

APPROVAL_ID="$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('approval_id',''))" 2>/dev/null)"
QUESTION_ID="$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('question_id',''))" 2>/dev/null)"
PENDING_CMD="$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pending_command',''))" 2>/dev/null)"

# Deliver pending dashboard command — block tool and surface message to Claude
if [ -n "$PENDING_CMD" ]; then
  printf "The user sent you a message from the Claude Dashboard:\n\n%s\n\nPlease address this message before continuing with what you were doing." "$PENDING_CMD" >&2
  exit 2
fi

# Poll for AskUserQuestion answer from dashboard
if [ -n "$QUESTION_ID" ]; then
  DEADLINE=$(( $(date +%s) + APPROVAL_TIMEOUT ))
  while true; do
    [ $(date +%s) -ge $DEADLINE ] && exit 0  # timeout: fall through to normal terminal UI
    STATUS_RESP="$(curl -sf "${SERVER}/api/questions/${QUESTION_ID}/status" --max-time 5 2>/dev/null)" || exit 0
    STATUS="$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','pending'))" 2>/dev/null)"
    if [ "$STATUS" = "answered" ]; then
      # Write the answer JSON to stderr — Claude Code sends this to Claude as the tool result.
      # Exit 2 suppresses the terminal UI entirely (same mechanism as approval denial).
      echo "$STATUS_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
answer = d.get('answer', {})
sys.stderr.write(json.dumps(answer) + '\n')
"
      exit 2
    fi
    sleep 0.5
  done
fi

[ -z "$APPROVAL_ID" ] && exit 0

# Poll for approval decision
DEADLINE=$(( $(date +%s) + APPROVAL_TIMEOUT ))
while true; do
  [ $(date +%s) -ge $DEADLINE ] && exit 0
  STATUS_RESP="$(curl -sf "${SERVER}/api/approvals/${APPROVAL_ID}/status" --max-time 5 2>/dev/null)" || exit 0
  STATUS="$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','pending'))" 2>/dev/null)"
  case "$STATUS" in
    approved) exit 0 ;;
    denied)
      REASON="$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deny_reason','') or 'Denied')" 2>/dev/null)"
      echo "Denied via Claude Dashboard: ${REASON}" >&2
      exit 2
      ;;
  esac
  sleep 0.5
done
