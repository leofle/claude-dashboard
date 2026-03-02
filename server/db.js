const { DatabaseSync } = require('node:sqlite');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'dashboard.db');

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode + foreign keys
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// ─── Schema ────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    cwd TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    current_tool TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    parent_session_id TEXT,
    agent_type TEXT DEFAULT 'main',
    pending_notifications INTEGER NOT NULL DEFAULT 0,
    sub_agent_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tool_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    tool_input TEXT,
    tool_response TEXT,
    tool_use_id TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    outcome TEXT DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    todo_id TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    message TEXT NOT NULL,
    title TEXT,
    notification_type TEXT DEFAULT 'info',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT
  );

  CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    tool_input TEXT,
    tool_use_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    deny_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS mcp_requests (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    message TEXT NOT NULL,
    response TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    answered_at TEXT
  );

  CREATE TABLE IF NOT EXISTS question_requests (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tool_use_id TEXT,
    questions TEXT NOT NULL,
    answer TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    answered_at TEXT
  );

  CREATE TABLE IF NOT EXISTS transcript_entries (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT,
    tool_uses TEXT,
    timestamp TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: add transcript_path column to sessions if it doesn't exist yet
try { db.exec(`ALTER TABLE sessions ADD COLUMN transcript_path TEXT`); } catch {}

// ─── Transaction helper ────────────────────────────────────────────────────

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ─── Session Helpers ───────────────────────────────────────────────────────

const _upsertSession = db.prepare(`
  INSERT INTO sessions (id, cwd, status, agent_type, parent_session_id, started_at, last_seen_at)
  VALUES ($id, $cwd, $status, $agent_type, $parent_session_id, datetime('now'), datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    last_seen_at = datetime('now'),
    status = CASE WHEN excluded.status != 'active' THEN excluded.status ELSE sessions.status END
`);

const upsertSession = {
  run: (p) => _upsertSession.run({
    $id: p.id,
    $cwd: p.cwd || null,
    $status: p.status || 'active',
    $agent_type: p.agent_type || 'main',
    $parent_session_id: p.parent_session_id || null,
  }),
};

const _updateTranscriptPath = db.prepare(
  `UPDATE sessions SET transcript_path = $transcript_path WHERE id = $id`
);
const updateTranscriptPath = {
  run: (p) => _updateTranscriptPath.run({ $id: p.id, $transcript_path: p.transcript_path }),
};

const _getSession = db.prepare(`SELECT * FROM sessions WHERE id = $id`);
const getSession = { get: (id) => _getSession.get({ $id: id }) };

const _getAllSessions = db.prepare(`SELECT * FROM sessions ORDER BY started_at DESC`);
const getAllSessions = { all: () => _getAllSessions.all() };

const _getActiveSessions = db.prepare(`SELECT * FROM sessions WHERE status != 'ended' ORDER BY started_at DESC`);
const getActiveSessions = { all: () => _getActiveSessions.all() };

const _updateSessionStatus = db.prepare(`
  UPDATE sessions SET status = $status, last_seen_at = datetime('now') WHERE id = $id
`);
const updateSessionStatus = { run: (p) => _updateSessionStatus.run({ $status: p.status, $id: p.id }) };

const _updateSessionTool = db.prepare(`
  UPDATE sessions SET current_tool = $current_tool, last_seen_at = datetime('now'), status = 'active' WHERE id = $id
`);
const updateSessionTool = { run: (p) => _updateSessionTool.run({ $current_tool: p.current_tool, $id: p.id }) };

const _endSession = db.prepare(`
  UPDATE sessions SET status = 'ended', ended_at = datetime('now'), current_tool = NULL WHERE id = $id
`);
const endSession = { run: (id) => _endSession.run({ $id: id }) };

const _incrementSubAgentCount = db.prepare(
  `UPDATE sessions SET sub_agent_count = sub_agent_count + 1 WHERE id = $id`
);
const incrementSubAgentCount = { run: (id) => _incrementSubAgentCount.run({ $id: id }) };

const _decrementSubAgentCount = db.prepare(
  `UPDATE sessions SET sub_agent_count = MAX(0, sub_agent_count - 1) WHERE id = $id`
);
const decrementSubAgentCount = { run: (id) => _decrementSubAgentCount.run({ $id: id }) };

const _incrementPendingNotifications = db.prepare(
  `UPDATE sessions SET pending_notifications = pending_notifications + 1 WHERE id = $id`
);
const incrementPendingNotifications = { run: (id) => _incrementPendingNotifications.run({ $id: id }) };

const _clearPendingNotifications = db.prepare(
  `UPDATE sessions SET pending_notifications = 0 WHERE id = $id`
);
const clearPendingNotifications = { run: (id) => _clearPendingNotifications.run({ $id: id }) };

// ─── Tool Event Helpers ────────────────────────────────────────────────────

const _insertToolEvent = db.prepare(`
  INSERT INTO tool_events (session_id, tool_name, tool_input, tool_use_id, started_at)
  VALUES ($session_id, $tool_name, $tool_input, $tool_use_id, datetime('now'))
`);
const insertToolEvent = {
  run: (p) => _insertToolEvent.run({
    $session_id: p.session_id,
    $tool_name: p.tool_name,
    $tool_input: p.tool_input || null,
    $tool_use_id: p.tool_use_id || null,
  }),
};

const _updateToolEvent = db.prepare(`
  UPDATE tool_events
  SET tool_response = $tool_response, ended_at = datetime('now'), outcome = $outcome
  WHERE session_id = $session_id AND tool_use_id = $tool_use_id AND ended_at IS NULL
`);
const updateToolEvent = {
  run: (p) => _updateToolEvent.run({
    $session_id: p.session_id,
    $tool_use_id: p.tool_use_id || null,
    $tool_response: p.tool_response || null,
    $outcome: p.outcome || 'success',
  }),
};

const _getRecentToolEvents = db.prepare(
  `SELECT * FROM tool_events WHERE session_id = $id ORDER BY started_at DESC LIMIT 50`
);
const getRecentToolEvents = { all: (id) => _getRecentToolEvents.all({ $id: id }) };

// ─── Todo Helpers ──────────────────────────────────────────────────────────

const _deleteTodosForSession = db.prepare(`DELETE FROM todos WHERE session_id = $id`);
const _insertTodo = db.prepare(`
  INSERT INTO todos (session_id, content, status, priority, todo_id, display_order, updated_at)
  VALUES ($session_id, $content, $status, $priority, $todo_id, $display_order, datetime('now'))
`);
const _getTodosForSession = db.prepare(
  `SELECT * FROM todos WHERE session_id = $id ORDER BY display_order ASC`
);
const getTodosForSession = { all: (id) => _getTodosForSession.all({ $id: id }) };

function replaceTodos(sessionId, todos) {
  return transaction(() => {
    _deleteTodosForSession.run({ $id: sessionId });
    todos.forEach((todo, i) => {
      _insertTodo.run({
        $session_id: sessionId,
        $content: todo.content || todo.description || '',
        $status: todo.status || 'pending',
        $priority: todo.priority || 'medium',
        $todo_id: todo.id || null,
        $display_order: i,
      });
    });
    return getTodosForSession.all(sessionId);
  });
}

// ─── Notification Helpers ──────────────────────────────────────────────────

const _insertNotification = db.prepare(`
  INSERT INTO notifications (session_id, message, title, notification_type, created_at)
  VALUES ($session_id, $message, $title, $notification_type, datetime('now'))
`);
const insertNotification = {
  run: (p) => {
    const result = _insertNotification.run({
      $session_id: p.session_id,
      $message: p.message,
      $title: p.title || null,
      $notification_type: p.notification_type || 'info',
    });
    return result;
  },
};

const _markNotificationRead = db.prepare(
  `UPDATE notifications SET read_at = datetime('now') WHERE id = $id`
);
const markNotificationRead = { run: (id) => _markNotificationRead.run({ $id: id }) };

const _getUnreadNotifications = db.prepare(
  `SELECT * FROM notifications WHERE read_at IS NULL ORDER BY created_at DESC`
);
const getUnreadNotifications = { all: () => _getUnreadNotifications.all() };

const _getAllNotifications = db.prepare(
  `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100`
);
const getAllNotifications = { all: () => _getAllNotifications.all() };

const _deleteNotification = db.prepare(`DELETE FROM notifications WHERE id = $id`);
const deleteNotification = { run: (id) => _deleteNotification.run({ $id: id }) };

// ─── Approval Request Helpers ──────────────────────────────────────────────

const _insertApprovalRequest = db.prepare(`
  INSERT INTO approval_requests (id, session_id, tool_name, tool_input, tool_use_id)
  VALUES ($id, $session_id, $tool_name, $tool_input, $tool_use_id)
`);
const insertApprovalRequest = {
  run: (p) => _insertApprovalRequest.run({
    $id: p.id,
    $session_id: p.session_id,
    $tool_name: p.tool_name,
    $tool_input: p.tool_input || null,
    $tool_use_id: p.tool_use_id || null,
  }),
};

const _getApprovalRequest = db.prepare(`SELECT * FROM approval_requests WHERE id = $id`);
const getApprovalRequest = { get: (id) => _getApprovalRequest.get({ $id: id }) };

const _resolveApprovalRequest = db.prepare(`
  UPDATE approval_requests
  SET status = $status, deny_reason = $deny_reason, resolved_at = datetime('now')
  WHERE id = $id
`);
const resolveApprovalRequest = {
  run: (p) => _resolveApprovalRequest.run({
    $id: p.id,
    $status: p.status,
    $deny_reason: p.deny_reason || null,
  }),
};

const _getPendingApprovals = db.prepare(
  `SELECT * FROM approval_requests WHERE status = 'pending' ORDER BY created_at DESC`
);
const getPendingApprovals = { all: () => _getPendingApprovals.all() };

// ─── MCP Request Helpers ───────────────────────────────────────────────────

const _insertMcpRequest = db.prepare(`
  INSERT INTO mcp_requests (id, session_id, tool_name, message)
  VALUES ($id, $session_id, $tool_name, $message)
`);
const insertMcpRequest = {
  run: (p) => _insertMcpRequest.run({
    $id: p.id,
    $session_id: p.session_id,
    $tool_name: p.tool_name,
    $message: p.message,
  }),
};

const _getMcpRequest = db.prepare(`SELECT * FROM mcp_requests WHERE id = $id`);
const getMcpRequest = { get: (id) => _getMcpRequest.get({ $id: id }) };

const _resolveMcpRequest = db.prepare(`
  UPDATE mcp_requests
  SET response = $response, status = 'answered', answered_at = datetime('now')
  WHERE id = $id
`);
const resolveMcpRequest = {
  run: (p) => _resolveMcpRequest.run({ $id: p.id, $response: p.response || '' }),
};

const _timeoutMcpRequest = db.prepare(
  `UPDATE mcp_requests SET status = 'timed_out' WHERE id = $id`
);
const timeoutMcpRequest = { run: (id) => _timeoutMcpRequest.run({ $id: id }) };

const _getPendingMcpRequests = db.prepare(
  `SELECT * FROM mcp_requests WHERE status = 'pending' ORDER BY created_at DESC`
);
const getPendingMcpRequests = { all: () => _getPendingMcpRequests.all() };

// ─── Question Request Helpers ──────────────────────────────────────────────

const _insertQuestionRequest = db.prepare(`
  INSERT INTO question_requests (id, session_id, tool_use_id, questions)
  VALUES ($id, $session_id, $tool_use_id, $questions)
`);
const insertQuestionRequest = {
  run: (p) => _insertQuestionRequest.run({
    $id: p.id,
    $session_id: p.session_id,
    $tool_use_id: p.tool_use_id || null,
    $questions: p.questions,
  }),
};

const _getQuestionRequest = db.prepare(`SELECT * FROM question_requests WHERE id = $id`);
const getQuestionRequest = { get: (id) => _getQuestionRequest.get({ $id: id }) };

const _resolveQuestionRequest = db.prepare(`
  UPDATE question_requests
  SET answer = $answer, status = 'answered', answered_at = datetime('now')
  WHERE id = $id
`);
const resolveQuestionRequest = {
  run: (p) => _resolveQuestionRequest.run({ $id: p.id, $answer: p.answer }),
};

const _getPendingQuestionRequests = db.prepare(
  `SELECT * FROM question_requests WHERE status = 'pending' ORDER BY created_at DESC`
);
const getPendingQuestionRequests = { all: () => _getPendingQuestionRequests.all() };

// ─── Transcript Entry Helpers ──────────────────────────────────────────────

const _insertTranscriptEntry = db.prepare(`
  INSERT OR IGNORE INTO transcript_entries (id, session_id, role, text, tool_uses, timestamp)
  VALUES ($id, $session_id, $role, $text, $tool_uses, $timestamp)
`);
const insertTranscriptEntry = {
  run: (p) => _insertTranscriptEntry.run({
    $id: p.id,
    $session_id: p.session_id,
    $role: p.role,
    $text: p.text || null,
    $tool_uses: p.tool_uses || null,
    $timestamp: p.timestamp || new Date().toISOString(),
  }),
};

const _getTranscriptEntries = db.prepare(
  `SELECT * FROM transcript_entries WHERE session_id = $id ORDER BY timestamp ASC LIMIT 500`
);
const getTranscriptEntries = {
  all: (id) => _getTranscriptEntries.all({ $id: id }).map(e => ({
    ...e,
    tool_uses: e.tool_uses ? JSON.parse(e.tool_uses) : null,
  })),
};

// ─── Full state for initial load ───────────────────────────────────────────

function getFullState() {
  const sessions = getAllSessions.all();
  const result = sessions.map(s => ({
    ...s,
    todos: getTodosForSession.all(s.id),
    recentEvents: getRecentToolEvents.all(s.id),
    transcript: getTranscriptEntries.all(s.id),
  }));
  return {
    sessions: result,
    notifications: getAllNotifications.all(),
    pendingApprovals: getPendingApprovals.all(),
    pendingMcpRequests: getPendingMcpRequests.all(),
    pendingQuestions: getPendingQuestionRequests.all(),
  };
}

module.exports = {
  db,
  upsertSession,
  getSession,
  getAllSessions,
  getActiveSessions,
  updateSessionStatus,
  updateSessionTool,
  endSession,
  incrementSubAgentCount,
  decrementSubAgentCount,
  incrementPendingNotifications,
  clearPendingNotifications,
  insertToolEvent,
  updateToolEvent,
  getRecentToolEvents,
  replaceTodos,
  getTodosForSession,
  insertNotification,
  markNotificationRead,
  deleteNotification,
  getUnreadNotifications,
  getAllNotifications,
  insertApprovalRequest,
  getApprovalRequest,
  resolveApprovalRequest,
  getPendingApprovals,
  insertMcpRequest,
  getMcpRequest,
  resolveMcpRequest,
  timeoutMcpRequest,
  getPendingMcpRequests,
  insertQuestionRequest,
  getQuestionRequest,
  resolveQuestionRequest,
  getPendingQuestionRequests,
  updateTranscriptPath,
  insertTranscriptEntry,
  getTranscriptEntries,
  getFullState,
};
