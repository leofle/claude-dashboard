import React, { useReducer, useEffect, useState, useCallback } from 'react';
import socket from './socket.js';
import Header from './components/Header.jsx';
import SessionCard from './components/SessionCard.jsx';
import SessionDetail from './components/SessionDetail.jsx';
import NotificationPanel from './components/NotificationPanel.jsx';
import ApprovalModal from './components/ApprovalModal.jsx';
import UserInputModal from './components/UserInputModal.jsx';
import AskUserQuestionModal from './components/AskUserQuestionModal.jsx';
import CommandPalette from './components/CommandPalette.jsx';

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

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <Header
        connected={state.connected}
        activeCount={activeSessions.length}
        unreadCount={unreadCount}
        pendingApprovalCount={state.pendingApprovals.length}
        onNotificationsClick={() => setShowNotifications(v => !v)}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Notification panel */}
        {showNotifications && (
          <NotificationPanel
            notifications={state.notifications}
            sessions={state.sessions}
            onMarkRead={handleMarkRead}
            onDelete={handleDeleteNotification}
            onClose={() => setShowNotifications(false)}
          />
        )}

        {/* Session grid */}
        {activeSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-[#8b949e]">
            <div className="text-6xl mb-4">🤖</div>
            <div className="text-xl font-semibold mb-2">No active sessions</div>
            <div className="text-sm text-center max-w-sm">
              Start a Claude Code session in your terminal to see it here.
              Make sure you've run <code className="font-mono bg-[#161b22] px-1 rounded">bash scripts/install.sh</code> first.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeSessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                allSessions={state.sessions}
                onClick={() => setSelectedSession(session)}
              />
            ))}
          </div>
        )}

        {/* Ended sessions (collapsed) */}
        {state.sessions.filter(s => s.status === 'ended').length > 0 && (
          <details className="mt-8">
            <summary className="text-[#8b949e] text-sm cursor-pointer select-none hover:text-[#e6edf3] transition-colors">
              {state.sessions.filter(s => s.status === 'ended').length} ended session(s)
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4 opacity-50">
              {state.sessions
                .filter(s => s.status === 'ended')
                .map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    allSessions={state.sessions}
                    onClick={() => setSelectedSession(session)}
                  />
                ))}
            </div>
          </details>
        )}
      </main>

      {/* Session detail drawer */}
      {selectedSession && (
        <SessionDetail
          session={selectedSession}
          allSessions={state.sessions}
          onClose={() => setSelectedSession(null)}
        />
      )}

      {/* Approval modal — shown for first pending approval */}
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

      {/* AskUserQuestion modal — shown for first pending question */}
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
