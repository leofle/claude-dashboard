import React, { useEffect, useRef, useState } from 'react';
import { X, FolderOpen, ChevronDown, ChevronUp, GitBranch } from 'lucide-react';

export default function LaunchSessionModal({ onClose }) {
  const [path, setPath] = useState('');
  const [prompt, setPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [useWorktree, setUseWorktree] = useState(false);
  const [worktreeName, setWorktreeName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pathRef = useRef(null);

  useEffect(() => {
    pathRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleLaunch(e) {
    e.preventDefault();
    if (!path.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: path.trim(),
          prompt: prompt.trim() || undefined,
          worktree: useWorktree || undefined,
          worktreeName: (useWorktree && worktreeName.trim()) ? worktreeName.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to spawn session');
        setLoading(false);
        return;
      }
      onClose();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl w-full max-w-md pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
            <span className="text-sm font-semibold text-[#e6edf3]">New Claude Session</span>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleLaunch} className="px-5 py-4 space-y-4">
            {/* Path input */}
            <div>
              <label className="block text-xs text-[#8b949e] mb-1.5">Working Directory</label>
              <div className="flex items-center gap-2">
                <FolderOpen size={14} className="text-[#8b949e] flex-shrink-0" />
                <input
                  ref={pathRef}
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/path/to/project"
                  className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] font-mono focus:outline-none focus:border-[#58a6ff] transition-colors"
                />
              </div>
            </div>

            {/* Git worktree toggle */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useWorktree}
                  onChange={(e) => setUseWorktree(e.target.checked)}
                  className="accent-[#58a6ff]"
                />
                <GitBranch size={13} className="text-[#8b949e]" />
                <span className="text-xs text-[#8b949e]">Create git worktree (isolated branch)</span>
              </label>
              {useWorktree && (
                <input
                  type="text"
                  value={worktreeName}
                  onChange={(e) => setWorktreeName(e.target.value)}
                  placeholder="Branch name (optional, default: dashboard-timestamp)"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] font-mono focus:outline-none focus:border-[#58a6ff] transition-colors"
                />
              )}
            </div>

            {/* Optional prompt (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowPrompt(v => !v)}
                className="flex items-center gap-1 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
              >
                {showPrompt ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Initial prompt (optional)
              </button>
              {showPrompt && (
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter an initial prompt to send to Claude..."
                  rows={3}
                  className="mt-2 w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors resize-none"
                />
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="text-xs text-[#f85149] bg-[#f85149]/10 border border-[#f85149]/30 rounded px-3 py-2">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded text-sm text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !path.trim()}
                className="px-4 py-1.5 rounded text-sm bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                {loading ? 'Launching...' : 'Launch'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
