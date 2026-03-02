const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const MCP_TIMEOUT_MS = parseInt(process.env.MCP_TIMEOUT || '300', 10) * 1000;

const {
  getSession,
  getAllSessions,
  getActiveSessions,
  getRecentToolEvents,
  getTodosForSession,
  getAllNotifications,
  markNotificationRead,
  deleteNotification,
  clearPendingNotifications,
  getPendingApprovals,
  getApprovalRequest,
  resolveApprovalRequest,
  getPendingMcpRequests,
  getMcpRequest,
  insertMcpRequest,
  resolveMcpRequest,
  timeoutMcpRequest,
  getPendingQuestionRequests,
  getQuestionRequest,
  resolveQuestionRequest,
  insertPendingCommand,
  getFullState,
} = require('../db');

function getIo(req) {
  return req.app.get('io');
}

// ─── Sessions ──────────────────────────────────────────────────────────────

router.get('/sessions', (req, res) => {
  const sessions = getAllSessions.all().map(s => ({
    ...s,
    todos: getTodosForSession.all(s.id),
    recentEvents: getRecentToolEvents.all(s.id),
  }));
  res.json(sessions);
});

router.get('/sessions/active', (req, res) => {
  const sessions = getActiveSessions.all().map(s => ({
    ...s,
    todos: getTodosForSession.all(s.id),
    recentEvents: getRecentToolEvents.all(s.id),
  }));
  res.json(sessions);
});

router.get('/sessions/:id', (req, res) => {
  const session = getSession.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json({
    ...session,
    todos: getTodosForSession.all(session.id),
    recentEvents: getRecentToolEvents.all(session.id),
  });
});

// ─── Notifications ─────────────────────────────────────────────────────────

router.get('/notifications', (req, res) => {
  res.json(getAllNotifications.all());
});

router.post('/notifications/:id/read', (req, res) => {
  markNotificationRead.run(req.params.id);
  const io = getIo(req);
  io.emit('notification:read', { id: parseInt(req.params.id) });
  res.json({ ok: true });
});

router.delete('/notifications/:id', (req, res) => {
  deleteNotification.run(req.params.id);
  const io = getIo(req);
  io.emit('notification:deleted', { id: parseInt(req.params.id) });
  res.json({ ok: true });
});

router.post('/notifications/read-all', (req, res) => {
  const { session_id } = req.body;
  if (session_id) {
    clearPendingNotifications.run(session_id);
    const session = getSession.get(session_id);
    const io = getIo(req);
    if (session) io.emit('session:updated', session);
  }
  res.json({ ok: true });
});

// ─── Approval Requests ─────────────────────────────────────────────────────

router.get('/approvals', (req, res) => {
  res.json(getPendingApprovals.all());
});

router.get('/approvals/:id/status', (req, res) => {
  const approval = getApprovalRequest.get(req.params.id);
  if (!approval) return res.status(404).json({ error: 'Not found' });
  res.json({ status: approval.status, deny_reason: approval.deny_reason });
});

router.post('/approvals/:id/resolve', (req, res) => {
  const { approved, deny_reason } = req.body;
  const approval = getApprovalRequest.get(req.params.id);
  if (!approval) return res.status(404).json({ error: 'Not found' });
  if (approval.status !== 'pending') return res.status(409).json({ error: 'Already resolved' });

  const status = approved ? 'approved' : 'denied';
  resolveApprovalRequest.run({
    id: req.params.id,
    status,
    deny_reason: deny_reason || null,
  });

  const io = getIo(req);
  io.emit('approval:resolved', {
    id: req.params.id,
    session_id: approval.session_id,
    status,
    deny_reason,
  });

  console.log(`[api] approval ${req.params.id} ${status}`);
  res.json({ ok: true, status });
});

// ─── Question Requests (AskUserQuestion interception) ──────────────────────

router.get('/questions/:id/status', (req, res) => {
  const q = getQuestionRequest.get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  let answer = null;
  if (q.answer) {
    try { answer = JSON.parse(q.answer); } catch { answer = q.answer; }
  }
  res.json({ status: q.status, answer });
});

