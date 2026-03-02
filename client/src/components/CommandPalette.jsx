import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Send } from 'lucide-react';

export default function CommandPalette({ sessions, onClose }) {
  const [input, setInput] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const activeSessions = sessions
    .filter(s => s.status !== 'ended')
    .sort((a, b) => new Date(b.last_seen_at || 0) - new Date(a.last_seen_at || 0));

  useEffect(() => {
    if (activeSessions.length > 0) setSelectedId(activeSessions[0].id);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function send() {
    if (!input.trim()) { setError('Type a message first.'); return; }
    if (!selectedId) { setError('Select a session first.'); return; }
    setError('');
    try {
      const res = await fetch(`/api/sessions/${selectedId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSent(true);
      setTimeout(onClose, 900);
    } catch (err) {
      setError('Failed to send: ' + err.message);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); send(); }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl px-6">
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden">

          {/* Session selector */}
          {activeSessions.length !== 1 && (
            <div className="px-6 pt-5 pb-1">
              {activeSessions.length === 0 ? (
                <p className="text-sm text-[#8b949e] pb-1">No active sessions</p>
              ) : (
                <select
                  value={selectedId}
                  onChange={e => { setSelectedId(e.target.value); setError(''); }}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-[#e6edf3] px-4 py-2.5 outline-none focus:border-[#58a6ff] cursor-pointer"
                >
                  <option value="">Select a session…</option>
                  {activeSessions.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      {i === 0 ? '★ ' : ''}{s.id.slice(0, 8)} — {s.cwd || 'unknown'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center gap-4 px-6 py-5">
            <Terminal size={18} className="text-[#58a6ff] flex-shrink-0" />
            <input
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder={sent ? 'Message sent!' : 'Send a message to Claude…'}
              disabled={sent || activeSessions.length === 0}
              className="flex-1 bg-transparent text-[#e6edf3] text-base placeholder-[#484f58] outline-none disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={sent || activeSessions.length === 0}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#58a6ff]/10 text-[#58a6ff] hover:bg-[#58a6ff]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              <Send size={14} />
              Send
            </button>
          </div>

          {/* Error or footer */}
          <div className="px-6 pb-4 flex items-center gap-4 text-xs">
            {error ? (
              <span className="text-[#f85149]">{error}</span>
            ) : (
              <>
                <span className="text-[#484f58]"><kbd className="border border-[#30363d] rounded px-1.5 py-0.5">↵</kbd> send</span>
                <span className="text-[#484f58]"><kbd className="border border-[#30363d] rounded px-1.5 py-0.5">esc</kbd> close</span>
                <span className="ml-auto text-[#484f58]">Delivered at next tool call</span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
