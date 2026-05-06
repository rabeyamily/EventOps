'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Notification } from '@/lib/api/notifications';
import { Spinner } from '@/components/ui';

const TYPE_LABELS: Record<Notification['type'], string> = {
  strike_warning: 'Strike Warning',
  strike_blocked: 'Strike Blocked',
  event_reminder: 'Event Reminder',
  attendance_alert: 'Attendance Alert',
  system: 'System',
};

const TYPE_COLORS: Record<Notification['type'], string> = {
  strike_warning: 'bg-yellow-100 text-yellow-800',
  strike_blocked: 'bg-red-100 text-red-800',
  event_reminder: 'bg-blue-100 text-blue-800',
  attendance_alert: 'bg-orange-100 text-orange-800',
  system: 'bg-gray-100 text-gray-700',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Keep dropdown fully inside viewport on every breakpoint.
  useEffect(() => {
    if (!open) return;

    const VIEWPORT_GUTTER = 8;
    const PANEL_MAX_WIDTH = 384; // 24rem
    const GAP_FROM_HEADER = 8;

    const updatePosition = () => {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const headerRect = buttonRef.current.closest('header')?.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const width = Math.min(PANEL_MAX_WIDTH, Math.max(280, viewportWidth - VIEWPORT_GUTTER * 2));

      // Prefer right-edge alignment with bell, then clamp to viewport.
      let left = rect.right - width;
      left = Math.max(VIEWPORT_GUTTER, Math.min(left, viewportWidth - width - VIEWPORT_GUTTER));

      setPanelStyle({
        position: 'fixed',
        top: `${(headerRect?.bottom ?? rect.bottom) + GAP_FROM_HEADER}px`,
        left: `${left}px`,
        width: `${width}px`,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) markAsRead(n.id);
  };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          style={panelStyle}
          className="bg-white rounded-xl shadow-xl border border-gray-200 z-50 flex flex-col max-h-[32rem] overflow-hidden"
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {unreadCount} new
                </span>
              )}
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs text-primary-600 hover:text-primary-800 font-medium transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="sm" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <svg
                  className="h-10 w-10 text-gray-300 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`group flex items-start gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors ${
                      n.isRead ? 'bg-white hover:bg-gray-50' : 'bg-primary-50/40 hover:bg-primary-50/70'
                    }`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    {/* Unread dot */}
                    <div className="mt-1.5 flex-shrink-0">
                      {n.isRead ? (
                        <div className="h-2 w-2 rounded-full bg-transparent" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-primary-600" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${n.isRead ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                          {n.title}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                          aria-label="Delete notification"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{n.message}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[n.type]}`}>
                          {TYPE_LABELS[n.type]}
                        </span>
                        <span className="text-[10px] text-gray-400">{formatRelativeTime(n.createdAt)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
              <p className="text-xs text-gray-400 text-center">Showing last {notifications.length} notifications</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