router.post('/questions/:id/answer', (req, res) => {
  const { answer } = req.body;
  const q = getQuestionRequest.get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  if (q.status !== 'pending') return res.status(409).json({ error: 'Already answered' });

  resolveQuestionRequest.run({ id: req.params.id, answer: JSON.stringify(answer) });

  const io = getIo(req);
  io.emit('question:resolved', {
    id: req.params.id,
    session_id: q.session_id,
    answer,
  });

  console.log(`[api] question ${req.params.id} answered`);
  res.json({ ok: true });
});

// ─── MCP Requests ──────────────────────────────────────────────────────────

router.get('/mcp-requests', (req, res) => {
  res.json(getPendingMcpRequests.all());
});

router.post('/mcp-requests/:id/respond', (req, res) => {
  const { response } = req.body;
  const request = getMcpRequest.get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });
  if (request.status !== 'pending') return res.status(409).json({ error: 'Already resolved' });

  resolveMcpRequest.run({ id: req.params.id, response: response || '' });

  const io = getIo(req);
  io.emit('user_input:resolved', {
    id: req.params.id,
    session_id: request.session_id,
    response,
  });

  console.log(`[api] mcp-request ${req.params.id} answered`);
  res.json({ ok: true });
});

// ─── MCP Tool Long-Poll ────────────────────────────────────────────────────
// Called by mcp-bridge.js; blocks until user responds or timeout

router.post('/mcp/tool', async (req, res) => {
  const { tool, args, session_id } = req.body;
  if (!tool) return res.status(400).json({ error: 'tool required' });

  const sid = session_id || 'unknown';

  // ── update_status: fire-and-forget ──
  if (tool === 'update_status') {
    const io = getIo(req);
    const session = getSession.get(sid);
    if (session) {
      const { updateSessionTool } = require('../db');
      updateSessionTool.run({ id: sid, current_tool: args?.status || null });
      io.emit('session:updated', getSession.get(sid));
    }
    return res.json({ result: 'ok' });
  }

  // ── request_user_input: long-poll ──
  if (tool === 'request_user_input') {
    const message = args?.message || args?.prompt || '';
    const id = uuidv4();

    insertMcpRequest.run({
      id,
      session_id: sid,
      tool_name: tool,
      message,
    });

    const io = getIo(req);
    io.emit('user_input:requested', {
      id,
      session_id: sid,
      message,
      created_at: new Date().toISOString(),
    });

    console.log(`[api] mcp request_user_input (${id}): "${message}"`);

    // Poll for answer
    const deadline = Date.now() + MCP_TIMEOUT_MS;
    const POLL_INTERVAL = 500;

    function poll() {
      const row = getMcpRequest.get(id);
      if (row && row.status === 'answered') {
        io.emit('user_input:resolved', { id, session_id: sid, response: row.response });
        return res.json({ result: row.response || '' });
      }
      if (Date.now() >= deadline) {
        timeoutMcpRequest.run(id);
        io.emit('user_input:resolved', { id, session_id: sid, response: null, timed_out: true });
        return res.json({ result: '', error: 'timed_out' });
      }
      setTimeout(poll, POLL_INTERVAL);
    }

    // Handle client disconnect
    res.on('close', () => {
      const row = getMcpRequest.get(id);
      if (row && row.status === 'pending') {
        timeoutMcpRequest.run(id);
      }
    });

    setTimeout(poll, POLL_INTERVAL);
    return;
  }

  // Unknown tool
  res.status(400).json({ error: `Unknown MCP tool: ${tool}` });
});

// ─── Pending Commands ──────────────────────────────────────────────────────

router.post('/sessions/:id/command', (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });
  insertPendingCommand.run({ id: uuidv4(), session_id: req.params.id, message: message.trim() });
  console.log(`[api] command queued for ${req.params.id}: "${message.trim()}"`);
  res.json({ ok: true });
});

// ─── Health ────────────────────────────────────────────────────────────────

router.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

module.exports = router;
