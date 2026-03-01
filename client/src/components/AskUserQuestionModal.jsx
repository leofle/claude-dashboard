import React, { useState, useEffect } from 'react';
import { HelpCircle, Check } from 'lucide-react';

function QuestionBlock({ question, selected, onSelect }) {
  const isMulti = question.multiSelect;

  function toggleOption(label) {
    if (isMulti) {
      const current = Array.isArray(selected) ? selected : [];
      if (current.includes(label)) {
        onSelect(current.filter(l => l !== label));
      } else {
        onSelect([...current, label]);
      }
    } else {
      onSelect(label);
    }
  }

  function isSelected(label) {
    if (isMulti) return Array.isArray(selected) && selected.includes(label);
    return selected === label;
  }

  return (
    <div className="mb-5">
      {question.header && (
        <div className="text-xs font-mono text-[#8b949e] uppercase tracking-wider mb-1">
          {question.header}
        </div>
      )}
      <p className="text-sm text-[#e6edf3] mb-3 leading-relaxed">{question.question}</p>
      <div className="space-y-2">
        {(question.options || []).map((opt) => {
          const sel = isSelected(opt.label);
          return (
            <button
              key={opt.label}
              onClick={() => toggleOption(opt.label)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                sel
                  ? 'border-[#58a6ff] bg-[#58a6ff]/10 text-[#e6edf3]'
                  : 'border-[#30363d] bg-[#0d1117] text-[#8b949e] hover:border-[#58a6ff]/40 hover:text-[#e6edf3]'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-${isMulti ? 'sm' : 'full'} border flex items-center justify-center ${
                  sel ? 'border-[#58a6ff] bg-[#58a6ff]' : 'border-[#484f58]'
                }`}>
                  {sel && <Check size={10} className="text-[#0d1117]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{opt.label}</div>
                  {opt.description && (
                    <div className="text-xs text-[#8b949e] mt-0.5">{opt.description}</div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AskUserQuestionModal({ request, session, onSubmit }) {
  const [selections, setSelections] = useState({});

  const questions = request.questions || [];
  const shortSession = request.session_id ? request.session_id.slice(0, 8) : '?';

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onSubmit(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSubmit]);

  function isComplete() {
    return questions.every(q => {
      const sel = selections[q.question];
      if (q.multiSelect) return Array.isArray(sel) && sel.length > 0;
      return !!sel;
    });
  }

  function handleSubmit() {
    if (!isComplete()) return;
    const answers = {};
    for (const q of questions) {
      const sel = selections[q.question];
      answers[q.question] = Array.isArray(sel) ? sel.join(', ') : sel;
    }
    onSubmit({ answers, annotations: {} });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#161b22] border border-[#58a6ff]/40 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#30363d] flex-shrink-0">
            <HelpCircle size={18} className="text-[#58a6ff] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#e6edf3]">Claude is asking…</div>
              <div className="text-xs text-[#8b949e] font-mono mt-0.5">session: {shortSession}</div>
            </div>
          </div>

          {/* Questions */}
          <div className="px-5 pt-4 pb-2 overflow-y-auto flex-1">
            {questions.map((q) => (
              <QuestionBlock
                key={q.question}
                question={q}
                selected={selections[q.question]}
                onSelect={(val) => setSelections(prev => ({ ...prev, [q.question]: val }))}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 px-5 pb-5 pt-3 flex-shrink-0 border-t border-[#30363d]">
            <button
              onClick={handleSubmit}
              disabled={!isComplete()}
              className="flex-1 flex items-center justify-center gap-2 bg-[#58a6ff] hover:bg-[#58a6ff]/80
                disabled:opacity-40 disabled:cursor-not-allowed text-[#0d1117] font-semibold py-2.5
                rounded-lg transition-colors text-sm"
            >
              <Check size={15} />
              Submit Answer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
