import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

function formatInput(toolInput) {
  if (!toolInput) return null;
  try {
    const obj = typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput;
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(toolInput);
  }
}

export default function ApprovalModal({ approval, session, onApprove, onDeny }) {
  const [showInput, setShowInput] = useState(true);
  const [denyReason, setDenyReason] = useState('');
  const [showDenyForm, setShowDenyForm] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !showDenyForm) onDeny('Dismissed');
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !showDenyForm) onApprove();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showDenyForm, onApprove, onDeny]);

  const formattedInput = formatInput(approval.tool_input);
  const shortSession = approval.session_id ? approval.session_id.slice(0, 8) : '?';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#161b22] border border-[#d29922]/60 rounded-xl w-full max-w-lg shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#30363d]">
            <ShieldAlert size={20} className="text-[#d29922] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#e6edf3]">Tool Approval Required</div>
              <div className="text-xs text-[#8b949e] font-mono mt-0.5">session: {shortSession}</div>
            </div>
          </div>

          {/* Tool name */}
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-[#8b949e]">Tool:</span>
              <span className="font-mono text-[#f85149] bg-[#f85149]/10 px-2 py-0.5 rounded border border-[#f85149]/20">
                {approval.tool_name}
              </span>
            </div>

            {/* Tool input */}
            {formattedInput && (
              <div className="mb-4">
                <button
                  onClick={() => setShowInput(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3] mb-1.5 transition-colors"
                >
                  {showInput ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Input
                </button>
                {showInput && (
                  <pre className="bg-[#0d1117] border border-[#30363d] rounded p-3 text-xs font-mono text-[#e6edf3] overflow-auto max-h-40 whitespace-pre-wrap break-all">
                    {formattedInput}
                  </pre>
                )}
              </div>
            )}

            {/* Deny form */}
            {showDenyForm ? (
              <div className="mb-4">
                <label className="block text-xs text-[#8b949e] mb-1">Deny reason (optional)</label>
                <textarea
                  autoFocus
                  value={denyReason}
                  onChange={e => setDenyReason(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onDeny(denyReason);
                    if (e.key === 'Escape') setShowDenyForm(false);
                  }}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded p-2 text-sm text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-[#f85149] resize-none h-20"
                  placeholder="Optional: explain why this was denied…"
                />
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 px-5 pb-5">
            {!showDenyForm ? (
              <>
                <button
                  onClick={onApprove}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#3fb950] hover:bg-[#3fb950]/80 text-[#0d1117] font-semibold py-2.5 rounded-lg transition-colors text-sm"
                >
                  <Check size={15} />
                  Approve
                  <span className="text-xs opacity-60 ml-1">⌘↵</span>
                </button>
                <button
                  onClick={() => setShowDenyForm(true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#f85149]/10 hover:bg-[#f85149]/20 text-[#f85149] border border-[#f85149]/30 font-semibold py-2.5 rounded-lg transition-colors text-sm"
                >
                  <X size={15} />
                  Deny
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onDeny(denyReason)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#f85149] hover:bg-[#f85149]/80 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
                >
                  <X size={15} />
                  Confirm Deny
                </button>
                <button
                  onClick={() => setShowDenyForm(false)}
                  className="flex items-center justify-center px-4 py-2.5 rounded-lg border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors text-sm"
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          <div className="px-5 pb-4 text-xs text-[#8b949e] text-center">
            Claude is blocked and waiting for your decision.
            {!showDenyForm && ' Press Esc to deny.'}
          </div>
        </div>
      </div>
    </>
  );
}
