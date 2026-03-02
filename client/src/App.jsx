import React, { useReducer, useEffect, useState, useCallback, useMemo } from 'react';
import socket from './socket.js';
import Header from './components/Header.jsx';
import SessionListItem from './components/SessionListItem.jsx';
import SessionDetail from './components/SessionDetail.jsx';
import NotificationPanel from './components/NotificationPanel.jsx';
import ApprovalModal from './components/ApprovalModal.jsx';
import UserInputModal from './components/UserInputModal.jsx';
import AskUserQuestionModal from './components/AskUserQuestionModal.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import { Search, X } from 'lucide-react';

// ─── State ─────────────────────────────────────────────────────────────────

const initialState = {
  sessions: [],
  notifications: [],
  pendingApprovals: [],
  pendingMcpRequests: [],
  pendingQuestions: [],
  connected: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'INITIAL_STATE':
      return {
        ...state,
        sessions: action.payload.sessions || [],
        notifications: action.payload.notifications || [],
        pendingApprovals: action.payload.pendingApprovals || [],
        pendingMcpRequests: action.payload.pendingMcpRequests || [],
        pendingQuestions: (action.payload.pendingQuestions || []).map(q => ({
          ...q,
          questions: typeof q.questions === 'string' ? JSON.parse(q.questions) : q.questions,
        })),
      };

    case 'SESSION_NEW': {
      const exists = state.sessions.find(s => s.id === action.payload.id);
      if (exists) {
        return {
          ...state,
          sessions: state.sessions.map(s =>
            s.id === action.payload.id ? { ...s, ...action.payload } : s
          ),
        };
      }
      return { ...state, sessions: [action.payload, ...state.sessions] };
    }

    case 'SESSION_UPDATED':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload } : s
        ),
      };

    case 'SESSION_ENDED':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.session_id
            ? { ...s, status: 'ended', ended_at: action.payload.ended_at, current_tool: null }
            : s
        ),
      };

    case 'TODOS_UPDATED':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.session_id
            ? { ...s, todos: action.payload.todos }
            : s
        ),
      };

    case 'TOOL_START':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.session_id
            ? {
                ...s,
                current_tool: action.payload.tool_name,
                recentEvents: [action.payload, ...(s.recentEvents || [])].slice(0, 50),
              }
            : s
        ),
      };

    case 'TOOL_END':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.session_id
            ? { ...s, current_tool: null }
            : s
        ),
      };

    case 'TRANSCRIPT_ENTRY':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.session_id
            ? { ...s, transcript: [...(s.transcript || []), action.payload] }
            : s
        ),
      };

    case 'NOTIFICATION_NEW':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
      };

    case 'NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload.id ? { ...n, read_at: new Date().toISOString() } : n
        ),
      };

    case 'NOTIFICATION_DELETED':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload.id),
      };

    case 'APPROVAL_REQUESTED':
      return {
        ...state,
        pendingApprovals: [action.payload, ...state.pendingApprovals],
      };

    case 'APPROVAL_RESOLVED':
      return {
        ...state,
        pendingApprovals: state.pendingApprovals.filter(a => a.id !== action.payload.id),
      };

    case 'USER_INPUT_REQUESTED':
      return {
        ...state,
        pendingMcpRequests: [action.payload, ...state.pendingMcpRequests],
      };

    case 'USER_INPUT_RESOLVED':
      return {
        ...state,
        pendingMcpRequests: state.pendingMcpRequests.filter(r => r.id !== action.payload.id),
      };

    case 'QUESTION_REQUESTED':
      return {
        ...state,
        pendingQuestions: [action.payload, ...state.pendingQuestions],
      };

    case 'QUESTION_RESOLVED':
      return {
        ...state,
        pendingQuestions: state.pendingQuestions.filter(q => q.id !== action.payload.id),
      };

    case 'CONNECTED':
      return { ...state, connected: true };

    case 'DISCONNECTED':
      return { ...state, connected: false };

    default:
      return state;
  }
}

