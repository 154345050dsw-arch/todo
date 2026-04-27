import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowRightCircle,
  Bell,
  BellRing,
  CheckCircle2,
  X,
  XCircle,
} from 'lucide-react';

const NOTIFICATION_ICONS = {
  task_remind: BellRing,
  task_completed: CheckCircle2,
  task_cancel_requested: XCircle,
  task_transferred: ArrowRightCircle,
  complete_confirm: CheckCircle2,
  cancel_confirm: XCircle,
  task_timeout: AlertTriangle,
};

export function ToastMessage({ message }) {
  if (!message) return null;
  return createPortal(
    <div className="fixed right-6 top-6 z-[120] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-2.5 text-[14px] font-medium text-[var(--app-text)] shadow-[0_12px_36px_rgba(15,23,42,0.16)]">
      {message}
    </div>,
    document.body
  );
}

function Toast({ notification, onClose, onOpenTask }) {
  const IconComponent = NOTIFICATION_ICONS[notification.notification_type] || BellRing;
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 200);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  function handleClick() {
    onOpenTask(notification);
    onClose();
  }

  function handleClose(event) {
    event.stopPropagation();
    onClose();
  }

  return createPortal(
    <div
      onClick={handleClick}
      className={`fixed right-4 top-4 z-[60] w-[360px] cursor-pointer rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_18px_48px_rgba(15,23,42,0.18)] transition-all duration-200 ${
        isLeaving ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-slideInRight'
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === 'Enter' && handleClick()}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="grid size-9 place-items-center rounded-[10px] bg-[var(--app-primary-soft)] text-[var(--app-primary)]">
          <IconComponent size={16} strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-[var(--app-text)]">{notification.title}</span>
            <button
              type="button"
              onClick={handleClose}
              className="grid size-7 place-items-center rounded-[6px] text-[var(--app-subtle)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-muted)]"
              aria-label="关闭通知"
            >
              <X size={14} strokeWidth={1.6} />
            </button>
          </div>
          <div className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--app-muted)]">{notification.content}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ToastContainer({ toasts, onClose, onOpenTask }) {
  return (
    <div className="fixed right-4 top-4 z-[60] flex flex-col gap-3">
      {toasts.map((notification) => (
        <Toast key={notification.id} notification={notification} onClose={() => onClose(notification.id)} onOpenTask={onOpenTask} />
      ))}
    </div>
  );
}

export function NotificationMenu({ open, data, onToggle, onOpenTask, formatActivityTime }) {
  const items = data?.results || [];
  const unreadCount = data?.unread_count || 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="relative grid size-10 place-items-center rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)] transition-all hover:border-[var(--app-primary)]/30 hover:text-[var(--app-text)] hover:shadow-[var(--shadow-sm)]"
        aria-label="查看通知"
      >
        <Bell size={17} strokeWidth={1.6} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[var(--app-primary)] px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-[360px] overflow-hidden rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_18px_48px_rgba(15,23,42,0.18)] animate-slideDown">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
            <div>
              <div className="text-[15px] font-semibold text-[var(--app-text)]">站内通知</div>
              <div className="text-[12px] text-[var(--app-muted)]">{unreadCount ? `${unreadCount} 条未读` : '暂无未读'}</div>
            </div>
            <BellRing size={16} className="text-[var(--app-muted)]" strokeWidth={1.6} />
          </div>
          <div className="max-h-[420px] overflow-y-auto p-1.5">
            {items.length ? items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenTask(item)}
                className="w-full rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-[var(--app-panel-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!item.is_read && <span className="size-1.5 rounded-full bg-[var(--app-primary)]" />}
                      <span className="text-[14px] font-semibold text-[var(--app-text)]">{item.title}</span>
                    </div>
                    <div className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-[var(--app-muted)]">{item.content}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-[var(--app-subtle)]">{formatActivityTime(item.created_at)}</span>
                </div>
              </button>
            )) : (
              <div className="px-4 py-8 text-center text-[13px] text-[var(--app-muted)]">暂无通知</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
