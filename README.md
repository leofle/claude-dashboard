# Claude Dashboard

A real-time browser dashboard for monitoring all active Claude Code terminal sessions. See what each Claude is doing, manage todo items, respond to questions, and approve or deny dangerous tool calls — all from your browser.

## Features

- **Live Session Monitoring** — See every active Claude Code session, what tool it's running, and how long it's been running
- **Todo Tracking** — TodoWrite calls are intercepted and displayed in real time with progress bars
- **Permission Approvals** — Approve or deny tool calls (Bash, Write, Edit, etc.) from the browser; Claude blocks until you decide
- **Free-form Q&A** — Claude can call `request_user_input` via MCP to ask you questions directly in the dashboard
- **Sub-agent Tree** — Visualize parent/child Claude relationships when Claude spawns sub-agents
- **Notification Panel** — See all Claude notifications in one place
- **Dark Terminal Theme** — Easy on the eyes, monospace font for tool names and commands

## Architecture

```
Claude Code (terminal)
  ├── Hooks (bash scripts) → POST → Express :4321/hooks/...
  └── MCP bridge (stdio) → POST → Express :4321/api/mcp/tool

Express + Socket.IO :4321
  ├── SQLite (better-sqlite3)
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

## Hook Events

The dashboard intercepts these Claude Code hook events:

| Hook | Purpose |
|------|---------|
| `session-start` | Register new Claude session |
| `pre-tool-use` | Block for approval on dangerous tools |
| `post-tool-use` | Record tool results, intercept TodoWrite |
| `notification` | Show Claude notifications in dashboard |
| `stop` | Mark session as ended |
| `subagent-start` | Track new sub-agent sessions |
| `subagent-stop` | Mark sub-agent as ended |

## MCP Tools

Claude can use these tools via the dashboard's MCP bridge:

| Tool | Description |
|------|-------------|
| `request_user_input(message)` | Pauses Claude, shows question in dashboard, returns user's text response |
| `update_status(status)` | Updates the current activity display in the dashboard |

## Configuration

Copy `.env.example` to `server/.env` and adjust:

- `PORT` — Server port (default: 4321)
- `APPROVAL_TOOLS` — Comma-separated tool names requiring browser approval
- `MCP_TIMEOUT` — Seconds to wait for user input before timing out (default: 300)
- `APPROVAL_TIMEOUT` — Seconds hook waits for approval before auto-approving (default: 60)

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
    ├── mcp-bridge.js # MCP stdio server
    └── install.sh    # Setup script
```

## License

MIT
