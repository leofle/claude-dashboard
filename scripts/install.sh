#!/usr/bin/env bash
# Claude Dashboard — Install Script
# Sets up hooks and MCP server in ~/.claude/settings.json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOOKS_DIR="${PROJECT_DIR}/hooks"
SETTINGS_FILE="${HOME}/.claude/settings.json"

echo "=== Claude Dashboard Install ==="
echo "Project: ${PROJECT_DIR}"
echo ""

# ── 1. Make hooks executable ──────────────────────────────────────────────

echo "→ Setting hook permissions…"
chmod +x "${HOOKS_DIR}"/*.sh
echo "  ✓ Hooks are executable"

# ── 2. Ensure ~/.claude directory exists ──────────────────────────────────

mkdir -p "${HOME}/.claude"

# ── 3. Read or initialize settings.json ──────────────────────────────────

if [[ -f "$SETTINGS_FILE" ]]; then
  echo "→ Reading existing settings.json…"
  CURRENT="$(cat "$SETTINGS_FILE")"
else
  echo "→ Creating new settings.json…"
  CURRENT="{}"
fi

# ── 4. Merge settings using Python ────────────────────────────────────────

echo "→ Merging MCP server + hooks into settings.json…"

python3 - <<PYEOF
import json, sys, os

settings_file = os.path.expanduser("${SETTINGS_FILE}")
project_dir = "${PROJECT_DIR}"
hooks_dir = "${HOOKS_DIR}"

# Load existing settings
try:
    with open(settings_file, 'r') as f:
        settings = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    settings = {}

# ── MCP Server ─────────────────────────────────────────────────────────────
mcp_servers = settings.get("mcpServers", {})
mcp_servers["claude-dashboard"] = {
    "command": "node",
    "args": [os.path.join(project_dir, "scripts", "mcp-bridge.js")]
}
settings["mcpServers"] = mcp_servers

# ── Hooks ──────────────────────────────────────────────────────────────────
hooks = settings.get("hooks", {})

SERVER_URL = "http://localhost:4321"

def set_http_hook(event, path, extra=None):
    handler = {"type": "http", "url": f"{SERVER_URL}/hooks/{path}"}
    if extra:
        handler.update(extra)
    new_group = {"matcher": "*", "hooks": [handler]}
    existing = hooks.get(event, [])
    # Remove old dashboard entries (any format)
    cleaned = []
    for h in existing:
        if isinstance(h, dict) and "hooks" in h:
            inner = [i for i in h.get("hooks", [])
                     if SERVER_URL not in str(i.get("url", ""))
                     and hooks_dir not in str(i.get("command", ""))]
            if inner:
                cleaned.append({**h, "hooks": inner})
        elif isinstance(h, dict) and hooks_dir not in str(h.get("command", "")):
            cleaned.append(h)
    cleaned.append(new_group)
    hooks[event] = cleaned

set_http_hook("SessionStart",  "session-start")
set_http_hook("PreToolUse",    "pre-tool-use", {"timeout": 70})
set_http_hook("PostToolUse",   "post-tool-use")
set_http_hook("Notification",  "notification")
set_http_hook("Stop",          "stop")
set_http_hook("SubagentStart", "subagent-start")
set_http_hook("SubagentStop",  "subagent-stop")

settings["hooks"] = hooks

# ── Permissions ────────────────────────────────────────────────────────────
# Allow these tools without Claude Code's own terminal prompt — the
# PreToolUse hook (and dashboard) is the sole approval gatekeeper.
perms = settings.get("permissions", {})
allow = perms.get("allow", [])
dashboard_tools = ["Bash(*)", "Write(*)", "Edit(*)", "MultiEdit(*)", "NotebookEdit(*)"]
for t in dashboard_tools:
    if t not in allow:
        allow.append(t)
perms["allow"] = allow
settings["permissions"] = perms

# ── Write ──────────────────────────────────────────────────────────────────
with open(settings_file, 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')

print("  ✓ settings.json updated")
PYEOF

# ── 5. Copy .env.example if no .env exists ────────────────────────────────

if [[ ! -f "${PROJECT_DIR}/server/.env" ]]; then
  cp "${PROJECT_DIR}/.env.example" "${PROJECT_DIR}/server/.env"
  echo "→ Created server/.env from .env.example"
fi

# ── 6. Summary ────────────────────────────────────────────────────────────

echo ""
echo "=== Installation complete ==="
echo ""
echo "HTTP hooks registered (→ http://localhost:4321/hooks/...):"
echo "  SessionStart  → /hooks/session-start"
echo "  PreToolUse    → /hooks/pre-tool-use  (timeout: 70s)"
echo "  PostToolUse   → /hooks/post-tool-use"
echo "  Notification  → /hooks/notification"
echo "  Stop          → /hooks/stop"
echo "  SubagentStart → /hooks/subagent-start"
echo "  SubagentStop  → /hooks/subagent-stop"
echo ""
echo "MCP server registered:"
echo "  claude-dashboard → scripts/mcp-bridge.js"
echo ""
echo "Next steps:"
echo "  1. npm run install:all   (install dependencies)"
echo "  2. npm run dev           (start dashboard)"
echo "  3. Open http://localhost:5173"
echo "  4. Start a Claude Code session in another terminal"
echo ""
