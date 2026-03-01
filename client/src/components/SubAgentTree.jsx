import React from 'react';
import { GitBranch, Circle } from 'lucide-react';

function statusColor(status) {
  switch (status) {
    case 'active': return '#3fb950';
    case 'idle': return '#d29922';
    case 'ended': return '#8b949e';
    default: return '#8b949e';
  }
}

function AgentNode({ session, allSessions, depth = 0 }) {
  const children = allSessions.filter(s => s.parent_session_id === session.id);
  const color = statusColor(session.status);
  const shortId = session.id ? session.id.slice(0, 8) : '????????';

  return (
    <div className={depth > 0 ? 'ml-5 border-l border-[#30363d] pl-3' : ''}>
      <div className="flex items-center gap-2 py-1">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-mono text-xs text-[#e6edf3]">{shortId}</span>
        {session.agent_type === 'subagent' && (
          <GitBranch size={11} className="text-[#58a6ff]" />
        )}
        <span className="text-xs capitalize" style={{ color }}>{session.status}</span>
        {session.current_tool && (
          <span className="text-xs font-mono text-[#58a6ff] bg-[#58a6ff]/10 px-1 rounded truncate max-w-24">
            {session.current_tool}
          </span>
        )}
      </div>
      {children.map(child => (
        <AgentNode key={child.id} session={child} allSessions={allSessions} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function SubAgentTree({ session, allSessions }) {
  const children = allSessions.filter(s => s.parent_session_id === session.id);
  if (!children.length && !session.parent_session_id) {
    return <p className="text-[#8b949e] text-sm italic">No sub-agents</p>;
  }

  // Find root of tree
  let root = session;
  while (root.parent_session_id) {
    const parent = allSessions.find(s => s.id === root.parent_session_id);
    if (!parent) break;
    root = parent;
  }

  return (
    <div>
      <AgentNode session={root} allSessions={allSessions} depth={0} />
    </div>
  );
}
