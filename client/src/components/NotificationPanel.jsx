import React from 'react';
import { X, Bell, CheckCheck } from 'lucide-react';

function typeStyle(type) {
  switch (type) {
    case 'error': return 'border-l-[#f85149] text-[#f85149]';
    case 'warning': return 'border-l-[#d29922] text-[#d29922]';
    case 'success': return 'border-l-[#3fb950] text-[#3fb950]';
    default: return 'border-l-[#58a6ff] text-[#58a6ff]';
  }
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function NotificationPanel({ notifications, sessions, onMarkRead, onClose }) {
  const unread = notifications.filter(n => !n.read_at);
  const read = notifications.filter(n => n.read_at);

  function getSessionLabel(session_id) {
    if (!session_id) return null;
    return session_id.slice(0, 8);
  }

  return (
    <div className="mb-6 bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-[#8b949e]" />
          <span className="font-semibold text-sm">Notifications</span>
          {unread.length > 0 && (
            <span className="bg-[#f85149] text-white text-xs rounded-full px-1.5 py-0.5 font-mono">
              {unread.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Notifications list */}
      <div className="max-h-80 overflow-y-auto divide-y divide-[#30363d]">
        {notifications.length === 0 && (
          <div className="py-8 text-center text-[#8b949e] text-sm">No notifications</div>
        )}

        {notifications.map(n => (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-4 py-3 border-l-2 ${typeStyle(n.notification_type)} ${
              n.read_at ? 'opacity-50' : ''
            }`}
          >
            <div className="flex-1 min-w-0">
              {n.title && (
                <div className="text-xs font-semibold text-[#e6edf3] mb-0.5">{n.title}</div>
              )}
              <div className="text-sm text-[#e6edf3] leading-snug">{n.message}</div>
              <div className="flex items-center gap-3 mt-1 text-xs text-[#8b949e]">
                {n.session_id && (
                  <span className="font-mono">{getSessionLabel(n.session_id)}</span>
                )}
                <span>{formatTime(n.created_at)}</span>
              </div>
            </div>
            {!n.read_at && (
              <button
                onClick={() => onMarkRead(n.id)}
                className="flex-shrink-0 p-1 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-[#3fb950] transition-colors mt-0.5"
                title="Mark as read"
              >
                <CheckCheck size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
