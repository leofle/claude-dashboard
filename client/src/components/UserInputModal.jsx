import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send } from 'lucide-react';

export default function UserInputModal({ request, session, onSubmit }) {
  const [response, setResponse] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSubmit() {
    if (!response.trim()) return;
    onSubmit(response.trim());
    setResponse('');
  }

  const shortSession = request.session_id ? request.session_id.slice(0, 8) : '?';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#161b22] border border-[#58a6ff]/40 rounded-xl w-full max-w-lg shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#30363d]">
            <MessageSquare size={18} className="text-[#58a6ff] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#e6edf3]">Claude is asking…</div>
              <div className="text-xs text-[#8b949e] font-mono mt-0.5">session: {shortSession}</div>
            </div>
          </div>

          {/* Question */}
          <div className="px-5 pt-4 pb-3">
            <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 mb-4">
              <p className="text-sm text-[#e6edf3] leading-relaxed whitespace-pre-wrap">
                {request.message}
              </p>
            </div>

            {/* Response textarea */}
            <textarea
              ref={textareaRef}
              value={response}
              onChange={e => setResponse(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-[#e6edf3]
                placeholder-[#8b949e] focus:outline-none focus:border-[#58a6ff] resize-none h-28 transition-colors"
              placeholder="Type your response…"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 px-5 pb-5">
            <button
              onClick={handleSubmit}
              disabled={!response.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-[#58a6ff] hover:bg-[#58a6ff]/80
                disabled:opacity-40 disabled:cursor-not-allowed text-[#0d1117] font-semibold py-2.5
                rounded-lg transition-colors text-sm"
            >
              <Send size={14} />
              Send Response
              <span className="text-xs opacity-60 ml-1">⌘↵</span>
            </button>
          </div>

          <div className="px-5 pb-4 text-xs text-[#8b949e] text-center">
            Claude is paused and waiting for your response.
          </div>
        </div>
      </div>
    </>
  );
}
