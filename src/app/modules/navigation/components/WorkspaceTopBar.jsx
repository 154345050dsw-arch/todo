import { Check, ChevronDown, Globe, Moon, Plus, Search, Sun, X } from 'lucide-react';

import { NotificationMenu } from '../../notifications/components/NotificationCenter.jsx';

export default function WorkspaceTopBar({
  onSearchOpen,
  notificationsOpen,
  notifications,
  onToggleNotifications,
  onOpenNotificationTask,
  onMarkAllRead,
  formatActivityTime,
  onCreate,
  createButtonRef,
  user,
  userMenuOpen,
  onToggleUserMenu,
  displayUser,
  theme,
  setTheme,
  onLogout,
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-bg)] px-6">
      <button
        type="button"
        onClick={onSearchOpen}
        className="relative flex h-10 w-[400px] items-center gap-3 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] px-4 text-left text-[15px] transition-all duration-200 hover:border-[var(--app-primary)]/30 hover:shadow-[var(--shadow-sm)]"
        aria-label="打开任务搜索"
      >
        <Search size={16} className="text-[var(--app-muted)]" strokeWidth={1.5} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[var(--app-muted)]">搜索任务、人员、部门</span>
        <kbd className="hidden rounded-[6px] bg-[var(--app-panel-soft)] px-2 py-1 text-[12px] font-medium text-[var(--app-subtle)] sm:inline">⌘K</kbd>
      </button>

      <div className="flex items-center gap-3">
        <NotificationMenu
          open={notificationsOpen}
          data={notifications}
          onToggle={onToggleNotifications}
          onOpenTask={onOpenNotificationTask}
          onMarkAllRead={onMarkAllRead}
          formatActivityTime={formatActivityTime}
        />

        <button
          ref={createButtonRef}
          type="button"
          onClick={onCreate}
          className="flex h-10 items-center gap-2 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white transition-all duration-200 hover:bg-[var(--app-primary-strong)] hover:shadow-[0_2px_8px_rgba(91,127,199,0.15)]"
        >
          <Plus size={16} strokeWidth={2} />
          新建
          <kbd className="rounded-[6px] bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 text-[11px] font-medium">N</kbd>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={onToggleUserMenu}
            className="flex h-10 items-center gap-2.5 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 text-[15px] transition-all duration-200 hover:border-[var(--app-primary)]/30 hover:shadow-[var(--shadow-sm)]"
          >
            <div className="grid size-7 place-items-center rounded-[8px] bg-[var(--app-text)] text-xs font-semibold text-[var(--app-panel)]">
              {user.first_name?.[0] || user.username?.[0] || 'U'}
            </div>
            <span className="max-w-[80px] truncate font-medium">{displayUser(user)}</span>
            <ChevronDown size={14} className={`text-[var(--app-muted)] transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-12 z-30 w-52 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-1.5 shadow-[var(--shadow-xl)] animate-slideDown">
              <div className="mb-1.5 px-3 py-2.5">
                <div className="text-[15px] font-semibold">{displayUser(user)}</div>
                <div className="text-xs text-[var(--app-muted)]">{user.username}</div>
              </div>
              <div className="border-t border-[var(--app-border)] py-1">
                {[
                  ['system', '跟随系统', Globe],
                  ['light', '亮色模式', Sun],
                  ['dark', '暗色模式', Moon],
                ].map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={`flex h-10 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-[15px] transition-colors ${theme === value ? 'bg-[var(--app-panel-soft)] font-medium text-[var(--app-text)]' : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'}`}
                  >
                    <Icon size={16} strokeWidth={1.5} />
                    {label}
                    {theme === value && <Check size={16} className="ml-auto text-[var(--app-primary)]" strokeWidth={2} />}
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--app-border)] py-1">
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex h-10 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-[15px] text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <X size={16} strokeWidth={1.5} />
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
