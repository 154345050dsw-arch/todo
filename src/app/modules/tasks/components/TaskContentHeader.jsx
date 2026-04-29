import {
  AlertTriangle,
  Building2,
  Calendar,
  Globe,
  Network,
  RefreshCw,
  User,
  Users,
} from 'lucide-react';

function HeaderControl({ active, icon: Icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-all ${
        active
          ? 'border-[var(--app-primary)] bg-[var(--app-primary-soft)] text-[var(--app-primary)] shadow-[var(--shadow-border)]'
          : 'border-transparent bg-[var(--app-panel-soft)] text-[var(--app-muted)] hover:bg-[var(--app-panel)] hover:text-[var(--app-text)] hover:shadow-[var(--shadow-border)]'
      }`}
    >
      <Icon size={13} strokeWidth={1.6} />
      <span>{children}</span>
    </button>
  );
}

function SyncIndicator({ syncStatus, lastSyncTime, formatRelativeTime, onRetry }) {
  if (syncStatus === 'syncing') {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--app-panel-soft)] px-3 text-[12px] font-semibold text-[var(--app-muted)]">
        <RefreshCw size={12} className="animate-spin" />
        同步中
      </span>
    );
  }

  if (syncStatus === 'success' && lastSyncTime) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--app-panel-soft)] px-3 text-[12px] font-semibold text-[var(--app-muted)]">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        已同步 · {formatRelativeTime(lastSyncTime)}
      </span>
    );
  }

  if (syncStatus === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
      >
        <AlertTriangle size={12} />
        同步失败 · 重试
      </button>
    );
  }

  return null;
}

export default function TaskContentHeader({
  workspaceMode,
  pageInfo,
  syncStatus,
  lastSyncTime,
  formatRelativeTime,
  onRetry,
  error,
  user,
  dataScope,
  onDataScopeChange,
  filters,
  onFiltersChange,
}) {
  if (workspaceMode !== 'tasks') return null;

  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-[220px] pt-0.5">
        <h1 className="text-[18px] font-semibold leading-tight">{pageInfo.title}</h1>
        <p className="mt-0.5 text-[13px] leading-5 text-[var(--app-muted)]">{pageInfo.subtitle}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
        <SyncIndicator
          syncStatus={syncStatus}
          lastSyncTime={lastSyncTime}
          formatRelativeTime={formatRelativeTime}
          onRetry={onRetry}
        />
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {(user?.is_super_admin || user?.is_department_manager) && (
            <>
              <HeaderControl
                active={dataScope === 'related'}
                icon={User}
                onClick={() => onDataScopeChange('related')}
              >
                仅我相关
              </HeaderControl>
              <HeaderControl
                active={dataScope === 'my_department'}
                icon={Building2}
                onClick={() => onDataScopeChange('my_department')}
              >
                本部门
              </HeaderControl>
              <HeaderControl
                active={dataScope === 'my_department_tree'}
                icon={Network}
                onClick={() => onDataScopeChange('my_department_tree')}
              >
                本部门及下级
              </HeaderControl>
              {user?.is_super_admin && (
                <HeaderControl
                  active={dataScope === 'all_departments'}
                  icon={Globe}
                  onClick={() => onDataScopeChange('all_departments')}
                >
                  全部部门
                </HeaderControl>
              )}
            </>
          )}
          <HeaderControl
            active={filters.mineOnly}
            icon={Users}
            onClick={() => onFiltersChange({ ...filters, mineOnly: !filters.mineOnly })}
          >
            仅我负责
          </HeaderControl>
          <HeaderControl
            active={filters.sortDue}
            icon={Calendar}
            onClick={() => onFiltersChange({ ...filters, sortDue: !filters.sortDue })}
          >
            到期优先
          </HeaderControl>
        </div>
        {error && <span className="inline-flex h-8 items-center rounded-full bg-red-50 px-3 text-[12px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</span>}
      </div>
    </div>
  );
}
