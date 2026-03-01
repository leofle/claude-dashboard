import React, { useEffect } from 'react';
import { X, Terminal, Clock, GitBranch } from 'lucide-react';
import TodoList from './TodoList.jsx';
import ActivityLog from './ActivityLog.jsx';
import SubAgentTree from './SubAgentTree.jsx';

function parseUtc(ts) {
  if (!ts) return null;
  return new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
}

function useElapsedFull(startedAt, endedAt) {
  const [elapsed, setElapsed] = React.useState('');

  React.useEffect(() => {
    function update() {
      if (!startedAt) return;
      const end = endedAt ? parseUtc(endedAt) : new Date();
      const diffMs = end - parseUtc(startedAt);
      const s = Math.floor(diffMs / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) setElapsed(`${h}h ${m % 60}m ${s % 60}s`);
      else if (m > 0) setElapsed(`${m}m ${s % 60}s`);
      else setElapsed(`${s}s`);
    }
    update();
    if (!endedAt) {
      const id = setInterval(update, 1000);
      return () => clearInterval(id);
    }
  }, [startedAt, endedAt]);

  return elapsed;
}

function statusColor(status) {
  switch (status) {
    case 'active': return '#3fb950';
    case 'idle': return '#d29922';
    case 'ended': return '#8b949e';
    default: return '#8b949e';
  }
}

export default function SessionDetail({ session, allSessions, onClose }) {
  const elapsed = useElapsedFull(session.started_at, session.ended_at);
  const color = statusColor(session.status);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const children = allSessions.filter(s => s.parent_session_id === session.id);
  const hasTree = children.length > 0 || !!session.parent_session_id;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[#161b22] border-l border-[#30363d] z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: color,
                boxShadow: session.status === 'active' ? `0 0 8px ${color}` : 'none',
              }}
            />
            <div className="min-w-0">
              <div className="font-mono text-sm text-[#e6edf3] truncate">{session.id}</div>
              {session.cwd && (
                <div className="flex items-center gap-1 text-xs text-[#8b949e] truncate">
                  <Terminal size={10} />
                  <span className="truncate">{session.cwd}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 p-1.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-[#30363d] flex-shrink-0 text-xs text-[#8b949e]">
          <div className="flex items-center gap-1">
            <Clock size={11} />
            <span>{elapsed}</span>
          </div>
          <div>
            <span className="capitalize" style={{ color }}>{session.status}</span>
          </div>
          {session.agent_type === 'subagent' && (
            <div className="flex items-center gap-1 text-[#58a6ff]">
              <GitBranch size={11} />
              <span>sub-agent</span>
            </div>
          )}
          {session.current_tool && (
            <div className="font-mono text-[#58a6ff] bg-[#58a6ff]/10 px-1.5 py-0.5 rounded">
              {session.current_tool}
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Todos */}
          <section>
            <h3 className="text-sm font-semibold text-[#e6edf3] mb-3 uppercase tracking-wide">
              Todos
            </h3>
            <TodoList todos={session.todos || []} />
          </section>

          {/* Activity log */}
          <section>
            <h3 className="text-sm font-semibold text-[#e6edf3] mb-3 uppercase tracking-wide">
              Activity Log
            </h3>
            <ActivityLog events={session.recentEvents || []} />
          </section>

          {/* Sub-agent tree */}
          {hasTree && (
            <section>
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-3 uppercase tracking-wide">
                Agent Tree
              </h3>
              <SubAgentTree session={session} allSessions={allSessions} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
