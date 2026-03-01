import React, { useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

function OutcomeIcon({ outcome }) {
  switch (outcome) {
    case 'success':
      return <CheckCircle2 size={12} className="text-[#3fb950] flex-shrink-0" />;
    case 'denied':
      return <XCircle size={12} className="text-[#f85149] flex-shrink-0" />;
    default:
      return <Clock size={12} className="text-[#d29922] flex-shrink-0 animate-pulse" />;
  }
}

function formatTime(ts) {
  if (!ts) return '';
  const s = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
  return new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncate(str, max = 120) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

function formatInput(toolInput) {
  if (!toolInput) return null;
  try {
    const obj = typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput;
    // Show the most relevant field
    if (obj.command) return truncate(obj.command);
    if (obj.file_path) return truncate(obj.file_path);
    if (obj.path) return truncate(obj.path);
    if (obj.notebook_path) return truncate(obj.notebook_path);
    if (obj.pattern) return truncate(obj.pattern);
    if (obj.prompt) return truncate(obj.prompt);
    if (obj.query) return truncate(obj.query);
    return truncate(JSON.stringify(obj));
  } catch {
    return truncate(String(toolInput));
  }
}

export default function ActivityLog({ events = [] }) {
  const bottomRef = useRef(null);

  if (!events.length) {
    return <p className="text-[#8b949e] text-sm italic">No activity yet</p>;
  }

  return (
    <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
      {[...events].reverse().map((event, i) => {
        const input = formatInput(event.tool_input);
        return (
          <div
            key={event.id || i}
            className="flex items-start gap-2 text-xs py-1 border-b border-[#30363d]/50 last:border-0"
          >
            <OutcomeIcon outcome={event.outcome} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#58a6ff] font-medium">{event.tool_name}</span>
                {event.started_at && (
                  <span className="text-[#8b949e] text-[10px]">{formatTime(event.started_at)}</span>
                )}
              </div>
              {input && (
                <div className="font-mono text-[#8b949e] truncate mt-0.5">{input}</div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
