import { useState } from 'react';
import { Tooltip } from '../../../shared/components/Tooltip.jsx';
import {
  AlertTriangle,
  BellRing,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock,
  Clock3,
  ListChecks,
  Sun,
  Timer,
  User,
  X,
} from 'lucide-react';

function getFirstRelatedPerson(task, user, displayUser) {
  if (!user) return displayUser(task.owner);
  if (task.owner?.id === user.id) return displayUser(task.creator);
  if (task.creator?.id === user.id) return displayUser(task.owner) || '待分配';
  return displayUser(task.owner);
}

function TaskCardFrame({ children, onOpen, className = '' }) {
  function handleKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpen();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={`${className} cursor-pointer outline-none focus:border-[var(--app-primary)]/30 focus:ring-2 focus:ring-[var(--app-primary)]/10`}
    >
      {children}
    </div>
  );
}

function RemindActionButton({ task, onRemind, label, user, canRemindTask, isTaskOverdue, reminderButtonLabel }) {
  const check = canRemindTask(task, user);
  if (!onRemind) return null;
  const disabled = !check.can;
  const overdue = isTaskOverdue(task);

  return (
    <Tooltip content={disabled ? check.reason : null}>
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          if (disabled) return;
          event.preventDefault();
          event.stopPropagation();
          onRemind(task);
        }}
        className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors ${
          disabled
            ? 'cursor-not-allowed border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-subtle)] opacity-60'
            : overdue
              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
              : 'border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)] hover:border-[var(--app-primary)]/30 hover:text-[var(--app-primary)]'
        }`}
      >
        <BellRing size={13} strokeWidth={1.6} />
        {label || reminderButtonLabel(task)}
      </button>
    </Tooltip>
  );
}

export { RemindActionButton };

function TaskCard({
  task,
  onOpen,
  onRemind,
  user,
  scope,
  showPrefixIcon,
  dimmed,
  Tooltip,
  canRemindTask,
  isTaskOverdue,
  reminderButtonLabel,
  dueMeta,
  displayUser,
  statusTextClass,
  statusLabels,
  formatActivityTime,
}) {
  const isLimitedView = task.is_limited_view;
  const hasReminder = (task.reminder_count || 0) > 0;
  const isOverdue = isTaskOverdue(task);

  // ========== 责任人显示逻辑 ==========
  const getOwnerDisplay = () => {
    // 待处理/处理中状态且无责任人 → 显示待处理人（candidate_owners）
    if (['todo', 'in_progress'].includes(task.status) && !task.owner) {
      if (task.candidate_owners?.length > 0) {
        const names = task.candidate_owners.map(displayUser);
        if (names.length <= 2) return names.join(' / ');
        return `${names.slice(0, 2).join(' / ')} 等${names.length}人`;
      }
      return '待分配';
    }
    return getFirstRelatedPerson(task, user, displayUser);
  };

  // ========== 状态行内容 ==========
  const getStatusRowContent = () => {
    if ((scope === 'cancel_pending' || scope === 'cancelled') && task.cancel_reason) {
      return (
        <span className={scope === 'cancel_pending' ? 'text-yellow-600 dark:text-yellow-400' : 'text-[var(--app-muted)]'}>
          取消原因：{task.cancel_reason}
        </span>
      );
    }
    if (hasReminder) {
      return (
        <span className="text-orange-500 dark:text-orange-400">
          已催办 {task.reminder_count} 次
          {task.latest_reminder_at && (
            <span className="text-[var(--app-subtle)]"> · 最近 {formatActivityTime(task.latest_reminder_at)}</span>
          )}
        </span>
      );
    }
    return null;
  };

  // ========== 状态标签 ==========
  const getStatusLabel = () => {
    let baseLabel = statusLabels[task.status];
    if (hasReminder) {
      return `${baseLabel}-催办`;
    }
    return baseLabel;
  };

  const getStatusClass = () => {
    if (isOverdue) {
      return 'text-red-500';
    }
    if (hasReminder) {
      return 'text-orange-500 dark:text-orange-400';
    }
    return statusTextClass(task.status);
  };

  // ========== 卡片样式：超时红、催办橙、完成绿 ==========
  const cardBaseClass = isOverdue && !isLimitedView
    ? 'border-[var(--app-border)] bg-red-100/60 dark:bg-red-500/15'
    : task.status === 'done'
      ? 'border-[var(--app-border)] bg-emerald-50/50 dark:bg-emerald-500/10'
      : hasReminder && !isLimitedView
        ? 'border-[var(--app-border)] bg-orange-100/60 dark:bg-orange-500/15'
        : 'border-[var(--app-border)] bg-[var(--app-panel)]';

  return (
    <TaskCardFrame
      onOpen={() => onOpen(task.id)}
      className={`group rounded-[12px] border ${cardBaseClass} p-4 text-left transition-all duration-200 hover:border-[var(--app-primary)]/20 hover:shadow-[var(--shadow-md)] ${dimmed ? 'opacity-60' : ''}`}
    >
      {/* ===== 第1行：标题 + 催办按钮（垂直居中对齐） ===== */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[15px] font-semibold leading-snug text-[var(--app-text)]">
          {showPrefixIcon === 'done' && <span className="text-green-500 mr-1.5">✓</span>}
          {showPrefixIcon === 'cancelled' && <span className="text-[var(--app-muted)] mr-1.5">✕</span>}
          {task.title}
        </span>
        {isLimitedView ? (
          // 预留催办按钮空间，保持卡片高度一致
          <div className="h-7 w-[72px]" />
        ) : (
          <RemindActionButton
            task={task}
            onRemind={onRemind}
            user={user}
            Tooltip={Tooltip}
            canRemindTask={canRemindTask}
            isTaskOverdue={isTaskOverdue}
            reminderButtonLabel={reminderButtonLabel}
          />
        )}
      </div>

      {/* ===== 第2行：责任人（单独一行） ===== */}
      <div className="mt-2.5 flex items-center gap-1.5 text-[13px] text-[var(--app-muted)]">
        <User size={14} strokeWidth={1.5} className="text-[var(--app-subtle)]" />
        <span className="truncate">{getOwnerDisplay()}</span>
        {/* 状态标签 inline */}
        <span className={`ml-auto shrink-0 text-[11px] ${getStatusClass()}`}>
          {getStatusLabel()}
        </span>
      </div>

      {/* ===== 第3行：时间信息（deadline + 耗时 + 处理时间） ===== */}
      <div className="mt-2 flex items-center gap-2 text-[13px] text-[var(--app-muted)]">
        {/* 截止时间 */}
        <span className={`flex items-center gap-1 ${dueMeta(task).className}`}>
          <Calendar size={12} strokeWidth={1.5} className="text-[var(--app-subtle)]" />
          <span>{dueMeta(task).label}</span>
        </span>
        <span className="text-[var(--app-subtle)]">·</span>
        {/* 当前耗时 */}
        <span className="flex items-center gap-1 tabular-nums">
          <Clock size={12} strokeWidth={1.5} className="text-[var(--app-subtle)]" />
          <span>{task.current_duration_hours}h</span>
        </span>
        {/* 处理时间 */}
        {task.processing_duration_hours && (
          <>
            <span className="text-[var(--app-subtle)]">·</span>
            <span className="flex items-center gap-1 tabular-nums">
              <Timer size={12} strokeWidth={1.5} className="text-[var(--app-subtle)]" />
              <span>{task.processing_duration_hours}h</span>
            </span>
          </>
        )}
        {/* 高优先级 */}
        {task.priority === 'high' && scope !== 'done' && scope !== 'cancelled' && (
          <>
            <span className="text-[var(--app-subtle)]">·</span>
            <span className="flex items-center gap-1 text-red-500">
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>高优先</span>
            </span>
          </>
        )}
      </div>

      {/* ===== 第4行：催办信息或取消原因（预留空间） ===== */}
      <div className="mt-2 h-[16px] text-[11px] leading-[16px] truncate">
        {!isLimitedView && getStatusRowContent()}
      </div>
    </TaskCardFrame>
  );
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const futureGroupConfigs = [
  { key: 'tomorrow', label: '明天', Icon: Sun, colorClass: 'text-orange-500' },
  { key: 'this_week', label: '本周', Icon: Calendar, colorClass: 'text-blue-500' },
  { key: 'next_week', label: '下周', Icon: CalendarDays, colorClass: 'text-indigo-500' },
  { key: 'later', label: '更晚', Icon: Clock, colorClass: 'text-[var(--app-muted)]' },
  { key: 'no_due', label: '无截止时间', Icon: CircleDot, colorClass: 'text-[var(--app-subtle)]' },
];

function futureGroupKey(task, taskDueDateKey, dateKey, dateFromKey) {
  if (!task?.due_at) return 'no_due';

  const today = dateFromKey(dateKey(new Date()));
  const due = dateFromKey(taskDueDateKey(task));
  const diffDays = Math.round((due - today) / 86400000);
  if (diffDays === 1) return 'tomorrow';

  const daysUntilSunday = (7 - today.getDay()) % 7;
  const endOfThisWeek = addDays(today, daysUntilSunday);
  if (due <= endOfThisWeek) return 'this_week';

  const endOfNextWeek = addDays(endOfThisWeek, 7);
  if (due <= endOfNextWeek) return 'next_week';

  return 'later';
}

function compareTasksByDue(left, right) {
  // 催办优先：相同截止时间时，催办的排前面
  const leftHasReminder = (left.reminder_count || 0) > 0;
  const rightHasReminder = (right.reminder_count || 0) > 0;

  const leftDue = left.due_at ? new Date(left.due_at).getTime() : Infinity;
  const rightDue = right.due_at ? new Date(right.due_at).getTime() : Infinity;

  // 截止时间相同时，催办优先
  if (leftDue === rightDue) {
    if (leftHasReminder !== rightHasReminder) {
      return leftHasReminder ? -1 : 1;
    }
    // 都有催办或都没催办，按更新时间
    return new Date(right.updated_at || 0) - new Date(left.updated_at || 0);
  }

  // 无截止时间的排后面
  if (!left.due_at && !right.due_at) {
    return new Date(right.updated_at || 0) - new Date(left.updated_at || 0);
  }
  if (!left.due_at) return 1;
  if (!right.due_at) return -1;

  // 按截止时间升序
  return leftDue - rightDue;
}

function groupFutureTasks(tasks, taskDueDateKey, dateKey, dateFromKey) {
  const grouped = Object.fromEntries(futureGroupConfigs.map((group) => [group.key, []]));
  tasks.forEach((task) => {
    grouped[futureGroupKey(task, taskDueDateKey, dateKey, dateFromKey)].push(task);
  });
  futureGroupConfigs.forEach((group) => {
    grouped[group.key].sort(compareTasksByDue);
  });
  return futureGroupConfigs.map((group) => ({ ...group, tasks: grouped[group.key] }));
}

const COLUMN_EXPAND_KEY = 'flowdesk_column_expand_state';

function loadColumnExpandState() {
  try {
    const stored = localStorage.getItem(COLUMN_EXPAND_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

function saveColumnExpandState(state) {
  try {
    localStorage.setItem(COLUMN_EXPAND_KEY, JSON.stringify(state));
  } catch {}
}

function useColumnExpand(viewKey, defaultState) {
  const [expanded, setExpanded] = useState(() => {
    const saved = loadColumnExpandState();
    if (saved?.[viewKey]) return saved[viewKey];
    return defaultState;
  });

  const toggle = (columnKey) => {
    setExpanded((prev) => {
      const next = { ...prev, [columnKey]: !prev[columnKey] };
      const allState = loadColumnExpandState() || {};
      saveColumnExpandState({ ...allState, [viewKey]: next });
      return next;
    });
  };

  return { expanded, toggle };
}

function FutureTaskBoard(props) {
  const { tasks, onOpen, onRemind, user, taskDueDateKey, dateKey, dateFromKey } = props;
  const groups = groupFutureTasks(tasks, taskDueDateKey, dateKey, dateFromKey);
  const { expanded, toggle } = useColumnExpand('future', {
    tomorrow: true,
    this_week: true,
    next_week: true,
    later: true,
    no_due: true,
  });

  return (
    <div className="flex gap-5 overflow-x-auto pb-4">
      {groups.filter((g) => g.tasks.length > 0).map((group) => {
        const isExpanded = expanded[group.key];

        return (
          <div key={group.key} className="flex min-w-[290px] max-w-[330px] flex-1 flex-col">
            <button
              type="button"
              onClick={() => toggle(group.key)}
              className="flex items-center gap-2.5 px-1 py-2.5 mb-3 w-full text-left hover:opacity-80 transition-opacity"
            >
              <group.Icon size={16} strokeWidth={1.5} className={group.colorClass} />
              <span className="text-[15px] font-medium">{group.label}</span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums bg-[var(--app-panel-soft)] text-[var(--app-muted)]">
                {group.tasks.length}
              </span>
              <span className="ml-auto text-[var(--app-muted)]">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>

            {isExpanded && (
              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto rounded-[12px] bg-[var(--app-bg)]/50 p-2.5">
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={onOpen}
                    onRemind={onRemind}
                    user={user}
                    scope="future"
                    {...props}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TaskBoard(props) {
  const { tasks, onOpen, onRemind, scope, user, isTaskOverdue } = props;
  if (scope === 'future') {
    return <FutureTaskBoard {...props} tasks={tasks} onOpen={onOpen} onRemind={onRemind} user={user} />;
  }

  const singleStatusScopes = {
    done: { Icon: CheckCircle2, label: '已完成', colorClass: 'text-green-500' },
    cancelled: { Icon: X, label: '已取消', colorClass: 'text-[var(--app-muted)]' },
    overdue: { Icon: AlertTriangle, label: '超时任务', colorClass: 'text-red-500' },
  };

  if (singleStatusScopes[scope]) {
    const config = singleStatusScopes[scope];
    const dimmed = scope === 'done' || scope === 'cancelled';
    const showPrefixIcon = scope === 'done' ? 'done' : scope === 'cancelled' ? 'cancelled' : null;
    const isActive = scope === 'overdue';
    const { expanded, toggle } = useColumnExpand('single', { [scope]: true });
    const isExpanded = expanded[scope];

    return (
      <div className="flex gap-5 overflow-x-auto pb-4">
        <div className="flex min-w-[290px] max-w-[330px] flex-1 flex-col">
          <button
            type="button"
            onClick={() => toggle(scope)}
            className="flex items-center gap-2.5 px-1 py-2.5 mb-3 w-full text-left hover:opacity-80 transition-opacity"
          >
            <config.Icon size={16} strokeWidth={1.5} className={config.colorClass} />
            <span className="text-[15px] font-medium">{config.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
              isActive
                ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                : 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
            }`}>
              {tasks.length}
            </span>
            <span className="ml-auto text-[var(--app-muted)]">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>

          {isExpanded && (
            <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto rounded-[12px] bg-[var(--app-bg)]/50 p-2.5">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={onOpen}
                  onRemind={onRemind}
                  user={user}
                  scope={scope}
                  showPrefixIcon={showPrefixIcon}
                  dimmed={dimmed}
                  {...props}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const columnHeaders = [
    { key: 'todo', label: '待处理', Icon: ListChecks },
    { key: 'in_progress', label: '处理中', Icon: Clock3 },
    { key: 'overdue', label: '已超时', Icon: AlertTriangle },
    { key: 'confirming', label: '待确认', Icon: ClipboardCheck },
  ];

  const { expanded, toggle } = useColumnExpand('kanban', {
    todo: true,
    in_progress: true,
    overdue: true,
    confirming: true,
  });

  return (
    <div className="flex gap-5 overflow-x-auto pb-4">
      {columnHeaders.map((col) => {
        const colTasks = tasks.filter((task) => {
          if (col.key === 'overdue') return isTaskOverdue(task);
          if (col.key === 'confirming') return task.status === 'confirming' || task.status === 'cancel_pending';
          // 非 overdue 列：只显示匹配状态且未超时的任务（超时任务只在 overdue 列显示）
          return task.status === col.key && !isTaskOverdue(task);
        });
        const isActive = col.key === 'overdue' || col.key === 'confirming';
        const isExpanded = expanded[col.key];

        return (
          <div key={col.key} className="flex min-w-[290px] max-w-[330px] flex-1 flex-col">
            <button
              type="button"
              onClick={() => toggle(col.key)}
              className="flex items-center gap-2.5 px-1 py-2.5 mb-3 w-full text-left hover:opacity-80 transition-opacity"
            >
              <col.Icon size={16} strokeWidth={1.5} className={isActive ? (col.key === 'overdue' ? 'text-red-500' : 'text-amber-500') : 'text-[var(--app-muted)]'} />
              <span className="text-[15px] font-medium">{col.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                isActive
                  ? (col.key === 'overdue' ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400')
                  : 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
              }`}>
                {colTasks.length}
              </span>
              <span className="ml-auto text-[var(--app-muted)]">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>

            {isExpanded && (
              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto rounded-[12px] bg-[var(--app-bg)]/50 p-2.5">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={onOpen}
                    onRemind={onRemind}
                    user={user}
                    scope={col.key}
                    {...props}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
