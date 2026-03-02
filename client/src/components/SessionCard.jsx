import React, { useState, useEffect } from 'react';
import { Clock, Terminal, Users, Square } from 'lucide-react';

// SQLite returns "2026-03-01 03:06:10" without timezone — treat as UTC
function parseUtc(ts) {
  if (!ts) return null;
  return new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
}

function useElapsed(startedAt) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    function update() {
      if (!startedAt) return;
      const diffMs = Date.now() - parseUtc(startedAt).getTime();
      const s = Math.floor(diffMs / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) setElapsed(`${h}h ${m % 60}m`);
      else if (m > 0) setElapsed(`${m}m ${s % 60}s`);
      else setElapsed(`${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

function statusColor(status, isWaiting) {
  if (isWaiting) return '#d29922'; // amber — waiting for user
  switch (status) {
    case 'active': return '#3fb950';
    case 'idle': return '#8b949e';
    case 'ended': return '#8b949e';
    default: return '#8b949e';
  }
}

function statusLabel(status, isWaiting) {
  if (isWaiting) return 'waiting';
  return status;
}

function TodoProgress({ todos = [] }) {
  if (!todos.length) return null;
  const done = todos.filter(t => t.status === 'completed').length;
  const total = todos.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-[#8b949e] mb-1">
        <span>Todos</span>
        <span>{done}/{total}</span>
      </div>
      <div className="h-1 bg-[#30363d] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#3fb950' : '#58a6ff' }}
        />
      </div>
    </div>
  );
}

export default function SessionCard({ session, allSessions, isWaiting, onClick }) {
  const elapsed = useElapsed(session.started_at);
  const color = statusColor(session.status, isWaiting);
  const children = allSessions.filter(s => s.parent_session_id === session.id);
  const [killing, setKilling] = useState(false);

  const shortId = session.id ? session.id.slice(0, 8) : '????????';
  const cwd = session.cwd ? session.cwd.replace(/^.*\//, '') : null;
  const canKill = session.spawned && session.status !== 'ended';

  async function handleKill(e) {
    e.stopPropagation();
    if (!canKill || killing) return;
    setKilling(true);
    try {
      await fetch(`/api/sessions/${session.id}/kill`, { method: 'POST' });
    } finally {
      setKilling(false);
    }
  }

  return (
    <div
      onClick={onClick}
      className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 cursor-pointer
        hover:border-[#58a6ff] transition-colors duration-150 select-none"
    >
      {/* Top row: status dot + session id + agent type */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: color,
              boxShadow: (session.status === 'active' || isWaiting) ? `0 0 6px ${color}` : 'none',
            }}
          />
          <span className="font-mono text-xs text-[#8b949e]">{shortId}</span>
          {session.agent_type === 'subagent' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20">
              sub-agent
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canKill && (
            <button
              onClick={handleKill}
              disabled={killing}
              title="Kill this session"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-[#f85149] hover:bg-[#f85149]/10 border border-transparent hover:border-[#f85149]/30 transition-colors disabled:opacity-50"
            >
              <Square size={10} />
              {killing ? 'Killing…' : 'Kill'}
            </button>
          )}
          <span className="text-xs capitalize" style={{ color }}>{statusLabel(session.status, isWaiting)}</span>
        </div>
      </div>

      {/* CWD */}
      {cwd && (
        <div className="flex items-center gap-1.5 text-xs text-[#8b949e] mb-2 font-mono truncate">
          <Terminal size={11} />
          <span className="truncate">{cwd}</span>
        </div>
      )}

      {/* Current tool chip */}
      {session.current_tool ? (
        <div className="inline-flex items-center gap-1.5 bg-[#58a6ff]/10 border border-[#58a6ff]/20
          px-2 py-1 rounded text-xs font-mono text-[#58a6ff] mb-2 max-w-full truncate">
          <span className="truncate">{session.current_tool}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-pulse flex-shrink-0" />
        </div>
      ) : session.status === 'active' ? (
        <div className="text-xs text-[#8b949e] mb-2 italic">thinking…</div>
      ) : null}

      {/* Bottom row: elapsed + sub-agents */}
      <div className="flex items-center justify-between text-xs text-[#8b949e]">
        <div className="flex items-center gap-1">
          <Clock size={11} />
          <span>{elapsed}</span>
        </div>
        {(children.length > 0 || session.sub_agent_count > 0) && (
          <div className="flex items-center gap-1">
            <Users size={11} />
            <span>{session.sub_agent_count || children.length} sub-agent{(session.sub_agent_count || children.length) !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Todo progress bar */}
      <TodoProgress todos={session.todos || []} />
    </div>
  );
}
