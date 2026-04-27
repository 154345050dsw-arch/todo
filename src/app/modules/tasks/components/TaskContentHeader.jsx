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
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold">{pageInfo.title}</h1>
        <p className="mt-0.5 text-sm text-[var(--app-muted)]">{pageInfo.subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        {syncStatus === 'syncing' && (
          <span className="flex items-center gap-1.5 text-sm text-[var(--app-muted)]">
            <RefreshCw size={12} className="animate-spin" />
            同步中...
          </span>
        )}
        {syncStatus === 'success' && lastSyncTime && (
          <span className="flex items-center gap-1.5 text-sm text-[var(--app-muted)]">
            <span className="size-2 rounded-full bg-green-500" />
            已同步 · {formatRelativeTime(lastSyncTime)}
          </span>
        )}
        {syncStatus === 'error' && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600"
          >
            <AlertTriangle size={12} />
            同步失败 · 点击重试
          </button>
        )}
        <div className="flex items-center gap-2">
          {(user?.is_super_admin || user?.is_department_manager) && (
            <>
              <button
                type="button"
                onClick={() => onDataScopeChange('related')}
                className={`flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-medium transition ${
                  dataScope === 'related'
                    ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
                    : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-primary)] hover:text-[var(--app-text)]'
                }`}
              >
                <User size={13} />
                仅我相关
              </button>
              <button
                type="button"
                onClick={() => onDataScopeChange('my_department')}
                className={`flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-medium transition ${
                  dataScope === 'my_department'
                    ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
                    : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-primary)] hover:text-[var(--app-text)]'
                }`}
              >
                <Building2 size={13} />
                本部门
              </button>
              <button
                type="button"
                onClick={() => onDataScopeChange('my_department_tree')}
                className={`flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-medium transition ${
                  dataScope === 'my_department_tree'
                    ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
                    : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-primary)] hover:text-[var(--app-text)]'
                }`}
              >
                <Network size={13} />
                本部门及下级
              </button>
              {user?.is_super_admin && (
                <button
                  type="button"
                  onClick={() => onDataScopeChange('all_departments')}
                  className={`flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-medium transition ${
                    dataScope === 'all_departments'
                      ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
                      : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-primary)] hover:text-[var(--app-text)]'
                  }`}
                >
                  <Globe size={13} />
                  全部部门
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => onFiltersChange({ ...filters, mineOnly: !filters.mineOnly })}
            className={`flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-medium transition ${
              filters.mineOnly
                ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
                : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-primary)] hover:text-[var(--app-text)]'
            }`}
          >
            <Users size={13} />
            仅我负责
          </button>
          <button
            type="button"
            onClick={() => onFiltersChange({ ...filters, sortDue: !filters.sortDue })}
            className={`flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-medium transition ${
              filters.sortDue
                ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
                : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-primary)] hover:text-[var(--app-text)]'
            }`}
          >
            <Calendar size={13} />
            到期优先
          </button>
        </div>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
