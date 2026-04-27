import { BarChart3, Building2, Settings2, Users } from 'lucide-react';

export default function WorkspaceSidebar({
  navGroups,
  dashboard,
  workspaceMode,
  scope,
  onSelectTaskScope,
  onOpenOverview,
  onOpenOrganization,
  user,
}) {
  return (
    <aside className="border-r border-[var(--app-border)] bg-[var(--app-bg)] p-5">
      <div className="mb-6 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-[var(--app-text)] text-sm font-semibold text-[var(--app-panel)]">F</span>
          <div>
            <div className="text-[15px] font-semibold">FlowDesk</div>
            <div className="text-xs text-[var(--app-muted)]">任务流转工作区</div>
          </div>
        </a>
      </div>

      <div className="space-y-5">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-subtle)]">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const count = dashboard[item.countKey] ?? 0;
                const isSelected = workspaceMode === 'tasks' && scope === item.key;
                const shouldShowCount = item.alwaysShowCount || count > 0;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSelectTaskScope(item.key)}
                    className={`relative flex h-10 w-full items-center justify-between rounded-[8px] px-4 text-left text-[14px] transition-all duration-200 ${
                      isSelected
                        ? 'bg-[var(--app-panel)] font-medium text-[var(--app-text)] shadow-[var(--shadow-border)]'
                        : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'
                    }`}
                  >
                    {isSelected && <span className="nav-selected-left" />}
                    <span className="flex min-w-0 items-center gap-3">
                      <item.icon size={15} strokeWidth={1.5} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {shouldShowCount && (
                      <span
                        className={`ml-3 min-w-[24px] rounded-full px-2 py-0.5 text-center text-[12px] font-medium tabular-nums transition ${
                          isSelected
                            ? 'bg-[var(--app-primary)] text-white'
                            : 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-[var(--app-border)] pt-5">
        <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--app-subtle)]">统计</div>
        <button
          type="button"
          onClick={onOpenOverview}
          className={`relative flex h-11 w-full items-center gap-3 rounded-[10px] px-4 text-left text-[15px] transition-all duration-200 ${
            workspaceMode === 'overview'
              ? 'bg-[var(--app-panel)] font-medium text-[var(--app-text)] shadow-[var(--shadow-border)]'
              : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'
          }`}
        >
          {workspaceMode === 'overview' && <span className="nav-selected-left" />}
          <BarChart3 size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>任务总览</span>
        </button>
        {[
          ['人员统计', Users],
          ['部门统计', Building2],
        ].map(([label, Icon]) => (
          <button key={label} type="button" className="flex h-11 w-full items-center gap-3 rounded-[10px] px-4 text-left text-[15px] text-[var(--app-muted)] transition-all duration-200 hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]">
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {user?.is_super_admin || user?.is_department_manager ? (
        <div className="mt-6 border-t border-[var(--app-border)] pt-5">
          <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--app-subtle)]">管理</div>
          <button
            type="button"
            onClick={onOpenOrganization}
            className={`relative flex h-11 w-full items-center gap-3 rounded-[10px] px-4 text-left text-[15px] transition-all duration-200 ${
              workspaceMode === 'organization'
                ? 'bg-[var(--app-panel)] font-medium text-[var(--app-text)] shadow-[var(--shadow-border)]'
                : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'
            }`}
          >
            {workspaceMode === 'organization' && <span className="nav-selected-left" />}
            <Settings2 size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>组织管理</span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}
