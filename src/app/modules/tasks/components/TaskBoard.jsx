import { useState } from 'react';
import { Tooltip } from '../../../shared/components/Tooltip.jsx';
import {
  BellRing,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Timer,
  User,
} from 'lucide-react';
import { taskDisplayStatus } from '../utils/taskUtils.js';

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

const columnVisuals = {
  todo: {
    dot: 'bg-amber-500',
    panel: 'border-amber-200/60 bg-amber-50/50 dark:border-amber-500/15 dark:bg-amber-500/10',
    header: 'bg-amber-100/80 text-amber-900 ring-1 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/20',
    count: 'bg-amber-200/70 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
  },
  in_progress: {
    dot: 'bg-sky-500',
    panel: 'border-sky-200/60 bg-sky-50/50 dark:border-sky-500/15 dark:bg-sky-500/10',
    header: 'bg-sky-100/80 text-sky-900 ring-1 ring-sky-200/70 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-500/20',
    count: 'bg-sky-200/70 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100',
  },
  overdue: {
    dot: 'bg-red-500',
    panel: 'border-red-200/60 bg-red-50/55 dark:border-red-500/15 dark:bg-red-500/10',
    header: 'bg-red-100/85 text-red-900 ring-1 ring-red-200/70 dark:bg-red-500/15 dark:text-red-100 dark:ring-red-500/20',
    count: 'bg-red-200/80 text-red-900 dark:bg-red-500/20 dark:text-red-100',
  },
  confirming: {
    dot: 'bg-orange-500',
    panel: 'border-orange-200/60 bg-orange-50/50 dark:border-orange-500/15 dark:bg-orange-500/10',
    header: 'bg-orange-100/80 text-orange-900 ring-1 ring-orange-200/70 dark:bg-orange-500/15 dark:text-orange-100 dark:ring-orange-500/20',
    count: 'bg-orange-200/70 text-orange-900 dark:bg-orange-500/20 dark:text-orange-100',
  },
  done: {
    dot: 'bg-emerald-500',
    panel: 'border-emerald-200/60 bg-emerald-50/45 dark:border-emerald-500/15 dark:bg-emerald-500/10',
    header: 'bg-emerald-100/80 text-emerald-900 ring-1 ring-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/20',
    count: 'bg-emerald-200/70 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100',
  },
  cancelled: {
    dot: 'bg-stone-400',
    panel: 'border-stone-200/70 bg-stone-100/55 dark:border-stone-500/15 dark:bg-stone-500/10',
    header: 'bg-stone-200/70 text-stone-800 ring-1 ring-stone-300/60 dark:bg-stone-500/15 dark:text-stone-100 dark:ring-stone-500/20',
    count: 'bg-stone-300/70 text-stone-800 dark:bg-stone-500/20 dark:text-stone-100',
  },
  tomorrow: {
    dot: 'bg-orange-500',
    panel: 'border-orange-200/55 bg-orange-50/45 dark:border-orange-500/15 dark:bg-orange-500/10',
    header: 'bg-orange-100/75 text-orange-900 ring-1 ring-orange-200/70 dark:bg-orange-500/15 dark:text-orange-100 dark:ring-orange-500/20',
    count: 'bg-orange-200/70 text-orange-900 dark:bg-orange-500/20 dark:text-orange-100',
  },
  this_week: {
    dot: 'bg-sky-500',
    panel: 'border-sky-200/55 bg-sky-50/45 dark:border-sky-500/15 dark:bg-sky-500/10',
    header: 'bg-sky-100/75 text-sky-900 ring-1 ring-sky-200/70 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-500/20',
    count: 'bg-sky-200/70 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100',
  },
  next_week: {
    dot: 'bg-indigo-500',
    panel: 'border-indigo-200/55 bg-indigo-50/45 dark:border-indigo-500/15 dark:bg-indigo-500/10',
    header: 'bg-indigo-100/75 text-indigo-900 ring-1 ring-indigo-200/70 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-500/20',
    count: 'bg-indigo-200/70 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-100',
  },
  later: {
    dot: 'bg-stone-400',
    panel: 'border-stone-200/65 bg-stone-100/45 dark:border-stone-500/15 dark:bg-stone-500/10',
    header: 'bg-stone-200/65 text-stone-800 ring-1 ring-stone-300/60 dark:bg-stone-500/15 dark:text-stone-100 dark:ring-stone-500/20',
    count: 'bg-stone-300/70 text-stone-800 dark:bg-stone-500/20 dark:text-stone-100',
  },
  no_due: {
    dot: 'bg-zinc-400',
    panel: 'border-zinc-200/65 bg-zinc-100/45 dark:border-zinc-500/15 dark:bg-zinc-500/10',
    header: 'bg-zinc-200/65 text-zinc-800 ring-1 ring-zinc-300/60 dark:bg-zinc-500/15 dark:text-zinc-100 dark:ring-zinc-500/20',
    count: 'bg-zinc-300/70 text-zinc-800 dark:bg-zinc-500/20 dark:text-zinc-100',
  },
  default: {
    dot: 'bg-[var(--app-subtle)]',
    panel: 'border-[var(--app-border)] bg-[var(--app-panel-soft)]',
    header: 'bg-[var(--app-panel)] text-[var(--app-text)] ring-1 ring-[var(--app-border)]',
    count: 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]',
  },
};

