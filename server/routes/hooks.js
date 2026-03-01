const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const APPROVAL_TIMEOUT_MS = parseInt(process.env.APPROVAL_TIMEOUT || '60', 10) * 1000;
const APPROVAL_TOOLS = (process.env.APPROVAL_TOOLS || 'Bash,Write,Edit,MultiEdit,NotebookEdit')
  .split(',')
  .map(t => t.trim())
  .filter(Boolean);

const {
  upsertSession,
  getSession,
  updateSessionTool,
  updateSessionStatus,
  endSession,
  incrementSubAgentCount,
  decrementSubAgentCount,
  incrementPendingNotifications,
  insertToolEvent,
  updateToolEvent,
  replaceTodos,
  insertNotification,
  insertApprovalRequest,
  getApprovalRequest,
} = require('../db');

function getIo(req) {
  return req.app.get('io');
}

// Claude Code sends all common fields (session_id, cwd, hook_event_name, etc.)
// plus event-specific fields directly in the POST body.

function ensureSession(sessionId, extra = {}) {
  if (!sessionId) return null;
  upsertSession.run({
    id: sessionId,
    cwd: extra.cwd || null,
    status: 'active',
    agent_type: extra.agent_type || 'main',
    parent_session_id: extra.parent_session_id || null,
  });
  return getSession.get(sessionId);
}

// ─── POST /hooks/session-start ─────────────────────────────────────────────

router.post('/session-start', (req, res) => {
  // Claude Code sends: { session_id, cwd, hook_event_name, transcript_path, permission_mode }
  const { session_id, cwd } = req.body;
  if (!session_id) return res.json({});

  ensureSession(session_id, { cwd });
  const io = getIo(req);
  io.emit('session:new', getSession.get(session_id));

  console.log(`[hook] session-start: ${session_id} cwd=${cwd}`);
  res.json({});
});

// ─── POST /hooks/pre-tool-use ──────────────────────────────────────────────

router.post('/pre-tool-use', async (req, res) => {
  // Claude Code sends: { session_id, cwd, tool_name, tool_input, tool_use_id, ... }
  const { session_id, tool_name, tool_input, tool_use_id, cwd } = req.body;
  if (!session_id || !tool_name) return res.json({});

  ensureSession(session_id, { cwd });

  const io = getIo(req);

  // Record tool start
  insertToolEvent.run({
    session_id,
    tool_name,
    tool_input: tool_input ? JSON.stringify(tool_input) : null,
    tool_use_id: tool_use_id || null,
  });
  updateSessionTool.run({ id: session_id, current_tool: tool_name });
  io.emit('session:updated', getSession.get(session_id));
  io.emit('tool:start', { session_id, tool_name, tool_input, tool_use_id });

  // Check if this tool requires approval
  if (!APPROVAL_TOOLS.includes(tool_name)) {
    return res.json({});
  }

  // Requires approval — insert request and long-poll
  const approval_id = uuidv4();
  insertApprovalRequest.run({
    id: approval_id,
    session_id,
    tool_name,
    tool_input: tool_input ? JSON.stringify(tool_input) : null,
    tool_use_id: tool_use_id || null,
  });

  io.emit('approval:requested', {
    id: approval_id,
    session_id,
    tool_name,
    tool_input,
    tool_use_id,
    created_at: new Date().toISOString(),
  });

  console.log(`[hook] pre-tool-use: waiting for approval (${approval_id}) for ${tool_name}`);

  // Long-poll until approved/denied or timeout
  const deadline = Date.now() + APPROVAL_TIMEOUT_MS;
  const POLL_INTERVAL = 500;

  // Handle client disconnect
  let resolved = false;
  res.on('close', () => { resolved = true; });

  await new Promise(resolve => {
    function poll() {
      if (resolved) return resolve();

      const row = getApprovalRequest.get(approval_id);
      if (row && row.status === 'approved') {
        resolved = true;
        // Allow: return empty JSON
        res.json({});
        return resolve();
      }
      if (row && row.status === 'denied') {
        resolved = true;
        // Deny: use hookSpecificOutput format
        res.json({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: row.deny_reason || 'Denied via Claude Dashboard',
          },
        });
        return resolve();
      }
      if (Date.now() >= deadline) {
        resolved = true;
        // Timeout — allow by default (never block Claude indefinitely)
        console.log(`[hook] pre-tool-use: approval timed out, allowing (${approval_id})`);
        res.json({});
        return resolve();
      }
      setTimeout(poll, POLL_INTERVAL);
    }
    setTimeout(poll, POLL_INTERVAL);
  });
});

