import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

function TodoIcon({ status }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 size={14} className="text-[#3fb950] flex-shrink-0" />;
    case 'in_progress':
      return <Loader2 size={14} className="text-[#58a6ff] flex-shrink-0 animate-spin" />;
    default:
      return <Circle size={14} className="text-[#30363d] flex-shrink-0" />;
  }
}

function priorityBadge(priority) {
  if (!priority || priority === 'medium') return null;
  const cls =
    priority === 'high'
      ? 'text-[#f85149] border-[#f85149]/30 bg-[#f85149]/10'
      : 'text-[#8b949e] border-[#30363d]';
  return (
    <span className={`text-xs px-1 py-0.5 rounded border font-mono ${cls}`}>{priority}</span>
  );
}

export default function TodoList({ todos = [] }) {
  if (!todos.length) {
    return <p className="text-[#8b949e] text-sm italic">No todos</p>;
  }

  const done = todos.filter(t => t.status === 'completed').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#8b949e]">{done}/{todos.length} completed</span>
        {/* Progress bar */}
        <div className="w-24 h-1 bg-[#30363d] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${todos.length ? Math.round((done / todos.length) * 100) : 0}%`,
              backgroundColor: done === todos.length ? '#3fb950' : '#58a6ff',
            }}
          />
        </div>
      </div>
      <ul className="space-y-1.5">
        {todos.map((todo, i) => (
          <li key={todo.id || i} className="flex items-start gap-2">
            <TodoIcon status={todo.status} />
            <div className="flex-1 min-w-0">
              <span
                className={`text-sm leading-snug ${
                  todo.status === 'completed' ? 'line-through text-[#8b949e]' : 'text-[#e6edf3]'
                }`}
              >
                {todo.content}
              </span>
            </div>
            {priorityBadge(todo.priority)}
          </li>
        ))}
      </ul>
    </div>
  );
}
