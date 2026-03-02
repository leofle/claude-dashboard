import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, User, Bot } from 'lucide-react';

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

// Very light inline code / bold rendering — avoids a full markdown dep
function renderText(text) {
  if (!text) return null;

  // Split on triple-backtick code blocks first
  const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/g;
  const parts = [];
  let last = 0;
  let m;

  while ((m = codeBlockRegex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', content: text.slice(last, m.index) });
    parts.push({ type: 'code_block', content: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last) });

  return parts.map((part, i) => {
    if (part.type === 'code_block') {
      return (
        <pre key={i} className="bg-[#0d1117] border border-[#30363d] rounded p-2 my-1 text-xs font-mono text-[#e6edf3] whitespace-pre-wrap break-all">
          {part.content.trimEnd()}
        </pre>
      );
    }
    // Inline: bold (**text**) and inline code (`code`)
    const inline = part.content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {inline.map((seg, j) => {
          if (seg.startsWith('`') && seg.endsWith('`')) {
            return <code key={j} className="bg-[#0d1117] text-[#f0883e] px-1 rounded text-[11px] font-mono">{seg.slice(1, -1)}</code>;
          }
          if (seg.startsWith('**') && seg.endsWith('**')) {
            return <strong key={j} className="text-[#e6edf3] font-semibold">{seg.slice(2, -2)}</strong>;
          }
          return seg;
        })}
      </span>
    );
  });
}

function ToolUseBlock({ toolUse }) {
  const [open, setOpen] = useState(false);
  const inputStr = toolUse.input
    ? JSON.stringify(toolUse.input, null, 2)
    : '';

  // Pick a key field to preview
  const preview = toolUse.input?.command
    || toolUse.input?.file_path
    || toolUse.input?.path
    || toolUse.input?.pattern
    || toolUse.input?.query
    || toolUse.input?.prompt
    || '';

  return (
    <div className="mt-1 rounded border border-[#30363d] overflow-hidden min-w-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-2 px-2 py-1.5 bg-[#161b22] hover:bg-[#1c2128] transition-colors text-left flex-wrap"
      >
        {open ? <ChevronDown size={11} className="text-[#58a6ff] flex-shrink-0" /> : <ChevronRight size={11} className="text-[#58a6ff] flex-shrink-0" />}
        <span className="font-mono text-[11px] text-[#58a6ff] font-medium">{toolUse.name}</span>
        {preview && !open && (
          <span className="font-mono text-[10px] text-[#8b949e] break-all">{String(preview)}</span>
        )}
      </button>
      {open && inputStr && (
        <pre className="bg-[#0d1117] text-[10px] font-mono text-[#8b949e] p-2 whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
          {inputStr}
        </pre>
      )}
    </div>
  );
}

function TranscriptEntry({ entry }) {
  const isUser = entry.role === 'user';
  const time = formatTime(entry.timestamp);

  return (
    <div className={`flex gap-2.5 overflow-hidden ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
        isUser ? 'bg-[#58a6ff]/20' : 'bg-[#3fb950]/15'
      }`}>
        {isUser
          ? <User size={12} className="text-[#58a6ff]" />
          : <Bot size={12} className="text-[#3fb950]" />
        }
      </div>

      {/* Bubble */}
      <div className={`flex-1 min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className={`text-[10px] font-medium ${isUser ? 'text-[#58a6ff]' : 'text-[#3fb950]'}`}>
            {isUser ? 'You' : 'Claude'}
          </span>
          {time && <span className="text-[10px] text-[#484f58]">{time}</span>}
        </div>

        <div className={`rounded-lg px-3 py-2 text-[13px] leading-relaxed overflow-hidden ${
          isUser
            ? 'bg-[#1f3a5f] text-[#cdd9e5] rounded-tr-sm'
            : 'bg-[#1c2128] text-[#adbac7] rounded-tl-sm'
        }`}>
          {entry.text && (
            <div className="whitespace-pre-wrap break-words">{renderText(entry.text)}</div>
          )}
          {entry.tool_uses?.map((tu, i) => (
            <ToolUseBlock key={i} toolUse={tu} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TranscriptView({ entries = [] }) {
  const bottomRef = useRef(null);

  // Scroll new entries into view as they arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries.length]);

  if (!entries.length) {
    return <p className="text-[#8b949e] text-sm italic">No conversation yet</p>;
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, i) => (
        <TranscriptEntry key={entry.id || i} entry={entry} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
