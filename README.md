# Claude Dashboard

A real-time browser dashboard for monitoring all active Claude Code terminal sessions. See what each Claude is doing, manage todo items, respond to questions, and approve or deny tool calls — all from your browser. The terminal stays clean; everything routes through the dashboard.

## Features

- **Live Session Monitoring** — See every active Claude Code session, what tool it's running, and how long it's been running
- **Live Conversation Transcript** — Every message Claude writes and every tool call appears in real time in the session detail drawer, streamed directly from Claude Code's JSONL transcript file
- **Todo Tracking** — TodoWrite calls are intercepted and displayed in real time with progress bars
- **Permission Approvals** — Approve or deny tool calls (Bash, Write, Edit, etc.) from the browser; Claude blocks until you decide. No terminal prompt.
- **AskUserQuestion** — When Claude calls `AskUserQuestion`, the options appear as a click-to-answer UI in the dashboard. No terminal prompt.
- **Free-form Q&A** — Claude can call `request_user_input` via MCP to ask open-ended questions directly in the dashboard
- **Sub-agent Tree** — Visualize parent/child Claude relationships when Claude spawns sub-agents
- **Notification Panel** — See all Claude notifications in one place
- **Resizable Session Drawer** — Drag the left edge of the detail panel to any width; preference is saved to localStorage
- **Dark Terminal Theme** — Easy on the eyes, monospace font for tool names and commands

## Architecture

```
Claude Code (terminal)
  ├── Hooks (bash scripts) → POST → Express :4321/hooks/...
  ├── MCP bridge (stdio) → POST → Express :4321/api/mcp/tool
  └── JSONL transcript file → fs.watch → transcript-watcher.js

Express + Socket.IO :4321
  ├── SQLite (node:sqlite)
  ├── transcript-watcher.js (tails per-session JSONL files)
  ├── Serves built React app (client/dist/) in production
  └── WebSocket → Browser (React + Vite + Tailwind)
```

## Quick Start

### 1. Install

```bash
git clone https://github.com/yourusername/claude-dashboard.git
cd claude-dashboard
npm run install:all
```

### 2. Configure

```bash
cp .env.example server/.env
# Edit server/.env if you want to change ports or approval tools
```

### 3. Run the install script (registers hooks + MCP server)

```bash
bash scripts/install.sh
```

### 4. Start the dashboard

```bash
# Development (server :4321 + client :5173 with hot reload)
npm run dev

# Production (server :4321 serves built client)
npm run build && npm start
```

### 5. Open your browser

Navigate to http://localhost:4321 (production) or http://localhost:5173 (dev).

Now start a Claude Code session in any terminal — it will appear in the dashboard automatically.

## How terminal prompts are eliminated

Claude Code normally shows its own "Yes / Yes, don't ask again / No" prompt in the terminal for tool approvals, and its own interactive UI for `AskUserQuestion`. The dashboard replaces both:

1. **`permissions.allow`** in `~/.claude/settings.json` — tells Claude Code not to show its own terminal prompt for Bash, Write, Edit, etc.
2. **`PreToolUse` hook** — intercepts every tool call before it runs. For approval tools, it blocks and shows a modal in the dashboard. For `AskUserQuestion`, it shows the question options as a click-to-select UI, then delivers the answer back to Claude via the hook's exit code, suppressing the terminal UI entirely.

The terminal remains a clean log of Claude's output. All interaction happens in the browser.

## Hook Events

The dashboard intercepts these Claude Code hook events:

| Hook | Purpose |
|------|---------|
| `session-start` | Register new Claude session; start watching its JSONL transcript file |
| `pre-tool-use` | Intercept `AskUserQuestion` and approval tools; block until dashboard responds |
| `post-tool-use` | Record tool results, intercept TodoWrite |
| `notification` | Show Claude notifications in dashboard |
| `stop` | Mark session as ended |
| `subagent-start` | Track new sub-agent sessions |
| `subagent-stop` | Mark sub-agent as ended |

## MCP Tools

Claude can use these tools via the dashboard's MCP bridge:

| Tool | Description |
|------|-------------|
| `request_user_input(message)` | Pauses Claude, shows free-text question in dashboard, returns user's response |
| `update_status(status)` | Updates the current activity display in the dashboard |

## Configuration

Copy `.env.example` to `server/.env` and adjust:

- `PORT` — Server port (default: 4321)
- `APPROVAL_TOOLS` — Comma-separated tool names requiring browser approval (default: `Bash,Write,Edit,MultiEdit,NotebookEdit`)
- `MCP_TIMEOUT` — Seconds to wait for user input before timing out (default: 300)
- `APPROVAL_TIMEOUT` — Seconds hook waits for a dashboard response before auto-approving (default: 60)

## Development

```bash
npm run dev        # Start both server and client in watch mode
npm run build      # Build client for production
npm start          # Start server only (serves built client)
```

## Project Structure

```
claude-dashboard/
├── server/           # Express + Socket.IO + SQLite backend
│   ├── index.js      # Server bootstrap
│   ├── db.js         # Database schema and helpers
│   └── routes/
│       ├── hooks.js  # Hook endpoints
│       └── api.js    # REST API + MCP long-poll
├── client/           # React + Vite + Tailwind frontend
│   └── src/
│       ├── App.jsx
│       └── components/
├── hooks/            # Bash scripts for Claude Code hooks
└── scripts/
    ├── mcp-bridge.js         # MCP stdio server
    └── install.sh            # Setup script
server/
├── transcript-watcher.js     # Tails JSONL transcript files and emits transcript:entry events
```

## License

MIT
