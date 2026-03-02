import React, { useState } from 'react';
import { Bell, CheckSquare, Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react';
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
      <header className="flex-shrink-0 border-b border-[#21262d] bg-[#010409] z-40">
        <div className="h-12 px-4 flex items-center justify-between">

          {/* Left: wordmark + live status */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#e6edf3] tracking-tight">
              Claude Dashboard
            </span>
            <span className="text-[#21262d]">·</span>
            <div className="flex items-center gap-1">
              {connected ? (
                <>
                  <Wifi size={11} className="text-[#3fb950]" />
                  <span className="text-[11px] text-[#3fb950] font-medium">live</span>
                </>
              ) : (
                <>
                  <WifiOff size={11} className="text-[#f85149]" />
                  <span className="text-[11px] text-[#f85149] font-medium">disconnected</span>
                </>
              )}
            </div>
            {activeCount > 0 && (
              <span className="text-[11px] text-[#8b949e]">
                {activeCount} active
              </span>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1">
            {/* Pending approvals badge */}
            {pendingApprovalCount > 0 && (
              <div className="flex items-center gap-1 bg-[#d29922]/10 border border-[#d29922]/25 px-2 py-1 rounded-md text-[11px] text-[#d29922] font-medium mr-2">
                <CheckSquare size={11} />
                {pendingApprovalCount} pending
              </div>
            )}

            {/* Notifications */}
            <button
              onClick={onNotificationsClick}
              title="Notifications"
              className="relative p-2 rounded-md text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1c2128] transition-colors"
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#f85149] text-white text-[8px] rounded-full w-3 h-3 flex items-center justify-center font-bold leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              title="Re-sync sessions from filesystem"
              className="p-2 rounded-md text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1c2128] transition-colors"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>

            {/* New Session */}
            <button
              onClick={() => setShowLaunch(true)}
              title="Launch a new Claude session"
              className="flex items-center gap-1.5 ml-1 px-3 py-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] text-xs font-medium text-white transition-colors"
            >
              <Plus size={13} />
              New Session
            </button>
          </div>
        </div>
      </header>
      {showLaunch && <LaunchSessionModal onClose={() => setShowLaunch(false)} />}
    </>
  );
}
