import React, { useState } from 'react';
import { Square } from 'lucide-react';

function statusColor(status, isWaiting) {
  if (isWaiting) return '#d29922';
  switch (status) {
    case 'active': return '#3fb950';
    case 'idle':   return '#8b949e';
    case 'ended':  return '#484f58';
    default:       return '#484f58';
  }
}

function statusLabel(status, isWaiting) {
  if (isWaiting) return 'waiting';
  return status;
}

export default function SessionListItem({ session, isWaiting, selected, onSelect }) {
  const [killing, setKilling] = useState(false);
  const color = statusColor(session.status, isWaiting);
  const label = statusLabel(session.status, isWaiting);

  const folderName = session.cwd
    ? session.cwd.split('/').filter(Boolean).pop()
    : (session.id?.slice(0, 8) ?? '????????');

  const canKill = !!session.spawned && session.status !== 'ended';
  const todos = session.todos || [];
  const doneTodos = todos.filter(t => t.status === 'completed').length;
  const pct = todos.length ? Math.round((doneTodos / todos.length) * 100) : 0;

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
      onClick={() => onSelect(session)}
      className={`
        group relative px-3 py-2.5 cursor-pointer border-l-2 transition-all duration-100 select-none
        ${selected
          ? 'border-[#2f81f7] bg-[#1c2128] text-[#e6edf3]'
          : 'border-transparent hover:bg-[#1c2128] text-[#c9d1d9] hover:text-[#e6edf3]'
        }
        ${session.status === 'ended' ? 'opacity-60' : ''}
      `}
    >
      {/* Main row: dot + name + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: color,
              boxShadow: (session.status === 'active' || isWaiting) ? `0 0 5px ${color}` : 'none',
            }}
          />
          <span className="text-sm font-medium truncate">{folderName}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canKill && (
            <button
              onClick={handleKill}
              disabled={killing}
              title="Kill session"
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[#f85149] hover:bg-[#f85149]/10 transition-all disabled:opacity-50"
            >
              <Square size={10} />
            </button>
          )}
          <span className="text-[10px] font-medium capitalize" style={{ color }}>{label}</span>
        </div>
      </div>

      {/* Current tool */}
      {session.current_tool && (
        <div className="mt-0.5 ml-3.5 text-[11px] text-[#58a6ff] font-mono truncate flex items-center gap-1.5">
          <span className="truncate">{session.current_tool}</span>
          <span className="w-1 h-1 rounded-full bg-[#58a6ff] animate-pulse flex-shrink-0" />
        </div>
      )}
      {!session.current_tool && session.status === 'active' && !isWaiting && (
        <div className="mt-0.5 ml-3.5 text-[11px] text-[#484f58] italic">thinking…</div>
      )}
      {isWaiting && (
        <div className="mt-0.5 ml-3.5 text-[11px] text-[#d29922] italic">awaiting input</div>
      )}

      {/* Todo progress bar */}
      {todos.length > 0 && (
        <div className="mt-1.5 ml-3.5 mr-1">
          <div className="h-0.5 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#3fb950' : '#58a6ff' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