// ─── POST /hooks/post-tool-use ─────────────────────────────────────────────

router.post('/post-tool-use', (req, res) => {
  // Claude Code sends: { session_id, cwd, tool_name, tool_input, tool_response, tool_use_id, ... }
  const { session_id, tool_name, tool_input, tool_response, tool_use_id, cwd } = req.body;
  if (!session_id) return res.json({});

  ensureSession(session_id, { cwd });

  const io = getIo(req);

  updateToolEvent.run({
    session_id,
    tool_use_id: tool_use_id || null,
    tool_response: tool_response ? JSON.stringify(tool_response) : null,
    outcome: 'success',
  });

  // Intercept TodoWrite
  if (tool_name === 'TodoWrite') {
    try {
      const input = typeof tool_input === 'string' ? JSON.parse(tool_input) : tool_input;
      const todos = input?.todos || [];
      const updated = replaceTodos(session_id, todos);
      io.emit('todos:updated', { session_id, todos: updated });
      console.log(`[hook] TodoWrite: ${todos.length} todos for ${session_id}`);
    } catch (err) {
      console.error('[hook] failed to parse TodoWrite input:', err);
    }
  }

  io.emit('session:updated', getSession.get(session_id));
  io.emit('tool:end', { session_id, tool_name, tool_use_id, outcome: 'success' });

  res.json({});
});

// ─── POST /hooks/notification ──────────────────────────────────────────────

router.post('/notification', (req, res) => {
  // Claude Code sends: { session_id, cwd, message, title, notification_type, ... }
  const { session_id, message, title, notification_type, cwd } = req.body;
  if (!session_id || !message) return res.json({});

  ensureSession(session_id, { cwd });
  incrementPendingNotifications.run(session_id);

  const result = insertNotification.run({
    session_id,
    message,
    title: title || null,
    notification_type: notification_type || 'info',
  });

  const io = getIo(req);
  io.emit('notification:new', {
    id: result.lastInsertRowid,
    session_id,
    message,
    title,
    notification_type: notification_type || 'info',
    created_at: new Date().toISOString(),
  });
  io.emit('session:updated', getSession.get(session_id));

  console.log(`[hook] notification: ${session_id} — ${message}`);
  res.json({});
});

// ─── POST /hooks/stop ──────────────────────────────────────────────────────

router.post('/stop', (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.json({});

  endSession.run(session_id);

  const io = getIo(req);
  io.emit('session:ended', { session_id, ended_at: new Date().toISOString() });
  io.emit('session:updated', getSession.get(session_id));

  console.log(`[hook] stop: ${session_id}`);
  res.json({});
});

// ─── POST /hooks/subagent-start ────────────────────────────────────────────

router.post('/subagent-start', (req, res) => {
  // Claude Code sends: { session_id, cwd, parent_session_id, agent_type, ... }
  const { session_id, parent_session_id, cwd } = req.body;
  if (!session_id) return res.json({});

  ensureSession(session_id, { cwd, agent_type: 'subagent', parent_session_id });

  const io = getIo(req);
  if (parent_session_id) {
    incrementSubAgentCount.run(parent_session_id);
    io.emit('session:updated', getSession.get(parent_session_id));
    io.emit('subagent:started', { session_id, parent_session_id });
  }
  io.emit('session:new', getSession.get(session_id));

  console.log(`[hook] subagent-start: ${session_id} parent=${parent_session_id}`);
  res.json({});
});

// ─── POST /hooks/subagent-stop ─────────────────────────────────────────────

router.post('/subagent-stop', (req, res) => {
  const { session_id, parent_session_id } = req.body;
  if (!session_id) return res.json({});

  endSession.run(session_id);

  const io = getIo(req);
  if (parent_session_id) {
    decrementSubAgentCount.run(parent_session_id);
    io.emit('session:updated', getSession.get(parent_session_id));
  }
  io.emit('session:ended', { session_id, ended_at: new Date().toISOString() });
  io.emit('session:updated', getSession.get(session_id));
  io.emit('subagent:ended', { session_id, parent_session_id });

  console.log(`[hook] subagent-stop: ${session_id}`);
  res.json({});
});

module.exports = router;
