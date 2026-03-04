import React, { useEffect, useRef, useState } from 'react';
import { X, Terminal, Clock, GitBranch, Square, GitFork, Pencil } from 'lucide-react';
import TodoList from './TodoList.jsx';
import ActivityLog from './ActivityLog.jsx';
import SubAgentTree from './SubAgentTree.jsx';
import TranscriptView from './TranscriptView.jsx';

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

function statusColor(status, isWaiting) {
  if (isWaiting) return '#d29922';
  switch (status) {
    case 'active': return '#3fb950';
    case 'idle':   return '#8b949e';
    case 'ended':  return '#8b949e';
    default:       return '#8b949e';
  }
}

function statusLabel(status, isWaiting) {
  if (isWaiting) return 'waiting';
  return status;
}

export default function SessionDetail({ session, allSessions, isWaiting, onClose }) {
  const elapsed = useElapsedFull(session.started_at, session.ended_at);
  const color = statusColor(session.status, isWaiting);
  const [killing, setKilling] = useState(false);
  const [forking, setForking] = useState(false);
  const [forkDone, setForkDone] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef(null);
  const canKill = !!session.spawned && session.status !== 'ended';

  const folderName = session.cwd?.split('/').filter(Boolean).pop() ?? session.id?.slice(0, 8);
  const displayName = session.nickname || folderName;

  function startEditName(e) {
    e.stopPropagation();
    setNameDraft(session.nickname || '');
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  async function saveNickname() {
    setEditingName(false);
    const nickname = nameDraft.trim() || null;
    if (nickname === (session.nickname ?? null)) return;
    await fetch(`/api/sessions/${session.id}/nickname`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
    });
  }

  function handleNameKey(e) {
    if (e.key === 'Enter') saveNickname();
    if (e.key === 'Escape') setEditingName(false);
  }

  // Escape to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleKill() {
    if (!canKill || killing) return;
    setKilling(true);
    try {
      await fetch(`/api/sessions/${session.id}/kill`, { method: 'POST' });
    } finally {
      setKilling(false);
    }
  }

  async function handleFork() {
    if (!session.cwd || forking) return;
    setForking(true);
    setForkDone(false);
    try {
      const res = await fetch('/api/sessions/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: session.cwd }),
      });
      if (res.ok) {
        setForkDone(true);
        setTimeout(() => setForkDone(false), 2500);
      }
    } finally {
      setForking(false);
    }
  }

  const children = allSessions.filter(s => s.parent_session_id === session.id);
  const hasTree = children.length > 0 || !!session.parent_session_id;

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#21262d] flex-shrink-0 bg-[#161b22]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: color,
              boxShadow: (session.status === 'active' || isWaiting) ? `0 0 8px ${color}` : 'none',
            }}
          />
          <div className="min-w-0">
            {/* Editable nickname / folder name */}
            <div className="flex items-center gap-1.5 group/name">
              {editingName ? (
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={saveNickname}
                  onKeyDown={handleNameKey}
                  placeholder={folderName}
                  className="bg-transparent border-b border-[#58a6ff] text-sm font-medium text-[#e6edf3] outline-none placeholder-[#484f58] w-48"
                />
              ) : (
                <>
                  <span className="text-sm font-semibold text-[#e6edf3] truncate">{displayName}</span>
                  <button
                    onClick={startEditName}
                    title="Rename session"
                    className="opacity-0 group-hover/name:opacity-100 p-0.5 rounded text-[#484f58] hover:text-[#8b949e] transition-all flex-shrink-0"
                  >
                    <Pencil size={10} />
                  </button>
                </>
              )}
            </div>
            {session.cwd && (
              <div className="flex items-center gap-1 text-[11px] text-[#8b949e] truncate mt-0.5">
                <Terminal size={10} />
                <span className="truncate font-mono">{session.cwd}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-3">
          {session.cwd && session.status !== 'ended' && (
            <button
              onClick={handleFork}
              disabled={forking || forkDone}
              title="Fork: open a new Claude session in the same directory"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-transparent transition-colors disabled:cursor-default ${
                forkDone
                  ? 'text-[#3fb950] bg-[#3fb950]/10 border-[#3fb950]/20'
                  : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1c2128] hover:border-[#30363d] disabled:opacity-50'
              }`}
            >
              <GitFork size={12} />
              {forking ? 'Forking…' : forkDone ? 'Launched — check sidebar' : 'Fork'}
            </button>
          )}
          {canKill && (
            <button
              onClick={handleKill}
              disabled={killing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-[#f85149] hover:bg-[#f85149]/10 border border-transparent hover:border-[#f85149]/20 transition-colors disabled:opacity-50"
            >
              <Square size={12} />
              {killing ? 'Killing…' : 'Kill'}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[#1c2128] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Meta row ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-[#21262d] flex-shrink-0 bg-[#161b22]/60 text-xs text-[#8b949e] flex-wrap">
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>{elapsed}</span>
        </div>
        <span className="capitalize font-medium" style={{ color }}>
          {statusLabel(session.status, isWaiting)}
        </span>
        {session.agent_type === 'subagent' && (
          <div className="flex items-center gap-1 text-[#58a6ff]">
            <GitBranch size={10} />
            <span>sub-agent</span>
          </div>
        )}
        {session.current_tool && (
          <div className="font-mono text-[#58a6ff] bg-[#58a6ff]/10 px-1.5 py-0.5 rounded-md">
            {session.current_tool}
          </div>
        )}
      </div>

      {/* ── Scrollable content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
        <section>
          <h3 className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-widest mb-3">
            Todos
          </h3>
          <TodoList todos={session.todos || []} />
        </section>

        <section>
          <h3 className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-widest mb-3">
            Activity
          </h3>
          <ActivityLog events={session.recentEvents || []} />
        </section>

        {hasTree && (
          <section>
            <h3 className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-widest mb-3">
              Agent Tree
            </h3>
            <SubAgentTree session={session} allSessions={allSessions} />
          </section>
        )}

        <section>
          <h3 className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-widest mb-3">
            Conversation
          </h3>
          <TranscriptView entries={session.transcript || []} />
        </section>
      </div>
    </div>
  );
}