// ─── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ── Socket.IO event listeners ──
  useEffect(() => {
    socket.on('connect', () => dispatch({ type: 'CONNECTED' }));
    socket.on('disconnect', () => dispatch({ type: 'DISCONNECTED' }));

    socket.on('initial:state', (data) => dispatch({ type: 'INITIAL_STATE', payload: data }));
    socket.on('session:new', (data) => dispatch({ type: 'SESSION_NEW', payload: data }));
    socket.on('session:updated', (data) => dispatch({ type: 'SESSION_UPDATED', payload: data }));
    socket.on('session:ended', (data) => dispatch({ type: 'SESSION_ENDED', payload: data }));
    socket.on('todos:updated', (data) => dispatch({ type: 'TODOS_UPDATED', payload: data }));
    socket.on('tool:start', (data) => dispatch({ type: 'TOOL_START', payload: data }));
    socket.on('tool:end', (data) => dispatch({ type: 'TOOL_END', payload: data }));
    socket.on('notification:new', (data) => dispatch({ type: 'NOTIFICATION_NEW', payload: data }));
    socket.on('notification:read', (data) => dispatch({ type: 'NOTIFICATION_READ', payload: data }));
    socket.on('notification:deleted', (data) => dispatch({ type: 'NOTIFICATION_DELETED', payload: data }));
    socket.on('approval:requested', (data) => dispatch({ type: 'APPROVAL_REQUESTED', payload: data }));
    socket.on('approval:resolved', (data) => dispatch({ type: 'APPROVAL_RESOLVED', payload: data }));
    socket.on('user_input:requested', (data) => dispatch({ type: 'USER_INPUT_REQUESTED', payload: data }));
    socket.on('user_input:resolved', (data) => dispatch({ type: 'USER_INPUT_RESOLVED', payload: data }));
    socket.on('question:requested', (data) => dispatch({ type: 'QUESTION_REQUESTED', payload: data }));
    socket.on('question:resolved', (data) => dispatch({ type: 'QUESTION_RESOLVED', payload: data }));
    socket.on('transcript:entry', (data) => dispatch({ type: 'TRANSCRIPT_ENTRY', payload: data }));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('initial:state');
      socket.off('session:new');
      socket.off('session:updated');
      socket.off('session:ended');
      socket.off('todos:updated');
      socket.off('tool:start');
      socket.off('tool:end');
      socket.off('notification:new');
      socket.off('notification:read');
      socket.off('notification:deleted');
      socket.off('approval:requested');
      socket.off('approval:resolved');
      socket.off('user_input:requested');
      socket.off('user_input:resolved');
      socket.off('question:requested');
      socket.off('question:resolved');
      socket.off('transcript:entry');
    };
  }, []);

  // Cmd+P → command palette
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowCommandPalette(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Keep selectedSession in sync when sessions update
  useEffect(() => {
    if (selectedSession) {
      const updated = state.sessions.find(s => s.id === selectedSession.id);
      if (updated) setSelectedSession(updated);
    }
  }, [state.sessions]);

  const handleApprove = useCallback(async (approvalId, approved, denyReason) => {
    try {
      await fetch(`/api/approvals/${approvalId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, deny_reason: denyReason }),
      });
    } catch (err) {
      console.error('Failed to resolve approval:', err);
    }
  }, []);

  const handleMcpRespond = useCallback(async (requestId, response) => {
    try {
      await fetch(`/api/mcp-requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });
    } catch (err) {
      console.error('Failed to respond to MCP request:', err);
    }
  }, []);

  const handleQuestionAnswer = useCallback(async (questionId, answer) => {
    if (!answer) return; // dismissed
    try {
      await fetch(`/api/questions/${questionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
    } catch (err) {
      console.error('Failed to submit question answer:', err);
    }
  }, []);

  const handleMarkRead = useCallback(async (notificationId) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  }, []);

  const handleDeleteNotification = useCallback(async (notificationId) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  const activeSessions = state.sessions.filter(s => s.status !== 'ended');
  const unreadCount = state.notifications.filter(n => !n.read_at).length;
  const pendingApproval = state.pendingApprovals[0] || null;
  const pendingMcpRequest = state.pendingMcpRequests[0] || null;
  const pendingQuestion = state.pendingQuestions[0] || null;

  // Sessions that are blocked waiting for user input
  const waitingSessionIds = useMemo(() => {
    const ids = new Set();
    state.pendingApprovals.forEach(a => ids.add(a.session_id));
    state.pendingMcpRequests.forEach(r => ids.add(r.session_id));
    state.pendingQuestions.forEach(q => ids.add(q.session_id));
    return ids;
  }, [state.pendingApprovals, state.pendingMcpRequests, state.pendingQuestions]);

  // Filtered + searched sessions
  const filteredSessions = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return state.sessions.filter(s => {
      // Text search
      if (q) {
        const haystack = [s.cwd || '', s.id || ''].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // Status filter
      if (statusFilter === 'waiting') return waitingSessionIds.has(s.id);
      if (statusFilter === 'active') return s.status === 'active' && !waitingSessionIds.has(s.id);
      if (statusFilter === 'idle') return s.status === 'idle';
      if (statusFilter === 'ended') return s.status === 'ended';
      // 'all' — show everything
      return true;
    });
  }, [state.sessions, searchQuery, statusFilter, waitingSessionIds]);

  const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Running' },
    { key: 'waiting', label: 'Waiting' },
    { key: 'idle', label: 'Idle' },
    { key: 'ended', label: 'Ended' },
  ];

  const visibleActive = filteredSessions.filter(s => s.status !== 'ended');
  const visibleEnded = filteredSessions.filter(s => s.status === 'ended');

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] text-[#e6edf3] overflow-hidden">
      <Header
        connected={state.connected}
        activeCount={activeSessions.length}
        unreadCount={unreadCount}
        pendingApprovalCount={state.pendingApprovals.length}
        onNotificationsClick={() => setShowNotifications(v => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 border-r border-[#21262d] flex flex-col overflow-hidden bg-[#010409]">

          {/* Search + filter */}
          <div className="px-3 pt-3 pb-2 space-y-2 border-b border-[#21262d]">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#484f58] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter sessions…"
                className="w-full pl-7 pr-6 py-1.5 bg-[#161b22] border border-[#30363d] rounded-md text-xs text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#484f58] hover:text-[#8b949e]"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            <div className="flex gap-0.5">
              {STATUS_TABS.map(tab => {
                const count = tab.key === 'all'
                  ? state.sessions.length
                  : tab.key === 'waiting'
                    ? waitingSessionIds.size
                    : state.sessions.filter(s =>
                        tab.key === 'active'
                          ? s.status === 'active' && !waitingSessionIds.has(s.id)
                          : s.status === tab.key
                      ).length;
                const isActive = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`flex-1 py-1 text-[10px] rounded-md transition-colors ${
                      isActive
                        ? 'bg-[#1c2128] text-[#e6edf3]'
                        : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1c2128]/50'
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className={`ml-1 ${isActive ? 'text-[#8b949e]' : 'text-[#484f58]'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto py-1">
            {visibleActive.length === 0 && visibleEnded.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11px] text-[#484f58]">
                {state.sessions.length === 0
                  ? 'Start a Claude session or click New Session.'
                  : 'No sessions match your filter.'}
              </div>
            ) : (
              <>
                {visibleActive.map(session => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    isWaiting={waitingSessionIds.has(session.id)}
                    selected={selectedSession?.id === session.id}
                    onSelect={setSelectedSession}
                  />
                ))}

                {/* Ended sessions — collapsed unless filter=ended */}
                {visibleEnded.length > 0 && statusFilter !== 'ended' && (
                  <details className="mt-1">
                    <summary className="px-3 py-2 text-[10px] text-[#484f58] cursor-pointer hover:text-[#8b949e] select-none uppercase tracking-wider">
                      {visibleEnded.length} ended
                    </summary>
                    {visibleEnded.map(session => (
                      <SessionListItem
                        key={session.id}
                        session={session}
                        isWaiting={false}
                        selected={selectedSession?.id === session.id}
                        onSelect={setSelectedSession}
                      />
                    ))}
                  </details>
                )}

                {statusFilter === 'ended' && visibleEnded.map(session => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    isWaiting={false}
                    selected={selectedSession?.id === session.id}
                    onSelect={setSelectedSession}
                  />
                ))}
              </>
            )}
          </div>
        </aside>

        {/* ── Main pane ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden relative">
          {/* Notification panel overlay */}
          {showNotifications && (
            <div className="absolute inset-0 z-10 overflow-auto">
              <NotificationPanel
                notifications={state.notifications}
                sessions={state.sessions}
                onMarkRead={handleMarkRead}
                onDelete={handleDeleteNotification}
                onClose={() => setShowNotifications(false)}
              />
            </div>
          )}

          {selectedSession ? (
            <SessionDetail
              session={selectedSession}
              allSessions={state.sessions}
              isWaiting={waitingSessionIds.has(selectedSession.id)}
              onClose={() => setSelectedSession(null)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#8b949e]">
              <div className="w-14 h-14 rounded-2xl bg-[#161b22] border border-[#30363d] flex items-center justify-center mb-5 text-2xl shadow-lg">
                🤖
              </div>
              <div className="text-sm font-semibold text-[#e6edf3] mb-1.5">
                {state.sessions.length === 0 ? 'No sessions yet' : 'Select a session'}
              </div>
              <div className="text-xs text-center max-w-xs leading-relaxed">
                {state.sessions.length === 0
                  ? 'Start a Claude Code session in your terminal, or click New Session.'
                  : 'Click a session in the sidebar to view details.'}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Approval modal */}
      {pendingApproval && !pendingMcpRequest && !pendingQuestion && (
        <ApprovalModal
          approval={pendingApproval}
          session={state.sessions.find(s => s.id === pendingApproval.session_id)}
          onApprove={() => handleApprove(pendingApproval.id, true)}
          onDeny={(reason) => handleApprove(pendingApproval.id, false, reason)}
        />
      )}

      {/* MCP user input modal */}
      {pendingMcpRequest && !pendingQuestion && (
        <UserInputModal
          request={pendingMcpRequest}
          session={state.sessions.find(s => s.id === pendingMcpRequest.session_id)}
          onSubmit={(response) => handleMcpRespond(pendingMcpRequest.id, response)}
        />
      )}

      {/* AskUserQuestion modal */}
      {pendingQuestion && (
        <AskUserQuestionModal
          request={pendingQuestion}
          session={state.sessions.find(s => s.id === pendingQuestion.session_id)}
          onSubmit={(answer) => handleQuestionAnswer(pendingQuestion.id, answer)}
        />
      )}

      {/* Command palette — Cmd+P */}
      {showCommandPalette && (
        <CommandPalette
          sessions={state.sessions}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
    </div>
  );
}