function getColumnVisual(key) {
  return columnVisuals[key] || columnVisuals.default;
}

function statusChipClass(status, isOverdue) {
  if (isOverdue) {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
  }

  const classes = {
    todo: 'border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-500/20 dark:bg-stone-500/10 dark:text-stone-300',
    in_progress: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
    confirming: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300',
    cancel_pending: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300',
    done: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    cancelled: 'border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-500/20 dark:bg-stone-500/10 dark:text-stone-300',
  };

  return classes[status] || classes.todo;
}

function TaskPropertyChip({ Icon, children, className = '' }) {
  return (
    <span className={`inline-flex h-6 max-w-full items-center gap-1.5 rounded-md bg-[var(--app-bg)] px-2 text-[12px] font-medium text-[var(--app-muted)] ring-1 ring-[var(--app-border)] dark:bg-white/[0.03] ${className}`}>
      <Icon size={12} strokeWidth={1.6} className="shrink-0 opacity-70" />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

function formatHourValue(value) {
  if (value === null || value === undefined || value === '') return '0h';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return `${value}h`;
  const normalized = Number.isInteger(numberValue) ? numberValue : Number(numberValue.toFixed(1));
  return `${normalized}h`;
}

function RemindActionButton({ task, onRemind, label, user, canRemindTask, isTaskOverdue, reminderButtonLabel }) {
  const check = canRemindTask(task, user);
  if (!onRemind) return null;
  const disabled = !check.can;
  const overdue = isTaskOverdue(task);
  const hasReminder = (task.reminder_count || 0) > 0;

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
        className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors ${
          disabled
            ? 'cursor-not-allowed border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-subtle)] opacity-60'
            : overdue
              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
              : hasReminder
                ? 'border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300'
                : 'border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-primary)]'
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
  dimmed,
  canRemindTask,
  isTaskOverdue,
  reminderButtonLabel,
  dueMeta,
  displayUser,
  statusLabels,
  formatActivityTime,
}) {
  const isLimitedView = task.is_limited_view;
  const hasReminder = (task.reminder_count || 0) > 0;
  const isOverdue = isTaskOverdue(task);
  const due = dueMeta(task);
  const displayStatus = taskDisplayStatus(task);

  const getOwnerDisplay = () => {
    if (task.assignments?.length > 1) {
      const names = task.assignments.map((assignment) => displayUser(assignment.assignee));
      return names.length <= 2 ? names.join(' / ') : `${names.slice(0, 2).join(' / ')} 等${names.length}人`;
    }
    if (['todo', 'in_progress'].includes(displayStatus) && !task.owner) {
      if (task.candidate_owners?.length > 0) {
        const names = task.candidate_owners.map(displayUser);
        if (names.length <= 2) return names.join(' / ');
        return `${names.slice(0, 2).join(' / ')} 等${names.length}人`;
      }
      return '待分配';
    }
    return getFirstRelatedPerson(task, user, displayUser);
  };

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

  const cardBaseClass = isOverdue && !isLimitedView
    ? 'border-red-200/70 bg-red-50/90 dark:border-red-500/20 dark:bg-red-500/10'
    : displayStatus === 'done'
      ? 'border-emerald-100/80 bg-white/75 dark:border-emerald-500/15 dark:bg-[var(--app-panel)]'
      : displayStatus === 'cancelled'
        ? 'border-stone-200/70 bg-white/60 dark:border-stone-500/15 dark:bg-[var(--app-panel)]'
        : hasReminder && !isLimitedView
          ? 'border-orange-200/70 bg-orange-50/80 dark:border-orange-500/20 dark:bg-orange-500/10'
          : 'border-[var(--app-border)] bg-[var(--app-panel)]';
  const visibleStatus = isOverdue && !isLimitedView ? 'overdue' : displayStatus;
  const statusLabel = statusLabels[visibleStatus] || statusLabels[task.status] || task.status;
  const statusRowContent = !isLimitedView ? getStatusRowContent() : null;

  return (
    <TaskCardFrame
      onOpen={() => onOpen(task.id)}
      className={`group min-h-[136px] rounded-[12px] border ${cardBaseClass} p-3.5 text-left shadow-[0_1px_1px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[var(--app-primary)] hover:shadow-[var(--shadow-md)] ${dimmed ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start gap-2">
        <FileText size={15} strokeWidth={1.6} className={`mt-0.5 shrink-0 ${isOverdue && !isLimitedView ? 'text-red-400' : 'text-[var(--app-subtle)]'}`} />
        <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug text-[var(--app-text)]">
          {task.title}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex h-6 items-center rounded-md border px-2 text-[12px] font-semibold ${statusChipClass(visibleStatus, isOverdue && !isLimitedView)}`}>
          {statusLabel}
        </span>
        {hasReminder && !isLimitedView && (
          <span className="inline-flex h-6 items-center rounded-md border border-orange-200 bg-orange-50 px-2 text-[12px] font-semibold text-orange-600 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
            已催办 {task.reminder_count} 次
          </span>
        )}
        {task.priority === 'high' && scope !== 'done' && scope !== 'cancelled' && (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 text-[12px] font-semibold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <span className="size-1.5 rounded-full bg-red-500" />
            高优先
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <TaskPropertyChip Icon={Calendar} className={due.className}>
          {due.label}
        </TaskPropertyChip>
        <TaskPropertyChip Icon={User}>
          {getOwnerDisplay()}
        </TaskPropertyChip>
        <TaskPropertyChip Icon={Clock}>
          {formatHourValue(task.current_duration_hours)}
        </TaskPropertyChip>
        {task.processing_duration_hours && (
          <TaskPropertyChip Icon={Timer}>
            {formatHourValue(task.processing_duration_hours)}
          </TaskPropertyChip>
        )}
      </div>

      {!isLimitedView && (
        <div className="mt-3 flex items-center gap-2 border-t border-[var(--app-border)] pt-2.5">
          <div className="min-w-0 flex-1 truncate text-[12px] leading-5 text-[var(--app-subtle)]">
            {statusRowContent}
          </div>
          <RemindActionButton
            task={task}
            onRemind={onRemind}
            user={user}
            canRemindTask={canRemindTask}
            isTaskOverdue={isTaskOverdue}
            reminderButtonLabel={reminderButtonLabel}
          />
        </div>
      )}
    </TaskCardFrame>
  );
}

function BoardColumn({ columnKey, label, count, expanded, onToggle, children }) {
  const visual = getColumnVisual(columnKey);

  return (
    <div className={`flex min-w-[292px] max-w-[340px] flex-1 flex-col rounded-[12px] border p-2.5 ${visual.panel}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`mb-2 flex h-8 w-full items-center gap-2 rounded-[9px] px-2.5 text-left text-[13px] font-semibold transition-opacity hover:opacity-90 ${visual.header}`}
      >
        <span className={`size-2.5 shrink-0 rounded-full ${visual.dot}`} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${visual.count}`}>
          {count}
        </span>
        <span className="text-current opacity-60">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const futureGroupConfigs = [
  { key: 'tomorrow', label: '明天' },
  { key: 'this_week', label: '本周' },
  { key: 'next_week', label: '下周' },
  { key: 'later', label: '更晚' },
  { key: 'no_due', label: '无截止时间' },
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
  const leftHasReminder = (left.reminder_count || 0) > 0;
  const rightHasReminder = (right.reminder_count || 0) > 0;

  const leftDue = left.due_at ? new Date(left.due_at).getTime() : Infinity;
  const rightDue = right.due_at ? new Date(right.due_at).getTime() : Infinity;

  if (leftDue === rightDue) {
    if (leftHasReminder !== rightHasReminder) {
      return leftHasReminder ? -1 : 1;
    }
    return new Date(right.updated_at || 0) - new Date(left.updated_at || 0);
  }

  if (!left.due_at && !right.due_at) {
    return new Date(right.updated_at || 0) - new Date(left.updated_at || 0);
  }
  if (!left.due_at) return 1;
  if (!right.due_at) return -1;

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
  const { tasks, taskDueDateKey, dateKey, dateFromKey } = props;
  const groups = groupFutureTasks(tasks, taskDueDateKey, dateKey, dateFromKey);
  const { expanded, toggle } = useColumnExpand('future', {
    tomorrow: true,
    this_week: true,
    next_week: true,
    later: true,
    no_due: true,
  });

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-4">
      {groups.filter((group) => group.tasks.length > 0).map((group) => {
        const isExpanded = expanded[group.key];

        return (
          <BoardColumn
            key={group.key}
            columnKey={group.key}
            label={group.label}
            count={group.tasks.length}
            expanded={isExpanded}
            onToggle={() => toggle(group.key)}
          >
            {group.tasks.map((task) => (
              <TaskCard
                key={task.id}
                {...props}
                task={task}
                scope="future"
              />
            ))}
          </BoardColumn>
        );
      })}
    </div>
  );
}

export default function TaskBoard(props) {
  const { tasks, scope, isTaskOverdue } = props;
  if (scope === 'future') {
    return <FutureTaskBoard {...props} tasks={tasks} />;
  }

  const singleStatusScopes = {
    done: { label: '已完成', visualKey: 'done' },
    cancelled: { label: '已取消', visualKey: 'cancelled' },
    overdue: { label: '超时任务', visualKey: 'overdue' },
  };

  if (singleStatusScopes[scope]) {
    const config = singleStatusScopes[scope];
    const dimmed = scope === 'done' || scope === 'cancelled';
    const { expanded, toggle } = useColumnExpand('single', { [scope]: true });
    const isExpanded = expanded[scope];

    return (
      <div className="flex items-start gap-4 overflow-x-auto pb-4">
        <BoardColumn
          columnKey={config.visualKey}
          label={config.label}
          count={tasks.length}
          expanded={isExpanded}
          onToggle={() => toggle(scope)}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              {...props}
              task={task}
              scope={scope}
              dimmed={dimmed}
            />
          ))}
        </BoardColumn>
      </div>
    );
  }

  const columnHeaders = [
    { key: 'todo', label: '待处理' },
    { key: 'in_progress', label: '处理中' },
    { key: 'overdue', label: '已超时' },
    { key: 'confirming', label: '待确认' },
  ];

  const { expanded, toggle } = useColumnExpand('kanban', {
    todo: true,
    in_progress: true,
    overdue: true,
    confirming: true,
  });

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-4">
      {columnHeaders.map((col) => {
        const colTasks = tasks.filter((task) => {
          const displayStatus = taskDisplayStatus(task);
          if (col.key === 'overdue') return isTaskOverdue(task);
          if (col.key === 'confirming') return task.status === 'confirming' || task.status === 'cancel_pending';
          return displayStatus === col.key && !isTaskOverdue(task);
        });
        const isExpanded = expanded[col.key];

        return (
          <BoardColumn
            key={col.key}
            columnKey={col.key}
            label={col.label}
            count={colTasks.length}
            expanded={isExpanded}
            onToggle={() => toggle(col.key)}
          >
            {colTasks.map((task) => (
              <TaskCard
                key={task.id}
                {...props}
                task={task}
                scope={col.key}
              />
            ))}
          </BoardColumn>
        );
      })}
    </div>
  );
}
