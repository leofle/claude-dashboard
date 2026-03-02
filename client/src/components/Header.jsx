import React, { useState } from 'react';
import { Activity, Bell, CheckSquare, Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import LaunchSessionModal from './LaunchSessionModal.jsx';

export default function Header({
  connected,
  activeCount,
  unreadCount,
  pendingApprovalCount,
  onNotificationsClick,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [showLaunch, setShowLaunch] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await fetch('/api/sessions/refresh', { method: 'POST' });
    setTimeout(() => setRefreshing(false), 800);
  }
  return (
    <>
    <header className="border-b border-[#30363d] bg-[#161b22] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: title + status */}
        <div className="flex items-center gap-3">
          <span className="text-xl font-semibold text-[#e6edf3] tracking-tight">
            🤖 Claude Dashboard
          </span>
          <div className="flex items-center gap-1.5">
            {connected ? (
              <>
                <Wifi size={13} className="text-[#3fb950]" />
                <span className="text-xs text-[#3fb950]">live</span>
              </>
            ) : (
              <>
                <WifiOff size={13} className="text-[#f85149]" />
                <span className="text-xs text-[#f85149]">disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* Right: counts + buttons */}
        <div className="flex items-center gap-3">
          {/* Active sessions count */}
          <div className="flex items-center gap-1.5 text-sm text-[#8b949e]">
            <Activity size={14} className={activeCount > 0 ? 'text-[#3fb950]' : 'text-[#8b949e]'} />
            <span className={activeCount > 0 ? 'text-[#e6edf3]' : ''}>
              {activeCount} active
            </span>
          </div>

          {/* Pending approvals badge */}
          {pendingApprovalCount > 0 && (
            <div className="flex items-center gap-1.5 bg-[#d29922]/20 border border-[#d29922]/40 px-2 py-1 rounded text-xs text-[#d29922]">
              <CheckSquare size={12} />
              {pendingApprovalCount} pending approval{pendingApprovalCount !== 1 ? 's' : ''}
            </div>
          )}

          {/* New Session button */}
          <button
            onClick={() => setShowLaunch(true)}
            title="Launch a new Claude session"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-sm text-white transition-colors"
          >
            <Plus size={14} />
            <span>New Session</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            title="Re-sync all sessions from server"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0d1117] border border-[#30363d] hover:border-[#58a6ff] text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {/* Notifications button */}
          <button
            onClick={onNotificationsClick}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0d1117] border border-[#30363d] hover:border-[#58a6ff] text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          >
            <Bell size={14} />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#f85149] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-mono leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
    {showLaunch && <LaunchSessionModal onClose={() => setShowLaunch(false)} />}
  </>
  );
}
