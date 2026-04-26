import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Clock3,
  FileCheck2,
  Globe,
  ListChecks,
  Lock,
  Moon,
  Network,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Sun,
  User,
  Users,
  X,
  AlertTriangle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Check,
  Bold,
  Italic,
  ImagePlus,
  Link2,
  List,
  Sparkles,
  ArrowRightLeft,
  Bell,
  BellRing,
  PlayCircle,
  CircleDot,
  XCircle,
  ArrowRightCircle,
} from 'lucide-react';
import { api, getApiBaseUrl, getToken, isDesktopApp, isValidApiBaseUrl, normalizeApiBase, setApiBaseUrl, setToken } from './api.js';
import { useTheme } from './theme.jsx';

const navGroups = [
  {
    title: '任务视图',
    items: [
      { key: 'my_todo', label: '今日待办', icon: ListChecks, countKey: 'my_todo', alwaysShowCount: true },
      { key: 'future', label: '未来任务', icon: Calendar, countKey: 'future', alwaysShowCount: true },
      { key: 'overdue', label: '超时任务', icon: Clock3, countKey: 'overdue', alwaysShowCount: true },
    ],
  },
  {
    title: '我的任务',
    items: [
      { key: 'created', label: '我创建的', icon: FileCheck2, countKey: 'created' },
      { key: 'transferred', label: '我转派的', icon: ArrowRightLeft, countKey: 'transferred' },
      { key: 'participated', label: '我参与的', icon: Users, countKey: 'participated' },
    ],
  },
  {
    title: '归档',
    items: [
      { key: 'done', label: '已完成', icon: CheckCircle2, countKey: 'done' },
      { key: 'cancelled', label: '已取消', icon: X, countKey: 'cancelled' },
    ],
  },
];

// 状态文案统一映射
const statusLabels = {
  todo: '待处理',
  in_progress: '处理中',
  confirming: '待完成确认',
  acceptance: '验收中',
  overdue: '已超时',
  done: '已完成',
  cancel_pending: '待取消确认',
  cancelled: '已取消',
};

const completedStatusTone = 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
const pendingStatusTone = 'border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-500/20 dark:bg-stone-500/10 dark:text-stone-400';
const flowPendingStatusTone = 'border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-500/20 dark:bg-stone-500/10 dark:text-stone-300';

const statusTone = {
  todo: pendingStatusTone,
  in_progress: 'border-indigo-200/60 bg-indigo-50/50 text-indigo-600 dark:border-indigo-500/15 dark:bg-indigo-500/8 dark:text-indigo-400',
  confirming: pendingStatusTone,
  acceptance: 'border-emerald-200/60 bg-emerald-50/50 text-emerald-600 dark:border-emerald-500/15 dark:bg-emerald-500/8 dark:text-emerald-400',
  overdue: 'border-red-200/60 bg-red-50/50 text-red-600 dark:border-red-500/15 dark:bg-red-500/8 dark:text-red-400',
  done: completedStatusTone,
  cancel_pending: 'border-amber-200/60 bg-amber-50/50 text-amber-600 dark:border-amber-500/15 dark:bg-amber-500/8 dark:text-amber-400',
  cancelled: 'border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-500/20 dark:bg-stone-500/10 dark:text-stone-400',
};

// Status text color only (no badge styling)
const statusTextClass = (status) => {
  const classes = {
    todo: 'text-stone-500',
    in_progress: 'text-indigo-500',
    confirming: 'text-blue-500',
    overdue: 'text-red-500',
    done: 'text-emerald-500',
    cancel_pending: 'text-amber-500',
    cancelled: 'text-stone-400',
  };
  return classes[status] || 'text-stone-500';
};

const searchStatusGroups = [
  { key: 'overdue', label: '已超时', Icon: AlertTriangle, className: 'text-red-500' },
  { key: 'todo', label: '待处理', Icon: ListChecks, className: 'text-[var(--app-muted)]' },
  { key: 'in_progress', label: '处理中', Icon: Clock3, className: 'text-[var(--app-muted)]' },
  { key: 'confirming', label: '待确认', Icon: ClipboardCheck, className: 'text-purple-500' },
  { key: 'cancel_pending', label: '待取消确认', Icon: AlertTriangle, className: 'text-yellow-500' },
  { key: 'done', label: '已完成', Icon: CheckCircle2, className: 'text-green-500' },
  { key: 'cancelled', label: '已取消', Icon: X, className: 'text-[var(--app-muted)]' },
];

// Notion风格事件条样式（彩色但不刺眼）
const eventBarStyles = {
  todo: 'bg-zinc-200/70 text-zinc-700 dark:bg-zinc-700/40 dark:text-zinc-300',
  in_progress: 'bg-indigo-200/70 text-indigo-800 dark:bg-indigo-700/40 dark:text-indigo-300',
  confirming: 'bg-blue-200/70 text-blue-800 dark:bg-blue-700/40 dark:text-blue-300',
  acceptance: 'bg-emerald-200/70 text-emerald-800 dark:bg-emerald-700/40 dark:text-emerald-300',
  done: 'bg-emerald-200/70 text-emerald-800 dark:bg-emerald-700/40 dark:text-emerald-300',
  cancel_pending: 'bg-amber-200/70 text-amber-800 dark:bg-amber-700/40 dark:text-amber-300',
  cancelled: 'bg-zinc-200/50 text-zinc-500 dark:bg-zinc-700/30 dark:text-zinc-400',
  overdue: 'bg-red-200/70 text-red-800 dark:bg-red-700/40 dark:text-red-300',
  created: 'bg-blue-200/70 text-blue-800 dark:bg-blue-700/40 dark:text-blue-300',
};

function displayUser(user) {
  return user?.display_name || user?.first_name || user?.username || '-';
}

function sameUser(left, right) {
  return Boolean(left?.id && right?.id && Number(left.id) === Number(right.id));
}

function confirmationUser(task) {
  return task?.confirmer || task?.creator;
}

function isConfirmationUser(task, user) {
  return sameUser(confirmationUser(task), user);
}

function getUserRoles(task, user) {
  const roles = [];
  if (!task || !user) return roles;
  if (sameUser(task.creator, user)) roles.push('creator');
  if (sameUser(task.owner, user)) roles.push('owner');
  if (sameUser(task.confirmer, user)) roles.push('confirmer');
  if (task.participants?.some(p => sameUser(p, user))) roles.push('participant');
  // 转派人角色来自后端返回的 user_roles
  if (task.user_roles?.includes('transferrer')) roles.push('transferrer');
  return roles;
}

function canPerformAction(task, action) {
  // 使用后端返回的权限字段
  const permissionField = `can_${action}`;
  if (task?.[permissionField] !== undefined) {
    return task[permissionField];
  }
  // 兜底逻辑
  return false;
}

function isTaskClosed(task) {
  return ['done', 'cancelled'].includes(task?.status);
}

function reminderTargetForTask(task) {
  if (!task || isTaskClosed(task)) return null;
  if (task.status === 'confirming') return confirmationUser(task);
  if (task.status === 'cancel_pending') return task.creator;
  if (task.owner) return task.owner;
  // 多候选负责人：返回数组
  if (task.candidate_owners?.length > 0) return task.candidate_owners;
  return null;
}

function reminderButtonLabel(task) {
  return ['confirming', 'cancel_pending'].includes(task?.status) ? '催确认' : '催办';
}

function canRemindTask(task, user) {
  if (!task || isTaskClosed(task) || task.is_limited_view) return { can: false, reason: '任务不存在或已关闭' };

  const targets = reminderTargetForTask(task);
  if (!targets) return { can: false, reason: '无明确责任人' };

  // 多候选时，需要至少有一个非自己的目标
  const targetList = Array.isArray(targets) ? targets : [targets];
  const validTargets = targetList.filter((t) => t?.id !== user?.id);
  if (validTargets.length === 0) return { can: false, reason: '不能催办自己' };

  // 检查30分钟频率限制（基于 latest_reminder_at）
  if (task.latest_reminder_at) {
    const lastTime = new Date(task.latest_reminder_at);
    const now = new Date();
    const minutesDiff = (now - lastTime) / (1000 * 60);
    if (minutesDiff < 30) return { can: false, reason: `已在 ${Math.ceil(minutesDiff)} 分钟前催办过`, blockedMinutes: 30 - Math.floor(minutesDiff) };
  }

  return { can: true };
}

function taskDueDateKey(task) {
  return task?.due_at ? dateKey(new Date(task.due_at)) : '';
}

function isTaskDueToday(task) {
  return taskDueDateKey(task) === dateKey(new Date());
}

function isTaskDueAfterToday(task) {
  const dueKey = taskDueDateKey(task);
  return Boolean(dueKey && dueKey > dateKey(new Date()));
}

function isTaskDueBeforeToday(task) {
  const dueKey = taskDueDateKey(task);
  return Boolean(dueKey && dueKey < dateKey(new Date()));
}

function isTaskOverdue(task) {
  return !isTaskClosed(task) && (task?.status === 'overdue' || isTaskDueBeforeToday(task));
}

function searchGroupKey(task) {
  if (isTaskOverdue(task)) return 'overdue';
  return task?.status || 'todo';
}

function groupSearchTasks(tasks) {
  return searchStatusGroups
    .map((group) => ({
      ...group,
      tasks: tasks.filter((task) => searchGroupKey(task) === group.key),
    }))
    .filter((group) => group.tasks.length > 0);
}

function scopeForTask(task, user, currentScope) {
  if (task?.status === 'done') return 'done';
  if (task?.status === 'cancelled') return 'cancelled';
  if (task?.status === 'cancel_pending' && sameUser(task.creator, user)) return 'cancel_pending';
  if (task?.status === 'confirming') return isConfirmationUser(task, user) ? 'confirming' : currentScope;
  if (isTaskOverdue(task)) return 'overdue';
  const needsHandling = task?.can_claim || sameUser(task.owner, user);
  if (!isTaskClosed(task) && needsHandling && isTaskDueToday(task)) return 'my_todo';
  if (!isTaskClosed(task) && (isTaskDueAfterToday(task) || !task?.due_at)) return 'future';
  if (!isTaskClosed(task) && sameUser(task.creator, user)) return 'created';
  if (!isTaskClosed(task) && task?.participants?.some((participant) => sameUser(participant, user))) return 'participated';
  return currentScope;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatFullDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

// Calculate hours remaining until deadline
function calculateHoursRemaining(dueAt) {
  if (!dueAt) return null;
  const now = new Date();
  const due = new Date(dueAt);
  return (due - now) / (1000 * 60 * 60);
}

// Get urgency level and display text for deadline
function getDeadlineUrgency(dueAt, isOverdue) {
  if (!dueAt) return { text: '未设置截止时间', level: 'none', className: 'text-[var(--app-subtle)] bg-[var(--app-panel-soft)]' };

  const hours = calculateHoursRemaining(dueAt);

  if (isOverdue || hours < 0) {
    const overdueHours = Math.abs(hours || 0);
    const days = Math.floor(overdueHours / 24);
    const remainingHours = Math.floor(overdueHours % 24);
    if (days > 0) return { text: `已超时 ${days} 天`, level: 'critical', className: 'text-[#dc2626] bg-red-50 dark:bg-red-500/10 dark:text-red-400' };
    if (remainingHours > 0) return { text: `已超时 ${remainingHours} 小时`, level: 'critical', className: 'text-[#dc2626] bg-red-50 dark:bg-red-500/10 dark:text-red-400' };
    return { text: '已超时', level: 'critical', className: 'text-[#dc2626] bg-red-50 dark:bg-red-500/10 dark:text-red-400' };
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);

  if (days >= 3) return { text: `${days} 天后`, level: 'normal', className: 'text-[var(--app-muted)] bg-[var(--app-panel-soft)]' };
  if (days >= 1) return { text: `${days} 天 ${remainingHours} 小时后`, level: 'warning', className: 'text-[#9a5b13] bg-[#fffaf0] dark:bg-yellow-500/10 dark:text-yellow-400' };
  if (hours >= 1) return { text: `${Math.floor(hours)} 小时后`, level: 'urgent', className: 'text-[#c24141] bg-[#fff7f7] dark:bg-red-500/15 dark:text-red-300' };
  if (hours > 0) return { text: `${Math.floor(hours * 60)} 分钟后`, level: 'critical', className: 'text-[#dc2626] bg-red-50 dark:bg-red-500/10 dark:text-red-400 deadline-critical' };
  return { text: '即将到期', level: 'critical', className: 'text-[#dc2626] bg-red-50 dark:bg-red-500/10 dark:text-red-400 deadline-critical' };
}

function dateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return dateKey(date).slice(0, 7);
}

function dateFromKey(key) {
  const [year, month, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftMonthKey(key, offset) {
  const date = dateFromKey(key);
  return monthKey(new Date(date.getFullYear(), date.getMonth() + offset, 1));
}

function formatMonthTitle(key) {
  const date = dateFromKey(key);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatFullDate(key) {
  const date = dateFromKey(key);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

function formatActivityTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function buildCalendarCells(month) {
  const monthStart = dateFromKey(month);
  const start = new Date(monthStart);
  start.setDate(1 - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: dateKey(date),
      inMonth: monthKey(date) === month,
      isToday: dateKey(date) === dateKey(new Date()),
    };
  });
}

function activityDayMap(data) {
  return new Map((data?.days || []).map((day) => [day.date, day]));
}

function formatRelativeTime(value) {
  if (!value) return '';
  const now = new Date();
  const date = new Date(value);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}小时前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}天前`;
}

function dueMeta(task) {
  if (!task?.due_at) {
    return { label: '未设置', className: 'text-[var(--app-subtle)]' };
  }
  if (isTaskOverdue(task)) {
    return { label: formatDate(task.due_at), className: 'text-[#c24141] dark:text-[#fca5a5]' };
  }
  return { label: formatDate(task.due_at), className: 'text-[var(--app-muted)]' };
}

function formatDurationHours(hours) {
  if (hours === null || hours === undefined || hours === '') return '-';
  const value = Number(hours);
  if (!Number.isFinite(value)) return '-';
  const minutes = Math.max(Math.round(value * 60), 0);
  return formatFlowDuration(minutes);
}

function primaryActionForTask(task, user) {
  if (!task || ['done', 'cancelled'].includes(task.status)) return null;
  // 领取任务：只有候选负责人可以领取
  if (task.can_claim) {
    return { label: '开始处理', payload: { action: 'claim_task', note: '开始处理' } };
  }
  // 待取消确认状态的特殊操作
  if (task.status === 'cancel_pending') {
    // 使用权限字段检查
    if (getUserRoles(task, user).includes('creator')) {
      return { label: '确认取消', payload: { action: 'confirm_cancel', note: '确认取消任务' } };
    }
    return null;
  }
  // todo 状态：只有责任人才能开始处理（非候选负责人的情况）
  if (task.status === 'todo') {
    // 如果不是责任人，不能开始处理
    if (!getUserRoles(task, user).includes('owner')) return null;
    return { label: '开始处理', payload: { action: 'change_status', status: 'in_progress', note: '开始处理' } };
  }
  if (task.status === 'in_progress') {
    // 使用权限字段检查：责任人才能提交完成确认
    if (!canPerformAction(task, 'confirm_complete')) return null;
    return { label: '确认完成', payload: { action: 'confirm_complete', note: '提交确认' } };
  }
  if (task.status === 'confirming') {
    // 使用权限字段检查：确认人（或责任人）可以确认
    if (!canPerformAction(task, 'confirm_complete')) return null;
    return { label: '确认', payload: { action: 'confirm_complete', note: '确认' } };
  }
  return null;
}

function badgeClass(map, key) {
  return map[key] || 'border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]';
}

function Badge({ children, className }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[13px] font-medium ${className}`}>{children}</span>;
}

// Helper: get first related person label for card
function getFirstRelatedPerson(task, user) {
  if (!user) return displayUser(task.owner);
  if (task.owner?.id === user.id) return displayUser(task.creator);
  if (task.creator?.id === user.id) return displayUser(task.owner) || '待分配';
  return displayUser(task.owner);
}

// Unified Task Card Component
function TaskCard({ task, onOpen, onRemind, user, scope, showPrefixIcon, dimmed }) {
  const isLimitedView = task.is_limited_view;

  // Row 4 content logic
  const getRow4Content = () => {
    if ((scope === 'cancel_pending' || scope === 'cancelled') && task.cancel_reason) {
      return (
        <span className={scope === 'cancel_pending' ? 'text-yellow-600 dark:text-yellow-400' : 'text-[var(--app-muted)]'}>
          取消原因：{task.cancel_reason}
        </span>
      );
    }
    if (task.reminder_count > 0) {
      return (
        <span className="text-red-400">
          已催办 {task.reminder_count} 次
          {task.latest_reminder_at && (
            <span className="text-[var(--app-subtle)]"> · 最近 {formatActivityTime(task.latest_reminder_at)}</span>
          )}
        </span>
      );
    }
    return null;
  };

  return (
    <TaskCardFrame
      onOpen={() => onOpen(task.id)}
      className={`group rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4 text-left transition-all duration-200 hover:border-[var(--app-primary)]/20 hover:shadow-[var(--shadow-md)] ${dimmed ? 'opacity-60' : ''}`}
    >
      {isLimitedView ? (
        <>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--app-subtle)]">{task.code}</div>
          <div className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug">{task.title}</div>
          {/* Fixed height placeholder for consistent card height */}
          <div className="mt-2 h-[50px]" />
        </>
      ) : (
        <>
          {/* Row 1: Code + Remind Button */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--app-subtle)]">
              {showPrefixIcon === 'done' && <span className="text-green-500 mr-1">✓</span>}
              {showPrefixIcon === 'cancelled' && <span className="text-[var(--app-muted)] mr-1">✕</span>}
              {task.code}
            </span>
            <RemindActionButton task={task} onRemind={onRemind} user={user} />
          </div>

          {/* Row 2: Title + Status */}
          <div className="mt-1.5 flex items-baseline gap-1 overflow-hidden">
            <span className="truncate text-[15px] font-semibold leading-snug">{task.title}</span>
            <span className={`shrink-0 text-[11px] ${statusTextClass(task.status)}`}>
              ({statusLabels[task.status]})
            </span>
          </div>

          {/* Row 3: Meta */}
          <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--app-muted)]">
            <span className="truncate">{getFirstRelatedPerson(task, user)}</span>
            <span className="text-[var(--app-subtle)]">·</span>
            <span className={dueMeta(task).className}>{dueMeta(task).label}</span>
            <span className="text-[var(--app-subtle)]">·</span>
            <span className="tabular-nums">{task.processing_duration_hours || task.current_duration_hours}h</span>
            {task.priority === 'high' && scope !== 'done' && scope !== 'cancelled' && (
              <>
                <span className="text-[var(--app-subtle)]">·</span>
                <span className="text-red-500">高优先</span>
              </>
            )}
          </div>

          {/* Row 4: Context Info - Fixed height placeholder */}
          <div className="mt-1.5 h-[16px] text-[11px] leading-[16px] truncate">
            {getRow4Content()}
          </div>
        </>
      )}
    </TaskCardFrame>
  );
}

export default function TaskApp() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const loadMe = useCallback(async () => {
    if (isDesktopApp() && !getApiBaseUrl()) {
      setToken(null);
      setUser(null);
      setAuthChecked(true);
      return;
    }
    if (!getToken()) {
      setAuthChecked(true);
      return;
    }
    try {
      const current = await api.me();
      setUser(current);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    loadMe();
    const onUnauthorized = () => setUser(null);
    window.addEventListener('flowdesk:unauthorized', onUnauthorized);
    return () => window.removeEventListener('flowdesk:unauthorized', onUnauthorized);
  }, [loadMe]);

  if (!authChecked) {
    return <div className="grid min-h-screen place-items-center bg-[var(--app-bg)] text-[var(--app-text)]">加载中...</div>;
  }

  if (!user) {
    return <AuthScreen onAuthed={setUser} />;
  }

  return <Workspace user={user} onLogout={() => { setToken(null); setUser(null); }} />;
}

function AuthScreen({ onAuthed }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const desktop = isDesktopApp();
  const [apiBaseUrl, setApiBaseUrlState] = useState(() => getApiBaseUrl());
  const [serverOpen, setServerOpen] = useState(() => desktop && !getApiBaseUrl());
  const [serverForm, setServerForm] = useState(() => getApiBaseUrl());
  const [serverError, setServerError] = useState('');
  const [serverMessage, setServerMessage] = useState('');
  const [serverTesting, setServerTesting] = useState(false);
  const { theme, setTheme } = useTheme();
  const apiConfigured = !desktop || Boolean(apiBaseUrl);

  function validateServerForm() {
    const normalized = normalizeApiBase(serverForm);
    if (!normalized) {
      return { error: '请输入服务器地址。' };
    }
    if (!isValidApiBaseUrl(normalized)) {
      return { error: '服务器地址必须以 http:// 或 https:// 开头。' };
    }
    return { normalized };
  }

  function saveServer() {
    const result = validateServerForm();
    setServerMessage('');
    if (result.error) {
      setServerError(result.error);
      return;
    }
    const saved = setApiBaseUrl(result.normalized);
    setApiBaseUrlState(saved);
    setServerForm(saved);
    setServerError('');
    setServerMessage('服务器地址已保存。');
    setError('');
  }

  async function testServer() {
    const result = validateServerForm();
    setServerMessage('');
    if (result.error) {
      setServerError(result.error);
      return;
    }

    setServerTesting(true);
    setServerError('');
    try {
      await api.health(result.normalized);
      setServerForm(result.normalized);
      setServerMessage('连接成功，可以保存并登录。');
    } catch (err) {
      setServerError(err.message);
    } finally {
      setServerTesting(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!apiConfigured) {
      setError('请先配置服务器地址。');
      setServerOpen(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.login(form);
      setToken(data.token);
      onAuthed(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] px-5 py-8 text-[var(--app-text)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-[var(--app-text)] text-sm font-semibold text-[var(--app-panel)]">F</span>
          <span className="text-lg font-semibold">FlowDesk</span>
        </a>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
          className="grid size-10 place-items-center rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
          aria-label="切换主题"
        >
          {theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : <Globe size={16} />}
        </button>
      </div>

      <div className="mx-auto mt-20 grid max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <p className="text-sm font-semibold text-[var(--app-primary)]">任务流转工作区</p>
          <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-tight">登录后查看与你相关的任务。</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[var(--app-muted)]">
            创建人、负责人、参与人、待确认人、评论人和流转操作人都属于相关任务范围。
          </p>
        </div>

        <form onSubmit={submit} className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] p-6 shadow-[var(--app-shadow)]">
          {desktop && (
            <div className="mb-5 border-b border-[var(--app-border)] pb-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Server size={16} />
                    <span>服务器</span>
                  </div>
                  <p className={`mt-1 break-all text-xs ${apiBaseUrl ? 'text-[var(--app-muted)]' : 'text-[#c24141] dark:text-[#fca5a5]'}`}>
                    {apiBaseUrl || '未配置 Django API 服务器地址'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setServerOpen((value) => !value)}
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[8px] border border-[var(--app-border)] px-3 text-sm font-medium text-[var(--app-muted)] hover:text-[var(--app-text)]"
                >
                  <Settings2 size={15} />
                  设置
                </button>
              </div>

              {serverOpen && (
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium">Django API 服务器</span>
                    <input
                      value={serverForm}
                      onChange={(event) => {
                        setServerForm(event.target.value);
                        setServerError('');
                        setServerMessage('');
                      }}
                      className="mt-2 h-10 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-sm outline-none transition-colors focus:border-[var(--app-primary)] focus:ring-2 focus:ring-[var(--app-primary)]/10"
                      placeholder="例如：https://flowdesk.example.com"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveServer}
                      className="h-9 rounded-[8px] bg-[var(--app-text)] px-3 text-sm font-medium text-[var(--app-panel)]"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={testServer}
                      disabled={serverTesting}
                      className="h-9 rounded-[8px] border border-[var(--app-border)] px-3 text-sm font-medium text-[var(--app-muted)] hover:text-[var(--app-text)] disabled:opacity-60"
                    >
                      {serverTesting ? '测试中...' : '测试连接'}
                    </button>
                  </div>
                  {serverError && <p className="text-sm text-[#c24141] dark:text-[#fca5a5]">{serverError}</p>}
                  {serverMessage && <p className="text-sm text-emerald-600 dark:text-emerald-400">{serverMessage}</p>}
                  {!apiBaseUrl && <p className="text-xs text-[var(--app-muted)]">桌面端需要先配置集中部署的 Django API 地址。</p>}
                </div>
              )}
            </div>
          )}

          <label className="mb-4 block">
            <span className="text-sm font-medium">用户名</span>
            <input
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              className="mt-2 h-11 w-full rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 outline-none focus:border-[var(--app-primary)]"
            />
          </label>
          <label className="mb-4 block">
            <span className="text-sm font-medium">密码</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="mt-2 h-11 w-full rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 outline-none focus:border-[var(--app-primary)]"
            />
          </label>
          {error && <div className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
          <button disabled={loading || !apiConfigured} className="h-10 w-full rounded-[8px] bg-[var(--app-primary)] text-sm font-semibold text-white transition-colors disabled:opacity-60 hover:bg-[var(--app-primary-strong)]">
            {!apiConfigured ? '先配置服务器' : loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Workspace({ user, onLogout }) {
  const [scope, setScope] = useState('my_todo');
    const [workspaceMode, setWorkspaceMode] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [tasksScope, setTasksScope] = useState('my_todo');
  const [dashboard, setDashboard] = useState({});
  const [meta, setMeta] = useState({ users: [], departments: [], statuses: [], priorities: [] });
  const [activityMonth, setActivityMonth] = useState(() => monthKey(new Date()));
  const [selectedActivityDate, setSelectedActivityDate] = useState(() => dateKey(new Date()));
  const [activityTimelineOpen, setActivityTimelineOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState('month'); // 'month' | 'week'
  const [dailyActivity, setDailyActivity] = useState(() => ({ month: monthKey(new Date()), total_actions: 0, days: [] }));
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [notifications, setNotifications] = useState({ unread_count: 0, results: [] });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationToasts, setNotificationToasts] = useState([]);
  const shownToastIdsRef = useRef(new Set());
  const [detail, setDetail] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [reminderModal, setReminderModal] = useState({ open: false, task: null });
  const [toast, setToast] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [filters, setFilters] = useState({ mineOnly: false, sortDue: true });
  const [dataScope, setDataScope] = useState('related'); // 数据范围：related/my_department/my_department_tree/all_departments
  const [error, setError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const { theme, setTheme } = useTheme();
  const searchInputRef = useRef(null);
  const searchRequestRef = useRef(0);
  const dataRequestRef = useRef(0);
  const createButtonRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message) => {
    window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  // 通知轮询机制：每30秒检查新通知并弹出 Toast
  useEffect(() => {
    if (!getToken()) return undefined;
    const pollNotifications = async () => {
      try {
        const notificationsData = await api.notifications({ limit: 5 });
        setNotifications(notificationsData);
        // 检查未读通知，弹出 Toast
        const newNotifications = notificationsData.results.filter(
          (n) => n.is_read === false && !shownToastIdsRef.current.has(n.id)
        );
        if (newNotifications.length > 0) {
          newNotifications.forEach((n) => shownToastIdsRef.current.add(n.id));
          setNotificationToasts((prev) => [...prev, ...newNotifications.slice(0, 3 - prev.length)]);
        }
      } catch {
        // 轮询失败不影响主功能
      }
    };
    const intervalId = setInterval(pollNotifications, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const closeNotificationToast = useCallback((id) => {
    setNotificationToasts((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const loadData = useCallback(async () => {
    const requestId = dataRequestRef.current + 1;
    dataRequestRef.current = requestId;
    const requestedScope = scope;
    setSyncStatus('syncing');
    setError('');
    try {
      const [dashboardData, tasksData, metaData, notificationsData] = await Promise.all([
        api.dashboard(),
        api.tasks({
          scope: requestedScope,
          mine_only: filters.mineOnly ? '1' : '',
          sort: filters.sortDue ? 'due_at' : '',
        }),
        api.meta(),
        api.notifications({ limit: 20 }),
      ]);
      if (dataRequestRef.current !== requestId) return;
      setDashboard(dashboardData);
      setTasks(tasksData);
      setTasksScope(requestedScope);
      setMeta(metaData);
      setNotifications(notificationsData);
      setLastSyncTime(new Date());
      setSyncStatus('success');
    } catch (err) {
      if (dataRequestRef.current !== requestId) return;
      setError(err.message);
      setSyncStatus('error');
    }
  }, [scope, filters.mineOnly, filters.sortDue]);

  const loadDailyActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError('');
    try {
      const data = await api.dailyActivity({ month: activityMonth });
      setDailyActivity(data);
    } catch (err) {
      setActivityError(err.message);
    } finally {
      setActivityLoading(false);
    }
  }, [activityMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (workspaceMode === 'overview') {
      loadDailyActivity();
    }
  }, [loadDailyActivity, workspaceMode]);

  function selectTaskScope(nextScope) {
    setWorkspaceMode('tasks');
    if (nextScope !== scope) {
      dataRequestRef.current += 1;
      setTasks([]);
      setTasksScope(nextScope);
      setFilters((current) => ({ ...current, sortDue: true }));
    }
    setScope(nextScope);
  }

  function openOverview() {
    setWorkspaceMode('overview');
    setActivityTimelineOpen(false);
  }

  function selectActivityDate(nextDate, options = {}) {
    setSelectedActivityDate(nextDate);
    if (options.openTimeline !== false) {
      setActivityTimelineOpen(true);
    }
  }

  function selectActivityMonth(nextMonth) {
    setActivityMonth(nextMonth);
    setSelectedActivityDate(nextMonth === monthKey(new Date()) ? dateKey(new Date()) : `${nextMonth}-01`);
    setActivityTimelineOpen(false);
  }

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setUserMenuOpen(false);
    setNotificationsOpen(false);
  }, []);

  const closeSearch = useCallback(() => {
    searchRequestRef.current += 1;
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    setSearchLoading(false);
    setActiveSearchIndex(0);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return undefined;

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    const query = searchQuery.trim();
    const delay = query ? 160 : 0;

    setSearchLoading(true);
    setSearchError('');

    const timeout = window.setTimeout(async () => {
      try {
        const data = await api.tasks({ scope: 'all', search: query, limit: query ? 30 : 8 });
        if (searchRequestRef.current === requestId) {
          setSearchResults(data);
          setActiveSearchIndex(0);
        }
      } catch (err) {
        if (searchRequestRef.current === requestId) {
          setSearchError(err.message);
          setSearchResults([]);
        }
      } finally {
        if (searchRequestRef.current === requestId) {
          setSearchLoading(false);
        }
      }
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [searchOpen, searchQuery]);

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !createOpen && !drawerOpen && !searchOpen) {
        e.preventDefault();
        setCreateOpen(true);
      }
      if (e.key === 'Escape') {
        if (searchOpen) {
          closeSearch();
          return;
        }
        if (reminderModal.open) {
          setReminderModal({ open: false, task: null });
          return;
        }
        if (createOpen) {
          setCreateOpen(false);
          return;
        }
        // drawerOpen is handled by TaskDetailDrawer's own ESC handler
        if (userMenuOpen) setUserMenuOpen(false);
        if (notificationsOpen) setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeSearch, createOpen, drawerOpen, notificationsOpen, openSearch, searchOpen, userMenuOpen]);

  async function openTask(taskId) {
    const data = await api.task(taskId);
    setDetail(data);
    setDrawerOpen(true);
  }

  async function openNotificationTaskWithToast(notification) {
    setNotificationToasts((prev) => prev.filter((n) => n.id !== notification.id));
    if (!notification?.task?.id) return;
    if (!notification.is_read) {
      await api.markNotificationRead(notification.id);
      const notificationsData = await api.notifications({ limit: 20 });
      setNotifications(notificationsData);
    }
    await openTask(notification.task.id);
  }

  async function openSearchResult(task) {
    const nextScope = scopeForTask(task, user, scope);
    setWorkspaceMode('tasks');
    if (nextScope !== scope) {
      dataRequestRef.current += 1;
      setTasks([]);
      setTasksScope(nextScope);
    }
    setScope(nextScope);
    closeSearch();
    await openTask(task.id);
  }

  async function refreshDetail(taskId = detail?.id) {
    if (taskId) {
      setDetail(await api.task(taskId));
    }
    await loadData();
    if (workspaceMode === 'overview') {
      await loadDailyActivity();
    }
  }

  function openReminder(task) {
    const check = canRemindTask(task, user);
    if (!check.can) return; // 不允许催办时直接返回，不弹窗也不提示
    setReminderModal({ open: true, task });
  }

  async function submitReminder(task, remark) {
    const updatedTask = await api.remindTask(task.id, { remark });
    setReminderModal({ open: false, task: null });
    if (detail?.id === updatedTask.id) {
      setDetail(updatedTask);
    }
    await loadData();
    if (workspaceMode === 'overview') {
      await loadDailyActivity();
    }
    showToast('已发送催办');
    return updatedTask;
  }

  async function openNotificationTask(notification) {
    if (!notification?.task?.id) return;
    setNotificationsOpen(false);
    try {
      if (!notification.is_read) {
        await api.markNotificationRead(notification.id);
      }
      const notificationsData = await api.notifications({ limit: 20 });
      setNotifications(notificationsData);
    } catch (err) {
      setError(err.message);
    }
    await openTask(notification.task.id);
  }

  // Scope title and subtitle
  const scopeInfo = useMemo(() => {
    const scopeMap = {
      my_todo: { title: '今日待办', subtitle: '今天需要你处理的任务，包括确认类任务' },
      future: { title: '未来任务', subtitle: '按截止时间查看与你相关的后续任务' },
      created: { title: '我创建的', subtitle: '跟踪你发起的任务进度、流转和耗时' },
      participated: { title: '我参与的', subtitle: '查看你作为参与人协作的任务' },
      overdue: { title: '超时任务', subtitle: '超过截止时间的任务，需要优先关注' },
      done: { title: '已完成', subtitle: '查看已完成的任务历史' },
      cancelled: { title: '已取消', subtitle: '已取消的任务记录' },
      transferred: { title: '我转派的', subtitle: '查看你转派给其他人的任务进度' },
    };
    return scopeMap[scope] || scopeMap.my_todo;
  }, [scope]);

  const pageInfo = workspaceMode === 'overview'
    ? { title: '', subtitle: '' }
    : scopeInfo;
  const visibleTasks = workspaceMode === 'tasks' && tasksScope === scope ? tasks : [];

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="grid min-h-screen grid-cols-[280px_minmax(0,1fr)]">
        {/* Left Sidebar - 优化宽度和间距 */}
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

          {/* Navigation Items - Notion-style grouped views */}
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
                        onClick={() => selectTaskScope(item.key)}
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

          {/* Statistics Section */}
          <div className="mt-6 border-t border-[var(--app-border)] pt-5">
            <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--app-subtle)]">统计</div>
            <button
              type="button"
              onClick={openOverview}
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

          {/* Management Section - 仅对部门负责人和超管显示 */}
          {user?.is_super_admin || user?.is_department_manager ? (
            <div className="mt-6 border-t border-[var(--app-border)] pt-5">
              <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--app-subtle)]">管理</div>
              <button
                type="button"
                onClick={() => setWorkspaceMode('organization')}
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

        {/* Main Content Area */}
        <main className={`relative min-w-0 overflow-hidden border-r border-[var(--app-border)] transition-all duration-300 ${drawerOpen ? 'mr-[min(540px,42vw)]' : ''}`}>
          {/* Top Header - 优化高度和间距 */}
          <header className={`flex h-16 items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-bg)] px-6`}>
            {/* Search Box - 优化样式 */}
            <button
              type="button"
              onClick={openSearch}
              className="relative flex h-10 w-[400px] items-center gap-3 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] px-4 text-left text-[15px] transition-all duration-200 hover:border-[var(--app-primary)]/30 hover:shadow-[var(--shadow-sm)]"
              aria-label="打开任务搜索"
            >
              <Search size={16} className="text-[var(--app-muted)]" strokeWidth={1.5} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[var(--app-muted)]">搜索任务、人员、部门</span>
              <kbd className="hidden rounded-[6px] bg-[var(--app-panel-soft)] px-2 py-1 text-[12px] font-medium text-[var(--app-subtle)] sm:inline">⌘K</kbd>
            </button>

            {/* Right Toolbar - 优化间距 */}
            <div className="flex items-center gap-3">
              <NotificationMenu
                open={notificationsOpen}
                data={notifications}
                onToggle={() => {
                  setNotificationsOpen((value) => !value);
                  setUserMenuOpen(false);
                }}
                onOpenTask={openNotificationTask}
              />

              {/* New Task Button - 优化样式 */}
              <button
                ref={createButtonRef}
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex h-10 items-center gap-2 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white transition-all duration-200 hover:bg-[var(--app-primary-strong)] hover:shadow-[0_2px_8px_rgba(91,127,199,0.15)]"
              >
                <Plus size={16} strokeWidth={2} />
                新建
                <kbd className="rounded-[6px] bg-[rgba(255,255,255,0.15)] px-1.5 py-0.5 text-[11px] font-medium">N</kbd>
              </button>

              {/* User Menu - 优化样式 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    setNotificationsOpen(false);
                  }}
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
                      {/* Theme Options */}
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
                        onClick={() => { setUserMenuOpen(false); onLogout(); }}
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

          {/* Content Section - Kanban Only */}
          <section className={`relative h-[calc(100vh-3.5rem)] overflow-auto p-5`}>
            {/* Click away to close drawer - only covers empty space */}
            {drawerOpen && (
              <div
                className="absolute inset-0 z-0 cursor-pointer"
                onClick={() => setDrawerOpen(false)}
              />
            )}
            <div className="relative z-10">
            {/* Page Header - only for tasks mode */}
            {workspaceMode === 'tasks' && (
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold">{pageInfo.title}</h1>
                <p className="mt-0.5 text-sm text-[var(--app-muted)]">{pageInfo.subtitle}</p>
              </div>
              {/* Sync Status */}
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
                    onClick={loadData}
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600"
                  >
                    <AlertTriangle size={12} />
                    同步失败 · 点击重试
                  </button>
                )}
                {/* Quick Filters */}
                <div className="flex items-center gap-2">
                  {/* 数据范围切换 - 仅管理员显示 */}
                  {(user?.is_super_admin || user?.is_department_manager) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setDataScope('related')}
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
                        onClick={() => setDataScope('my_department')}
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
                        onClick={() => setDataScope('my_department_tree')}
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
                          onClick={() => setDataScope('all_departments')}
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
                    onClick={() => setFilters({ ...filters, mineOnly: !filters.mineOnly })}
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
                    onClick={() => setFilters({ ...filters, sortDue: !filters.sortDue })}
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
            )}

            {/* Kanban Board / Task List */}
            {workspaceMode === 'organization' ? (
              <OrganizationPage
                user={user}
                onRefresh={loadData}
              />
            ) : workspaceMode === 'overview' ? (
              <DailyActivityCalendar
                data={dailyActivity}
                month={activityMonth}
                selectedDate={selectedActivityDate}
                loading={activityLoading}
                error={activityError}
                onMonthChange={selectActivityMonth}
                onDateSelect={selectActivityDate}
                calendarMode={calendarMode}
                onCalendarModeChange={setCalendarMode}
              />
            ) : (
              <TaskBoard tasks={visibleTasks} onOpen={openTask} onRemind={openReminder} scope={scope} user={user} />
            )}
            </div>
          </section>

          {/* Right Panel: Detail Drawer or Insight Panel */}
          {drawerOpen ? (
            <TaskDetailDrawer
              task={detail}
              open={drawerOpen}
              meta={meta}
              user={user}
              onClose={() => setDrawerOpen(false)}
              onRefresh={refreshDetail}
              onRemind={openReminder}
            />
          ) : workspaceMode === 'overview' && activityTimelineOpen ? (
            <DailyActivityTimeline
              data={dailyActivity}
              selectedDate={selectedActivityDate}
              loading={activityLoading}
              onOpenTask={openTask}
              onClose={() => setActivityTimelineOpen(false)}
            />
          ) : null}

          {/* Create Modal */}
          <TaskCreateModal
            open={createOpen}
            meta={meta}
            currentUser={user}
            restoreFocusRef={createButtonRef}
            onClose={() => setCreateOpen(false)}
            onCreated={(task) => {
              setCreateOpen(false);
              openTask(task.id);
              loadData();
              if (workspaceMode === 'overview') loadDailyActivity();
            }}
          />

          <TaskSearchModal
            open={searchOpen}
            query={searchQuery}
            results={searchResults}
            loading={searchLoading}
            error={searchError}
            activeIndex={activeSearchIndex}
            inputRef={searchInputRef}
            onQueryChange={setSearchQuery}
            onActiveIndexChange={setActiveSearchIndex}
            onSelect={openSearchResult}
            onClose={closeSearch}
          />

          <ReminderModal
            open={reminderModal.open}
            task={reminderModal.task}
            onClose={() => setReminderModal({ open: false, task: null })}
            onSubmit={submitReminder}
          />

          <ToastMessage message={toast} />
        </main>
      </div>
      {notificationToasts.length > 0 && (
        <ToastContainer toasts={notificationToasts} onClose={closeNotificationToast} onOpenTask={openNotificationTaskWithToast} />
      )}
    </div>
  );
}

function ToastMessage({ message }) {
  if (!message) return null;
  return createPortal(
    <div className="fixed right-6 top-6 z-[120] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-2.5 text-[14px] font-medium text-[var(--app-text)] shadow-[0_12px_36px_rgba(15,23,42,0.16)]">
      {message}
    </div>,
    document.body
  );
}

function Tooltip({ content, children }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
  }, [visible]);

  if (!content) return children;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="inline-block"
      >
        {children}
      </div>
      {visible && createPortal(
        <div
          className="fixed z-[100] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-[13px] text-[var(--app-text)] shadow-[var(--shadow-lg)] animate-tooltipPop"
          style={{
            top: position.top,
            left: position.left,
            transform: 'translateX(-50%)',
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}

const NOTIFICATION_ICONS = {
  task_remind: BellRing,
  task_completed: CheckCircle2,
  task_cancel_requested: XCircle,
  task_transferred: ArrowRightCircle,
  complete_confirm: CheckCircle2,
  cancel_confirm: XCircle,
  task_timeout: AlertTriangle,
};

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

  function handleClose(e) {
    e.stopPropagation();
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
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
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

function ToastContainer({ toasts, onClose, onOpenTask }) {
  return (
    <div className="fixed right-4 top-4 z-[60] flex flex-col gap-3">
      {toasts.map((notification) => (
        <Toast key={notification.id} notification={notification} onClose={() => onClose(notification.id)} onOpenTask={onOpenTask} />
      ))}
    </div>
  );
}

function NotificationMenu({ open, data, onToggle, onOpenTask }) {
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

function ReminderModal({ open, task, onClose, onSubmit }) {
  const [remark, setRemark] = useState('请尽快处理该任务');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const rawTargets = reminderTargetForTask(task);
  const targetList = Array.isArray(rawTargets) ? rawTargets : rawTargets ? [rawTargets] : [];
  const targetsText = targetList.map((t) => displayUser(t)).join('、');

  useEffect(() => {
    if (open) {
      setRemark('请尽快处理该任务');
      setError('');
      setSaving(false);
    }
  }, [open, task?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  if (!open || !task) return null;

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await onSubmit(task, remark.trim() || '请尽快处理该任务');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/30 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(15,23,42,0.24)] animate-modalPop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--app-text)]">催办当前责任人</h2>
            <p className="mt-1 text-[13px] text-[var(--app-muted)]">{reminderButtonLabel(task)}会通知当前流程节点负责人</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]" aria-label="关闭催办弹窗">
            <X size={16} strokeWidth={1.6} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="grid gap-2 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-bg)] p-3 text-[14px]">
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-[var(--app-muted)]">被催办人</span>
              <span className="min-w-0 truncate font-medium text-[var(--app-text)]">{targetsText}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-[var(--app-muted)]">任务标题</span>
              <span className="min-w-0 truncate font-medium text-[var(--app-text)]">{task.title}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-[var(--app-muted)]">截止时间</span>
              <span className={`min-w-0 truncate font-medium ${dueMeta(task).className}`}>{task.due_at ? formatFullDateTime(task.due_at) : '未设置'}</span>
            </div>
          </div>

          <label className="block">
            <span className="text-[13px] font-medium text-[var(--app-muted)]">催办说明</span>
            <textarea
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              className="mt-2 min-h-[96px] w-full resize-none rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-[var(--app-primary)]"
              placeholder="请输入催办说明，可选"
            />
          </label>

          {error && (
            <div className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--app-border)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-[10px] border border-[var(--app-border)] px-4 text-[14px] font-medium text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || targetList.length === 0}
            className="h-10 rounded-[10px] bg-[var(--app-text)] px-4 text-[14px] font-medium text-[var(--app-panel)] transition-opacity disabled:opacity-50"
          >
            {saving ? '发送中...' : '确认发送'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TaskSearchModal({
  open,
  query,
  results,
  loading,
  error,
  activeIndex,
  inputRef,
  onQueryChange,
  onActiveIndexChange,
  onSelect,
  onClose,
}) {
  const groups = useMemo(() => groupSearchTasks(results), [results]);
  const flatResults = useMemo(() => groups.flatMap((group) => group.tasks), [groups]);
  const activeTask = flatResults[activeIndex];
  const isEmptyQuery = !query.trim();
  const [selectionMode, setSelectionMode] = useState('keyboard');
  const scrollContainerRef = useRef(null);
  const pointerPositionRef = useRef(null);
  const ignoreStaticPointerRef = useRef(false);

  useEffect(() => {
    if (!open || !activeTask) return;
    const scrollContainer = scrollContainerRef.current;
    const activeElement = document.getElementById(`task-search-result-${activeTask.id}`);
    if (!scrollContainer || !activeElement) return;

    if (activeIndex === 0) {
      scrollContainer.scrollTo({ top: 0 });
      return;
    }

    const activeGroup = groups.find((group) => group.tasks.some((task) => task.id === activeTask.id));
    const isFirstInGroup = activeGroup?.tasks[0]?.id === activeTask.id;
    const containerRect = scrollContainer.getBoundingClientRect();

    if (isFirstInGroup) {
      const groupHeader = document.getElementById(`task-search-group-${activeGroup.key}`);
      const groupHeaderRect = groupHeader?.getBoundingClientRect();
      if (groupHeaderRect && groupHeaderRect.top < containerRect.top) {
        scrollContainer.scrollTop += groupHeaderRect.top - containerRect.top;
        return;
      }
    }

    const activeRect = activeElement.getBoundingClientRect();
    if (activeRect.top < containerRect.top) {
      scrollContainer.scrollTop += activeRect.top - containerRect.top;
    } else if (activeRect.bottom > containerRect.bottom) {
      scrollContainer.scrollTop += activeRect.bottom - containerRect.bottom;
    }
  }, [activeIndex, activeTask, groups, open]);

  useEffect(() => {
    if (open) setSelectionMode('keyboard');
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    pointerPositionRef.current = null;
    ignoreStaticPointerRef.current = false;
  }, [open]);

  function moveActive(offset) {
    if (!flatResults.length) return;
    setSelectionMode('keyboard');
    ignoreStaticPointerRef.current = true;
    onActiveIndexChange((current) => (current + offset + flatResults.length) % flatResults.length);
  }

  function handleResultPointerMove(resultIndex, event) {
    const nextPosition = { x: event.clientX, y: event.clientY };
    const previousPosition = pointerPositionRef.current;
    const pointerMoved = !previousPosition
      || previousPosition.x !== nextPosition.x
      || previousPosition.y !== nextPosition.y;
    pointerPositionRef.current = nextPosition;

    if (ignoreStaticPointerRef.current) {
      if (!previousPosition || !pointerMoved) return;
      ignoreStaticPointerRef.current = false;
    }

    if (selectionMode !== 'pointer') {
      setSelectionMode('pointer');
    }
    if (resultIndex !== activeIndex) {
      onActiveIndexChange(resultIndex);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === 'Enter' && activeTask) {
      event.preventDefault();
      onSelect(activeTask);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[800px] overflow-hidden rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.32)] animate-modalPop"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="搜索任务"
      >
        <div className="flex h-16 items-center gap-3 border-b border-[var(--app-border)] px-5">
          <Search size={20} strokeWidth={1.5} className="shrink-0 text-[var(--app-muted)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            className="task-search-input h-full min-w-0 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-[var(--app-subtle)]"
            placeholder="搜索任务、人员、部门"
            autoComplete="off"
          />
          {loading && <RefreshCw size={16} strokeWidth={1.5} className="shrink-0 animate-spin text-[var(--app-muted)]" aria-hidden="true" />}
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[var(--app-muted)] transition-all duration-200 hover:bg-[var(--app-panel-soft)]"
            aria-label="关闭搜索"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div ref={scrollContainerRef} className="max-h-[58vh] overflow-y-auto p-3">
          <div className="px-2 pb-2 pt-1 text-[13px] font-semibold text-[var(--app-subtle)]">
            {isEmptyQuery ? '最近任务' : '搜索结果'}
          </div>

          {error && (
            <div className="mx-2 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {!error && !loading && !flatResults.length && (
            <div className="mx-2 rounded-[12px] border border-dashed border-[var(--app-border)] px-4 py-10 text-center text-[15px] text-[var(--app-muted)]">
              {isEmptyQuery ? '暂无最近任务' : '没有匹配的任务'}
            </div>
          )}

          {!error && groups.map((group) => (
            <div key={group.key} className="mb-3 last:mb-0">
              <div id={`task-search-group-${group.key}`} className="flex h-9 items-center gap-2 px-2 text-[13px] font-semibold text-[var(--app-muted)]">
                <group.Icon size={14} strokeWidth={1.5} className={group.className} aria-hidden="true" />
                <span>{group.label}</span>
                <span className="rounded-[8px] bg-[var(--app-panel-soft)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--app-muted)]">
                  {group.tasks.length}
                </span>
              </div>

              <div className="space-y-1.5">
                {group.tasks.map((task) => {
                  const resultIndex = flatResults.findIndex((item) => item.id === task.id);
                  const isActive = resultIndex === activeIndex;
                  return (
                    <button
                      key={task.id}
                      id={`task-search-result-${task.id}`}
                      type="button"
                      onPointerMove={(event) => handleResultPointerMove(resultIndex, event)}
                      onClick={() => onSelect(task)}
                      className={`flex min-h-[68px] w-full items-center gap-3 rounded-[12px] px-4 py-3 text-left transition-all duration-200 ${
                        isActive
                          ? 'bg-[var(--app-panel-soft)] shadow-[inset_0_0_0_1px_var(--app-border)]'
                          : selectionMode === 'pointer'
                            ? 'hover:bg-[var(--app-panel-soft)]'
                            : ''
                      }`}
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-muted)]">
                        <FileCheck2 size={18} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--app-subtle)]">{task.code}</span>
                          <span className="truncate text-[15px] font-semibold">{task.title}</span>
                        </div>
                        {task.is_limited_view ? (
                          <div className="mt-1.5 text-[13px] text-[var(--app-muted)]">我的待办</div>
                        ) : (
                          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--app-muted)]">
                            <span className="truncate">{displayUser(task.owner)}</span>
                            <span className="text-[var(--app-subtle)]">·</span>
                            <span className="truncate">{task.department?.name || '-'}</span>
                            <span className="text-[var(--app-subtle)]">·</span>
                            <span className={dueMeta(task).className}>{dueMeta(task).label}</span>
                          </div>
                        )}
                      </div>
                      <Badge className={badgeClass(statusTone, searchGroupKey(task))}>
                        {searchGroupKey(task) === 'overdue' ? '已超时' : statusLabels[task.status]}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DailyActivityCalendar({
  data,
  month,
  selectedDate,
  loading,
  error,
  onMonthChange,
  onDateSelect,
  calendarMode,
  onCalendarModeChange,
}) {
  const cells = useMemo(() => buildCalendarCells(month), [month]);
  const daysByDate = useMemo(() => activityDayMap(data), [data]);

  // 计算选中日期所在周的周一到周日
  const weekDays = useMemo(() => {
    const selected = dateFromKey(selectedDate);
    const dayOfWeek = selected.getDay();
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        date,
        key: dateKey(date),
        label: WEEKDAYS[i],
        dayNum: date.getDate(),
        isToday: dateKey(date) === dateKey(new Date()),
      };
    });
  }, [selectedDate]);

  // 周视图：按日期+小时聚合事件
  const weekEventsByDate = useMemo(() => {
    const result = {};
    weekDays.forEach(({ key }) => {
      result[key] = {};
      const day = daysByDate.get(key);
      if (day?.groups) {
        day.groups.forEach(group => {
          group.events.forEach(event => {
            const hour = new Date(event.time).getHours();
            if (!result[key][hour]) result[key][hour] = [];
            result[key][hour].push({ ...event, status: group.status });
          });
        });
      }
    });
    return result;
  }, [weekDays, daysByDate]);

  // 合并当日所有事件（用于Notion风格事件条显示）
  function getDayEvents(day) {
    if (!day?.groups) return [];
    return day.groups.flatMap(group =>
      group.events.slice(0, 2).map(event => ({
        ...event,
        status: group.status,
      }))
    );
  }

  // 周视图渲染（纵向时间轴 + 横向日期列）
  if (calendarMode === 'week') {
    const hours = Array.from({ length: 15 }, (_, i) => 8 + i); // 08:00 - 22:00

    return (
      <div className="h-full min-h-[640px] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const current = dateFromKey(selectedDate);
                current.setDate(current.getDate() - 7);
                onDateSelect(dateKey(current), { openTimeline: false });
              }}
              className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label="上周"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-[var(--app-text)]">
              {weekDays[0].date.getMonth() + 1}月{weekDays[0].dayNum}日 - {weekDays[6].date.getMonth() + 1}月{weekDays[6].dayNum}日
            </span>
            <button
              type="button"
              onClick={() => {
                const current = dateFromKey(selectedDate);
                current.setDate(current.getDate() + 7);
                onDateSelect(dateKey(current), { openTimeline: false });
              }}
              className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label="下周"
            >
              <ChevronRight size={16} />
            </button>
            {loading && <RefreshCw size={14} className="animate-spin text-[var(--app-muted)]" />}
          </div>

          {/* View switcher */}
          <div className="inline-flex rounded-[8px] border border-[var(--app-border)] p-0.5">
            {[
              { key: 'month', label: '月' },
              { key: 'week', label: '周' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onCalendarModeChange(key)}
                className={`h-7 rounded-[6px] px-3 text-xs font-medium transition ${
                  calendarMode === key
                    ? 'bg-[var(--app-text)] text-[var(--app-panel)]'
                    : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Week grid */}
        <div className="flex flex-col">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-[var(--app-border)]">
            <div className="py-2 text-center text-[11px] font-semibold text-[var(--app-subtle)] border-r border-[var(--app-border)]" />
            {weekDays.map(({ key, label, dayNum, isToday }) => (
              <button
                key={key}
                type="button"
                onClick={() => onDateSelect(key)}
                className={`py-2 text-center border-r border-[var(--app-border)] last:border-r-0 ${
                  isToday ? 'text-[var(--app-primary)]' : 'text-[var(--app-text)]'
                } hover:bg-[var(--app-panel-soft)]`}
              >
                <div className="text-[11px] font-semibold">{label}</div>
                <div className={`text-xs font-medium tabular-nums ${isToday ? 'text-[var(--app-primary)]' : 'text-[var(--app-muted)]'}`}>
                  {dayNum}
                </div>
              </button>
            ))}
          </div>

          {/* Hour rows */}
          <div className="flex-1 overflow-y-auto">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 min-h-[32px] border-b border-[var(--app-border)]">
                {/* Hour label */}
                <div className="flex items-center justify-center text-[11px] font-medium tabular-nums text-[var(--app-subtle)] border-r border-[var(--app-border)]">
                  {`${hour.toString().padStart(2, '0')}:00`}
                </div>

                {/* Day cells */}
                {weekDays.map(({ key }) => {
                  const hourEvents = weekEventsByDate[key]?.[hour] || [];
                  return (
                    <div
                      key={`${key}-${hour}`}
                      className="border-r border-[var(--app-border)] last:border-r-0 p-0.5 relative hover:bg-[var(--app-panel-soft)]"
                    >
                      {hourEvents.slice(0, 2).map((event, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onDateSelect(key)}
                          className={`block w-full h-[14px] rounded-[2px] px-1 text-[9px] font-medium truncate mb-0.5 ${eventBarStyles[event.status] || eventBarStyles.todo}`}
                          title={`${event.task?.code} ${event.task?.title}`}
                        >
                          {event.task?.title?.slice(0, 8)}
                        </button>
                      ))}
                      {hourEvents.length > 2 && (
                        <span className="text-[9px] text-[var(--app-subtle)]">+{hourEvents.length - 2}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 月视图渲染
  return (
    <div className="h-full min-h-[640px] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)]">
      {/* Header with month navigation and view switcher */}
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonthKey(month, -1))}
              className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label="上月"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => onMonthChange(monthKey(new Date()))}
              className="h-8 rounded-[8px] px-2.5 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-panel-soft)]"
            >
              {formatMonthTitle(month)}
            </button>
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonthKey(month, 1))}
              className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label="下月"
            >
              <ChevronRight size={16} />
            </button>
            {loading && <RefreshCw size={14} className="animate-spin text-[var(--app-muted)]" />}
          </div>
        </div>

        {/* View switcher - Notion style */}
        <div className="inline-flex rounded-[8px] border border-[var(--app-border)] p-0.5">
          {[
            { key: 'month', label: '月' },
            { key: 'week', label: '周' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onCalendarModeChange(key)}
              className={`h-7 rounded-[6px] px-3 text-xs font-medium transition ${
                calendarMode === key
                  ? 'bg-[var(--app-text)] text-[var(--app-panel)]'
                  : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-[var(--app-border)]">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-2 text-center text-[11px] font-semibold text-[var(--app-subtle)]">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid - Notion style with event bars */}
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const day = daysByDate.get(cell.key);
          const events = getDayEvents(day);
          const isSelected = selectedDate === cell.key;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onDateSelect(cell.key)}
              className={`min-h-[80px] border-b border-r border-[var(--app-border)] p-1.5 text-left transition last:border-r-0 ${
                cell.inMonth
                  ? 'bg-[var(--app-panel)] hover:bg-[var(--app-panel-soft)]'
                  : 'bg-[var(--app-bg)] opacity-50 hover:bg-[var(--app-panel-soft)]'
              } ${
                isSelected
                  ? 'ring-2 ring-[var(--app-primary)] ring-inset'
                  : cell.isToday
                    ? 'font-semibold'
                    : ''
              }`}
            >
              {/* Date number */}
              <div className={`mb-1 text-xs font-medium tabular-nums ${
                cell.isToday
                  ? 'text-[var(--app-primary)]'
                  : cell.inMonth
                    ? 'text-[var(--app-text)]'
                    : 'text-[var(--app-subtle)]'
              }`}>
                {cell.date.getDate()}
              </div>

              {/* Event bars - Notion style */}
              {events.length > 0 && (
                <div className="space-y-0.5">
                  {events.slice(0, 3).map((event, idx) => (
                    <div
                      key={idx}
                      className={`h-[18px] rounded-[3px] px-1.5 text-[10px] font-medium truncate ${eventBarStyles[event.status] || eventBarStyles.todo}`}
                      title={`${event.task?.code} ${event.task?.title}`}
                    >
                      {event.task?.title?.slice(0, 10) || event.label}
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className="text-[10px] text-[var(--app-subtle)] pl-1">
                      +{day.groups.reduce((sum, g) => sum + g.count, 0) - 3}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DailyActivityTimeline({ data, selectedDate, loading, onOpenTask, onClose }) {
  const daysByDate = useMemo(() => activityDayMap(data), [data]);
  const day = daysByDate.get(selectedDate);

  // 合并所有事件并按时间排序
  const sortedEvents = useMemo(() => {
    if (!day?.groups) return [];
    const allEvents = day.groups.flatMap(group =>
      group.events.map(event => ({ ...event, status: group.status }))
    );
    return allEvents.sort((a, b) => new Date(a.time) - new Date(b.time));
  }, [day]);

  // 按小时分组
  const hourlyGroups = useMemo(() => {
    const groups = {};
    sortedEvents.forEach(event => {
      const hour = new Date(event.time).getHours();
      const key = `${hour.toString().padStart(2, '0')}:00`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return groups;
  }, [sortedEvents]);

  // 获取小时范围（08:00 - 22:00）
  const hourKeys = useMemo(() => {
    const keys = Object.keys(hourlyGroups);
    if (keys.length === 0) return ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const minHour = Math.min(...keys.map(k => parseInt(k.split(':')[0])));
    const maxHour = Math.max(...keys.map(k => parseInt(k.split(':')[0])));
    const start = Math.max(8, minHour);
    const end = Math.min(22, maxHour + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => `${(start + i).toString().padStart(2, '0')}:00`);
  }, [hourlyGroups]);

  return (
    <aside className="absolute inset-y-0 right-0 z-10 w-[340px] border-l border-[var(--app-border)] bg-[var(--app-panel)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
        <div>
          <div className="text-sm font-semibold">{formatFullDate(selectedDate)}</div>
          <div className="text-[11px] text-[var(--app-muted)]">
            {day?.total_actions ?? 0} 项流转
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <RefreshCw size={14} className="animate-spin text-[var(--app-muted)]" />}
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
            aria-label="关闭日流转明细"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="h-[calc(100%-3rem)] overflow-y-auto">
        {sortedEvents.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-sm text-[var(--app-muted)]">
            这一天暂无流转动作
          </div>
        )}

        {sortedEvents.length > 0 && (
          <div className="relative px-4 py-3">
            {/* Vertical timeline line */}
            <div className="absolute left-[52px] top-0 bottom-0 w-px bg-[var(--app-border)]" />

            {hourKeys.map((hourKey) => {
              const events = hourlyGroups[hourKey] || [];
              return (
                <div key={hourKey} className="flex min-h-[40px]">
                  {/* Hour label */}
                  <div className="w-[52px] shrink-0 text-[11px] font-medium tabular-nums text-[var(--app-subtle)] py-1">
                    {hourKey}
                  </div>

                  {/* Events in this hour */}
                  <div className="flex-1 pl-3 space-y-1.5">
                    {events.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onOpenTask(event.task.id)}
                        className="relative w-full rounded-[6px] px-2 py-1.5 text-left transition hover:bg-[var(--app-panel-soft)] group"
                      >
                        {/* Timeline dot */}
                        <span className="absolute -left-3 top-2 size-2 rounded-full bg-[var(--app-border)] ring-2 ring-[var(--app-panel)] group-hover:bg-[var(--app-primary)]" />

                        {/* Event content */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium tabular-nums text-[var(--app-subtle)]">
                            {formatActivityTime(event.time)}
                          </span>
                          <Badge className={badgeClass(statusTone, event.task.status)}>
                            {event.task.status_label || statusLabels[event.task.status]}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[12px] font-medium truncate">
                          <span className="text-[var(--app-subtle)]">{event.task.code}</span>
                          <span className="truncate">{event.task.title}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[11px] text-[var(--app-muted)]">
                          <span>{event.label}</span>
                          <span>{displayUser(event.actor)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

const futureGroupConfigs = [
  { key: 'tomorrow', label: '明天', Icon: Sun, colorClass: 'text-orange-500' },
  { key: 'this_week', label: '本周', Icon: Calendar, colorClass: 'text-blue-500' },
  { key: 'next_week', label: '下周', Icon: CalendarDays, colorClass: 'text-indigo-500' },
  { key: 'later', label: '更晚', Icon: Clock, colorClass: 'text-[var(--app-muted)]' },
  { key: 'no_due', label: '无截止时间', Icon: CircleDot, colorClass: 'text-[var(--app-subtle)]' },
];

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

function RemindActionButton({ task, onRemind, label, user }) {
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

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function futureGroupKey(task) {
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
  if (!left.due_at && !right.due_at) return new Date(right.updated_at || 0) - new Date(left.updated_at || 0);
  if (!left.due_at) return 1;
  if (!right.due_at) return -1;
  return new Date(left.due_at) - new Date(right.due_at);
}

function groupFutureTasks(tasks) {
  const grouped = Object.fromEntries(futureGroupConfigs.map((group) => [group.key, []]));
  tasks.forEach((task) => {
    grouped[futureGroupKey(task)].push(task);
  });
  futureGroupConfigs.forEach((group) => {
    grouped[group.key].sort(compareTasksByDue);
  });
  return futureGroupConfigs.map((group) => ({ ...group, tasks: grouped[group.key] }));
}

// Helper: persist column expand state to localStorage
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

function FutureTaskBoard({ tasks, onOpen, onRemind, user }) {
  const groups = groupFutureTasks(tasks);
  // Default: all expanded
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
            {/* Column Header with collapse toggle */}
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

            {/* Task Cards - only show when expanded */}
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

function TaskBoard({ tasks, onOpen, onRemind, scope, user }) {
  if (scope === 'future') {
    return <FutureTaskBoard tasks={tasks} onOpen={onOpen} onRemind={onRemind} user={user} />;
  }

  // Define single-status scopes (only archived: done, cancelled, and overdue)
  const singleStatusScopes = {
    done: { Icon: CheckCircle2, label: '已完成', colorClass: 'text-green-500' },
    cancelled: { Icon: X, label: '已取消', colorClass: 'text-[var(--app-muted)]' },
    overdue: { Icon: AlertTriangle, label: '超时任务', colorClass: 'text-red-500' },
  };

  // For single-status scopes, show single-column kanban layout with collapse
  if (singleStatusScopes[scope]) {
    const config = singleStatusScopes[scope];
    const dimmed = scope === 'done' || scope === 'cancelled';
    const showPrefixIcon = scope === 'done' ? 'done' : scope === 'cancelled' ? 'cancelled' : null;
    const isActive = scope === 'overdue';

    // Use collapse state from localStorage, default expanded
    const { expanded, toggle } = useColumnExpand('single', { [scope]: true });
    const isExpanded = expanded[scope];

    return (
      <div className="flex gap-5 overflow-x-auto pb-4">
        <div className="flex min-w-[290px] max-w-[330px] flex-1 flex-col">
          {/* Column Header with collapse toggle */}
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

          {/* Task Cards */}
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
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // For kanban view (my_todo, created), show multi-column layout with collapse
  // Columns: 待处理、处理中、已超时、待确认（包含 confirming 和 cancel_pending）
  const columnHeaders = [
    { key: 'todo', label: '待处理', Icon: ListChecks },
    { key: 'in_progress', label: '处理中', Icon: Clock3 },
    { key: 'overdue', label: '已超时', Icon: AlertTriangle },
    { key: 'confirming', label: '待确认', Icon: ClipboardCheck }, // 包含 confirming 和 cancel_pending
  ];

  // Use collapse state from localStorage, default all expanded
  const { expanded, toggle } = useColumnExpand('kanban', {
    todo: true,
    in_progress: true,
    overdue: true,
    confirming: true,
  });

  return (
    <div className="flex gap-5 overflow-x-auto pb-4">
        {columnHeaders.map((col) => {
          // 待确认列包含 confirming 和 cancel_pending 两种状态
          const colTasks = tasks.filter((task) => {
            if (col.key === 'overdue') return isTaskOverdue(task);
            if (col.key === 'confirming') return task.status === 'confirming' || task.status === 'cancel_pending';
            return task.status === col.key;
          });
          const isActive = col.key === 'overdue' || col.key === 'confirming';
          const isExpanded = expanded[col.key];

          return (
            <div key={col.key} className="flex min-w-[290px] max-w-[330px] flex-1 flex-col">
              {/* Column Header with collapse toggle */}
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

              {/* Task Cards */}
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

function TaskDetailDrawer({ task, open, meta, user, onClose, onRefresh, onRemind }) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showRemindDialog, setShowRemindDialog] = useState(false);
  const [showTransferPicker, setShowTransferPicker] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [remindNote, setRemindNote] = useState('请尽快处理该任务');
  const [selectedTransferUser, setSelectedTransferUser] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    info: false,
    timeline: true,
    comments: false
  });

  useEffect(() => {
    setComment('');
    setShowCancelDialog(false);
    setShowTransferPicker(false);
    setCancelReason('');
    setShowCompletionDialog(false);
    setShowTransferDialog(false);
    setShowRemindDialog(false);
    setCompletionNote('');
    setTransferNote('');
    setRemindNote('请尽快处理该任务');
    setSelectedTransferUser(null);
    setExpandedSections({ info: false, timeline: true, comments: false });
  }, [task?.id]);

  // Handle ESC key: close inner dialogs first, then drawer
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (showCompletionDialog) {
          setShowCompletionDialog(false);
          setCompletionNote('');
          return;
        }
        if (showTransferDialog) {
          setShowTransferDialog(false);
          setTransferNote('');
          setSelectedTransferUser(null);
          return;
        }
        if (showRemindDialog) {
          setShowRemindDialog(false);
          setRemindNote('请尽快处理该任务');
          return;
        }
        if (showCancelDialog) {
          setShowCancelDialog(false);
          setCancelReason('');
          return;
        }
        if (showTransferPicker) {
          setShowTransferPicker(false);
          return;
        }
        // Only close drawer if no inner dialogs are open
        onClose();
      }
    }
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, showCompletionDialog, showTransferDialog, showRemindDialog, showCancelDialog, showTransferPicker, onClose]);

  async function runAction(payload) {
    if (!task) return;
    setSaving(true);
    try {
      await api.taskAction(task.id, payload);
      await onRefresh(task.id);
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!task || !comment.trim()) return;
    setSaving(true);
    try {
      await api.comment(task.id, comment.trim());
      setComment('');
      await onRefresh(task.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmComplete() {
    const noteText = completionNote.replace(/<[^>]*>/g, '').trim();
    if (!noteText || !primaryAction) return;
    setSaving(true);
    try {
      await api.taskAction(task.id, { ...primaryAction.payload, completion_note: completionNote });
      setShowCompletionDialog(false);
      setCompletionNote('');
      await onRefresh(task.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleTransfer() {
    const noteText = transferNote.replace(/<[^>]*>/g, '').trim();
    if (!noteText || !selectedTransferUser) return;
    setSaving(true);
    try {
      await runAction({ action: 'transfer', owner_id: selectedTransferUser.id, note: transferNote });
      setShowTransferDialog(false);
      setTransferNote('');
      setSelectedTransferUser(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemind() {
    const noteText = remindNote.replace(/<[^>]*>/g, '').trim();
    if (!noteText) return;
    setSaving(true);
    try {
      await api.remindTask(task.id, { note: remindNote });
      setShowRemindDialog(false);
      setRemindNote('请尽快处理该任务');
      await onRefresh(task.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    const noteText = cancelReason.replace(/<[^>]*>/g, '').trim();
    if (!noteText) return;
    setSaving(true);
    try {
      await runAction({ action: 'cancel', note: cancelReason });
      setShowCancelDialog(false);
      setCancelReason('');
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyCancel() {
    const noteText = cancelReason.replace(/<[^>]*>/g, '').trim();
    if (!noteText) return;
    setSaving(true);
    try {
      await runAction({ action: 'apply_cancel', note: cancelReason });
      setShowCancelDialog(false);
      setCancelReason('');
    } finally {
      setSaving(false);
    }
  }

  const primaryAction = primaryActionForTask(task, user);
  const isClosed = task ? ['done', 'cancelled'].includes(task.status) : false;
  const isCreator = sameUser(task?.creator, user);
  const isOwner = sameUser(task?.owner, user);
  const isCancelPending = task?.status === 'cancel_pending';
  const isContentLocked = task?.is_limited_view;
  const needsCompletionNote = primaryAction?.payload?.action === 'confirm_complete' && task?.status === 'in_progress';

  // 催办目标显示文本
  const remindTargets = reminderTargetForTask(task);
  const remindTargetList = Array.isArray(remindTargets) ? remindTargets : remindTargets ? [remindTargets] : [];
  const remindTargetText = remindTargetList.map((t) => displayUser(t)).join('、');

  function handlePrimaryAction() {
    if (needsCompletionNote) {
      setShowCompletionDialog(true);
    } else if (primaryAction) {
      runAction(primaryAction.payload);
    }
  }

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-20 w-[min(540px,42vw)] min-w-[480px] max-w-[calc(100vw-300px)] bg-[var(--app-panel)] shadow-[-18px_0_38px_rgba(17,24,39,0.10)] transition-transform duration-300 dark:shadow-[-18px_0_38px_rgba(0,0,0,0.35)] ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!open}
    >
      {/* Header - Minimal */}
      <div className="flex h-16 items-center justify-between border-b border-[var(--app-border)] px-6">
        <span className="text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--app-subtle)]">{task?.code}</span>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition-all duration-200 hover:bg-[var(--app-panel-soft)]" aria-label="关闭详情">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {task ? (
        <div className="h-[calc(100%-4rem)] overflow-y-auto">
          {/* Title Section - Prominent */}
          <div className="px-8 pt-6 pb-5">
            <h1 className="text-[22px] font-semibold leading-snug font-[var(--app-title-font)]">
              {task.title}
            </h1>

            {/* Creator and Created Time - Key Info */}
            <div className="mt-3 flex items-center gap-5 text-[15px] text-[var(--app-muted)]">
              <span className="flex items-center gap-2">
                <span className="text-[13px] text-[var(--app-subtle)]">创建人</span>
                <span className="font-medium text-[var(--app-text)]">{displayUser(task.creator)}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[13px] text-[var(--app-subtle)]">创建时间</span>
                <span className="font-medium text-[var(--app-text)]">{formatFullDateTime(task.created_at)}</span>
              </span>
            </div>

            {/* Deadline - Countdown Display */}
            {task.due_at && (
              <div className="mt-4">
                <DeadlineDisplay dueAt={task.due_at} isOverdue={task.is_overdue} />
              </div>
            )}

            {/* Status Badge - Inline */}
            <div className="mt-4 inline-flex items-center gap-2.5">
              <Badge className={badgeClass(statusTone, task.status)}>{statusLabels[task.status]}</Badge>
              {task.priority === 'high' && !isClosed && (
                <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-red-50 px-2.5 py-1 text-[13px] font-medium text-red-500 dark:bg-red-500/10">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  高优先
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--app-border)]" />

          {/* Task Content Section - Main Focus */}
          <div className="px-8 py-6">
            <h3 className="mb-3 text-[15px] font-medium text-[var(--app-muted)]">任务内容</h3>
            <TaskContentSection task={task} isLocked={isContentLocked} />
          </div>

          {/* Cancel Reason Alert */}
          {(isCancelPending || task.status === 'cancelled') && task.cancel_reason && (
            <div className="px-8 pb-5">
              <div className="rounded-[12px] border border-yellow-200 bg-yellow-50 p-4 text-[15px] dark:border-yellow-900 dark:bg-yellow-950">
                <div className="text-[13px] font-medium text-yellow-600 dark:text-yellow-400">取消原因</div>
                <div className="mt-2 text-yellow-700 dark:text-yellow-300">{task.cancel_reason}</div>
              </div>
            </div>
          )}

          {/* Primary Action - Unified button layout */}
          {!isClosed && !isContentLocked && (
            <div className="px-8 pb-6">
              {/* Cancel pending state: special two-button layout */}
              {isCancelPending ? (
                <div className="flex gap-3">
                  {/* Confirm Cancel - only creator can do */}
                  <Tooltip content={!isCreator ? '只有创建人可以确认取消' : null}>
                    <button
                      disabled={saving || !isCreator}
                      type="button"
                      onClick={() => runAction({ action: 'confirm_cancel', note: '确认取消' })}
                      className={`group relative h-12 flex-1 rounded-xl text-[15px] font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                        isCreator
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-600 hover:to-red-700'
                          : 'bg-[var(--app-panel-soft)] text-[var(--app-muted)] border border-[var(--app-border)]'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <XCircle size={18} strokeWidth={1.5} className={isCreator ? 'transition-transform group-hover:rotate-12' : ''} />
                        {saving ? '处理中...' : '确认取消'}
                      </span>
                    </button>
                  </Tooltip>
                  {/* Reject Cancel - only creator can do */}
                  <Tooltip content={!isCreator ? '只有创建人可以拒绝取消' : null}>
                    <button
                      disabled={saving || !isCreator}
                      type="button"
                      onClick={() => runAction({ action: 'reject_cancel', note: '拒绝取消，继续执行' })}
                      className={`h-12 rounded-xl px-5 text-[15px] font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                        isCreator
                          ? 'border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'border-2 border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <PlayCircle size={18} strokeWidth={1.5} />
                        拒绝取消
                      </span>
                    </button>
                  </Tooltip>
                </div>
              ) : (
                /* Standard unified button layout: Primary + Transfer + Remind + Cancel */
                <div className="flex items-center gap-3">
                  {/* Primary action button */}
                  <Tooltip content={!primaryAction ? (task.status === 'confirming' ? '只有确认人可以操作' : '只有责任人可以操作') : null}>
                    <button
                      disabled={saving || !primaryAction}
                      type="button"
                      onClick={handlePrimaryAction}
                      className={`group relative h-11 flex-1 rounded-xl text-[15px] font-semibold transition-all ${
                        primaryAction
                          ? 'bg-gradient-to-r from-[var(--app-primary)] to-[#4f7de8] text-white shadow-md shadow-[var(--app-primary)]/15 hover:shadow-lg hover:shadow-[var(--app-primary)]/20'
                          : 'cursor-not-allowed bg-[var(--app-panel-soft)] text-[var(--app-muted)] shadow-sm'
                      } ${saving ? 'opacity-60' : ''}`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {primaryAction?.label === '开始处理' ? (
                          <PlayCircle size={18} strokeWidth={1.5} className="transition-transform group-hover:scale-110" />
                        ) : (
                          <CheckCircle2 size={18} strokeWidth={1.5} className="transition-transform group-hover:scale-110" />
                        )}
                        {saving ? '处理中...' : primaryAction?.label || (task.status === 'confirming' ? '确认' : '确认完成')}
                      </span>
                    </button>
                  </Tooltip>

                  {/* Transfer button - only creator or owner can transfer */}
                  <Tooltip content={!canPerformAction(task, 'transfer') ? '只有创建人或责任人可以转派' : null}>
                    <div className="relative">
                      <button
                        disabled={saving || !canPerformAction(task, 'transfer')}
                        type="button"
                        onClick={() => canPerformAction(task, 'transfer') && setShowTransferPicker(v => !v)}
                        className={`h-11 shrink-0 rounded-xl border px-4 text-[15px] font-medium transition-all shadow-sm ${
                          canPerformAction(task, 'transfer')
                            ? 'border-indigo-300 bg-indigo-100 text-indigo-700 hover:border-indigo-400 hover:bg-indigo-200 dark:border-indigo-500/40 dark:bg-indigo-500/20 dark:text-indigo-400'
                            : 'cursor-not-allowed border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
                        } ${saving ? 'opacity-50' : ''}`}
                      >
                        <span className="flex items-center gap-1.5">
                          <ArrowRightLeft size={16} strokeWidth={1.5} />
                          转派
                        </span>
                      </button>
                      {showTransferPicker && canPerformAction(task, 'transfer') && (
                        <div className="absolute right-0 top-12 z-20 min-w-[200px] rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-2 shadow-[var(--app-shadow)] animate-slideDown">
                          {meta.users?.filter(u => u.id !== task?.owner?.id).map(u => (
                            <button
                              key={u.id}
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                setShowTransferPicker(false);
                                setSelectedTransferUser(u);
                                setShowTransferDialog(true);
                              }}
                              className="h-10 w-full rounded-lg px-3 text-left text-[15px] transition-colors hover:bg-[var(--app-panel-soft)]"
                            >
                              {displayUser(u)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </Tooltip>

                  {/* Remind button */}
                  <Tooltip content={!canRemindTask(task, user).can ? canRemindTask(task, user).reason : null}>
                    <button
                      disabled={saving || !canRemindTask(task, user).can}
                      type="button"
                      onClick={() => {
                        if (!canRemindTask(task, user).can) return;
                        setShowRemindDialog(true);
                      }}
                      className={`h-11 shrink-0 rounded-xl border px-4 text-[15px] font-medium transition-all shadow-sm ${
                        !canRemindTask(task, user).can
                          ? 'cursor-not-allowed border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
                          : 'border-amber-300 bg-amber-100 text-amber-700 hover:border-amber-400 hover:bg-amber-200 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-400'
                      } ${saving ? 'opacity-50' : ''}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <BellRing size={16} strokeWidth={1.5} />
                        催办
                      </span>
                    </button>
                  </Tooltip>

                  {/* Cancel button */}
                  <Tooltip content={!canPerformAction(task, 'cancel') ? '只有创建人或责任人可以取消' : null}>
                    <button
                      disabled={saving || !canPerformAction(task, 'cancel')}
                      type="button"
                      onClick={() => setShowCancelDialog(true)}
                      className={`h-11 shrink-0 rounded-xl border px-4 text-[15px] font-medium transition-all shadow-sm ${
                        !canPerformAction(task, 'cancel')
                          ? 'cursor-not-allowed border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
                          : 'border-red-300 bg-red-100 text-red-700 hover:border-red-400 hover:bg-red-200 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-400'
                      } ${saving ? 'opacity-50' : ''}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <XCircle size={16} strokeWidth={1.5} />
                        取消
                      </span>
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          )}

          {/* Limited View - Action for candidate owner */}
          {isContentLocked && primaryAction && (
            <div className="px-8 pb-6">
              <button
                disabled={saving}
                type="button"
                onClick={() => runAction(primaryAction.payload)}
                className="group relative h-11 w-full rounded-xl bg-gradient-to-r from-[var(--app-primary)] to-[#4f7de8] text-[15px] font-semibold text-white shadow-md shadow-[var(--app-primary)]/15 hover:shadow-lg hover:shadow-[var(--app-primary)]/20 transition-all duration-300 disabled:opacity-60"
              >
                <span className="flex items-center justify-center gap-2">
                  <PlayCircle size={18} strokeWidth={1.5} className="transition-transform group-hover:scale-110" />
                  {saving ? '处理中...' : primaryAction.label}
                </span>
              </button>
            </div>
          )}

          {/* Completion Dialog */}
          <RichTextModal
            open={showCompletionDialog}
            onClose={() => { setShowCompletionDialog(false); setCompletionNote(''); }}
            onSubmit={handleConfirmComplete}
            value={completionNote}
            onChange={setCompletionNote}
            saving={saving}
            config={{
              icon: CheckCircle2,
              title: '完成说明',
              hint: '请描述完成情况，支持富文本格式',
              placeholder: '例如：已按要求完成配置，测试通过...',
              submitLabel: '确认完成',
              color: {
                text: 'text-emerald-600 dark:text-emerald-400',
                button: 'bg-emerald-500 hover:bg-emerald-600',
              },
            }}
          />

          {/* Transfer Dialog */}
          <RichTextModal
            open={showTransferDialog}
            onClose={() => { setShowTransferDialog(false); setTransferNote(''); setSelectedTransferUser(null); }}
            onSubmit={handleTransfer}
            value={transferNote}
            onChange={setTransferNote}
            saving={saving}
            config={{
              icon: ArrowRightLeft,
              title: `转派给 ${selectedTransferUser ? displayUser(selectedTransferUser) : ''}`,
              hint: '请填写转派说明（必填），支持富文本格式',
              placeholder: '例如：任务需要相关专业处理...',
              submitLabel: '确认转派',
              color: {
                text: 'text-indigo-600 dark:text-indigo-400',
                button: 'bg-indigo-500 hover:bg-indigo-600',
              },
            }}
          />

          {/* Remind Dialog */}
          <RichTextModal
            open={showRemindDialog}
            onClose={() => { setShowRemindDialog(false); setRemindNote('请尽快处理该任务'); }}
            onSubmit={handleRemind}
            value={remindNote}
            onChange={setRemindNote}
            saving={saving}
            config={{
              icon: BellRing,
              title: '催办说明',
              targetInfo: remindTargetText,
              senderInfo: displayUser(user),
              taskTitle: task?.title,
              dueAt: task?.due_at ? formatFullDateTime(task.due_at) : '未设置',
              hint: '请填写催办说明（必填），支持富文本格式',
              placeholder: '请尽快处理该任务',
              submitLabel: '发送催办',
              color: {
                text: 'text-amber-600 dark:text-amber-400',
                button: 'bg-amber-600 hover:bg-amber-700 shadow-md text-white',
              },
            }}
          />

          {/* Cancel Dialog */}
          <RichTextModal
            open={showCancelDialog}
            onClose={() => { setShowCancelDialog(false); setCancelReason(''); }}
            onSubmit={getUserRoles(task, user).includes("creator") ? handleCancel : handleApplyCancel}
            value={cancelReason}
            onChange={setCancelReason}
            saving={saving}
            config={{
              icon: XCircle,
              title: getUserRoles(task, user).includes("creator") ? '取消任务' : '申请取消',
              hint: '请填写取消原因（必填），支持富文本格式',
              placeholder: '例如：资源不足、需求变更...',
              submitLabel: getUserRoles(task, user).includes("creator") ? '确认取消' : '提交申请',
              color: {
                text: 'text-red-500 dark:text-red-400',
                button: 'bg-red-500 hover:bg-red-600',
              },
            }}
          />

          {/* Divider */}
          <div className="border-t border-[var(--app-border)]" />

          {/* Collapsible Sections */}
          <div className="px-8 py-5">
            {/* Flow Timeline */}
            <CollapsibleSection
              key={`${task.id}-timeline`}
              title="流转记录"
              defaultOpen={expandedSections.timeline}
            >
              <FlowSummary task={task} records={task.events || []} onRemind={onRemind} user={user} />
            </CollapsibleSection>

            {/* Task Info */}
            <CollapsibleSection
              title="任务信息"
              defaultOpen={expandedSections.info}
            >
              <div className="grid grid-cols-2 gap-2.5 text-[15px]">
                {[
                  ['负责人', displayUser(task.owner)],
                  ['部门', task.department?.name || '-'],
                  ['当前耗时', formatDurationHours(task.current_duration_hours)],
                  ['处理时间', formatDurationHours(task.processing_duration_hours)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-3">
                    <div className="text-[13px] text-[var(--app-muted)]">{label}</div>
                    <div className="mt-1 font-medium text-[var(--app-text)]">{value || '-'}</div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Duration Analysis */}
            <CollapsibleSection
              title="耗时分析"
              defaultOpen={false}
            >
              <DurationAnalysis data={task.duration_analysis} />
            </CollapsibleSection>

            {/* Comments */}
            <CollapsibleSection
              title="评论"
              defaultOpen={expandedSections.comments}
            >
              <div className="space-y-2.5">
                {task.comments?.map((item) => (
                  <div key={item.id} className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium">{displayUser(item.author)}</span>
                      <span className="text-[11px] text-[var(--app-subtle)]">{formatRelativeTime(item.created_at)}</span>
                    </div>
                    <div className="mt-2 text-[15px] text-[var(--app-muted)]">{item.content}</div>
                  </div>
                ))}
                {!task.comments?.length && <div className="rounded-[10px] border border-dashed border-[var(--app-border)] p-4 text-[15px] text-[var(--app-muted)]">暂无评论。</div>}
              </div>
              <div className="mt-3 flex gap-2.5">
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
                  placeholder="添加评论..."
                />
                <button type="button" onClick={addComment} disabled={saving || !comment.trim()} className="h-10 rounded-[10px] bg-[var(--app-text)] px-4 text-[15px] font-medium text-[var(--app-panel)] disabled:opacity-60">
                  发送
                </button>
              </div>
            </CollapsibleSection>
          </div>
        </div>
      ) : (
        <div className="p-8 text-[15px] text-[var(--app-muted)]">点击任务标题查看详情。</div>
      )}
    </aside>
  );
}

const flowStatusTone = {
  created: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
  todo: flowPendingStatusTone,
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
  confirming: flowPendingStatusTone,
  done: completedStatusTone,
  cancel_pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  cancelled: 'border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-500/20 dark:bg-stone-500/10 dark:text-stone-300',
  overdue: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
};

const flowRoleLabels = {
  created: '创建人',
  todo: '责任人',
  in_progress: '责任人',
  confirming: '责任人',
  done: '责任人',
  cancel_pending: '责任人',
  cancelled: '责任人',
  overdue: '责任人',
};

function sameFlowUser(left, right) {
  if (!left || !right) return false;
  if (left.id && right.id) return left.id === right.id;
  return displayUser(left) && displayUser(left) === displayUser(right);
}

function flowUser(record, key) {
  if (!record) return null;
  if (key === 'from') return record.from_user || record.from_owner || null;
  if (key === 'to') return record.to_user || record.to_owner || null;
  // 默认返回执行操作的人（actor）
  return record.actor || record.user || record.to_user || record.to_owner || record.from_user || record.from_owner || null;
}

function flowDurationMinutes(record) {
  const minutes = record?.duration_minutes ?? Math.round((record?.duration_until_next_hours || 0) * 60);
  return Number.isFinite(minutes) ? Math.max(minutes, 0) : 0;
}

function formatFlowDuration(minutes) {
  if (!minutes || minutes <= 0) return '少于1分钟';
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours}小时${rest}分钟` : `${hours}小时`;
  const days = Math.floor(hours / 24);
  const dayHours = hours % 24;
  return dayHours ? `${days}天${dayHours}小时` : `${days}天`;
}

function flowActionMeta(record, status, fromUser, toUser) {
  const raw = String(record?.action_text || record?.action || record?.note || record?.label || record?.event_type || '').trim();
  const lower = raw.toLowerCase();
  const transfer = fromUser && toUser && !sameFlowUser(fromUser, toUser);

  if (record?.event_type === 'remind' || raw.includes('催办')) {
    const confirm = raw.includes('确认');
    return { label: confirm ? '催确认' : '催办处理', edgeLabel: confirm ? '催确认' : '催办', known: true, raw };
  }
  if (record?.event_type === 'created' || lower.includes('create') || raw.includes('创建')) {
    return { label: '创建任务', edgeLabel: '创建任务', known: true };
  }
  if (transfer || lower.includes('transfer') || raw.includes('转派')) {
    return { label: '转派任务', edgeLabel: '转派', known: true };
  }
  if (status === 'confirming' || lower.includes('confirm_complete') || raw.includes('提交确认') || raw.includes('发起完成')) {
    return { label: status === 'done' ? '确认完成' : '发起完成确认', edgeLabel: status === 'done' ? '确认完成' : '发起完成确认', known: true };
  }
  if (status === 'done' || lower.includes('complete') || raw.includes('确认完成') || raw.includes('已完成')) {
    return { label: '确认完成', edgeLabel: '确认完成', known: true };
  }
  if (status === 'cancel_pending' || lower.includes('apply_cancel') || raw.includes('申请取消') || raw.includes('发起取消')) {
    return { label: '发起取消', edgeLabel: '发起取消', known: true };
  }
  if (status === 'cancelled' || lower.includes('confirm_cancel') || raw.includes('确认取消') || raw.includes('取消')) {
    return { label: '确认取消', edgeLabel: '确认取消', known: true };
  }
  if (status === 'in_progress' || lower.includes('start') || lower.includes('claim_task') || raw.includes('开始处理')) {
    return { label: '开始处理', edgeLabel: '开始处理', known: true };
  }

  return { label: statusLabels[status] || raw || '状态更新', edgeLabel: raw || statusLabels[status] || '状态更新', known: false, raw };
}

function buildFlowModel(records = [], task) {
  const items = records.map((record, index) => {
    const fromUser = flowUser(record, 'from');
    const toUser = flowUser(record, 'to');
    const status = record.event_type === 'created' && index === 0
      ? 'created'
      : record.status || record.to_status || task?.status || 'todo';
    const statusLabel = record.title || (status === 'created' ? '创建' : statusLabels[status]) || status;
    const person = flowUser(record) || task?.owner || task?.creator;
    const durationMinutes = flowDurationMinutes(record);
    const action = flowActionMeta(record, status, fromUser, toUser);
    const isTransfer = record.event_type === 'owner' || Boolean(fromUser && toUser && !sameFlowUser(fromUser, toUser));

    return {
      id: record.id || `${record.created_at || 'record'}-${index}`,
      index,
      record,
      status,
      statusLabel,
      person,
      fromUser,
      toUser,
      isTransfer,
      roleLabel: flowRoleLabels[status] || '责任人',
      actionLabel: action.label,
      edgeLabel: action.edgeLabel,
      actionKnown: action.known,
      rawAction: action.raw || record.action || record.action_text || record.note || record.label || record.event_type || '',
      note: record.note,
      createdAt: record.created_at,
      durationMinutes,
      durationText: formatFlowDuration(durationMinutes),
    };
  });

  const lastItem = items[items.length - 1];
  const currentStatus = task?.status || lastItem?.status || 'todo';
  const currentStatusLabel = statusLabels[currentStatus] || lastItem?.statusLabel || '-';
  const latestAction = lastItem?.actionLabel || '-';
  const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const longest = items.reduce((winner, item) => item.durationMinutes > (winner?.durationMinutes || 0) ? item : winner, null);
  const closed = ['done', 'cancelled'].includes(currentStatus);
  const currentPerson = currentFlowPerson(task, lastItem);

  return {
    items,
    lastItem,
    currentStatus,
    currentStatusLabel,
    latestAction,
    totalMinutes,
    totalText: formatFlowDuration(totalMinutes),
    nodeCount: items.length,
    longest,
    longestText: longest?.durationMinutes > 0 ? `${longest.statusLabel} ${formatFlowDuration(longest.durationMinutes)}` : '暂无明显停留',
    closed,
    currentPerson,
  };
}

function currentFlowPerson(task, lastItem) {
  const status = task?.status || lastItem?.status;
  if (status === 'confirming' || status === 'cancel_pending') {
    return { label: status === 'confirming' ? '待确认人' : '确认人', user: task?.confirmer || task?.creator || task?.owner || lastItem?.person };
  }
  if (status === 'done') {
    return { label: '完成人', user: lastItem?.record?.actor || task?.owner || lastItem?.person };
  }
  if (status === 'cancelled') {
    return { label: '取消人', user: lastItem?.record?.actor || lastItem?.person };
  }
  return { label: '当前责任人', user: task?.owner || lastItem?.person || task?.creator };
}

function FlowSummary({ task, records, onRemind, user }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const flow = useMemo(() => buildFlowModel(records, task), [records, task]);

  if (!flow.items.length) {
    return <div className="rounded-[14px] border border-dashed border-[var(--app-border)] bg-white p-4 text-[15px] text-[var(--app-muted)] shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:bg-[var(--app-bg)]">暂无流转记录。</div>;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge className={badgeClass(flowStatusTone, flow.currentStatus)}>{flow.currentStatusLabel}</Badge>
            <span className="truncate text-[13px] text-[var(--app-muted)]">
              {flow.currentPerson.label}：<span className="font-medium text-[var(--app-text)]">{displayUser(flow.currentPerson.user) || '-'}</span>
            </span>
            <span className="text-[13px] text-[var(--app-muted)]">
              总耗时：<span className="font-medium text-[var(--app-text)]">{flow.totalText}</span>
            </span>
            {task?.reminder_count > 0 && (
              <span className="text-[13px] text-[var(--app-muted)]">
                已催办 <span className="font-medium text-[var(--app-text)]">{task.reminder_count}</span> 次
                {task.latest_reminder_at ? ` · 最近 ${formatActivityTime(task.latest_reminder_at)}` : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 text-[13px] font-medium text-[var(--app-text)] transition-all hover:border-[var(--app-primary)]/30 hover:text-[var(--app-primary)] hover:shadow-[var(--shadow-sm)]"
          >
            查看轨迹
            <ChevronRight size={14} strokeWidth={1.7} />
          </button>
        </div>
        <FlowTimeline flow={flow} />
      </div>

      <FlowDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        task={task}
        records={records}
        onRemind={onRemind}
        user={user}
      />
    </>
  );
}

function FlowDetailModal({ open, onClose, task, records, onRemind, user }) {
  const flow = useMemo(() => buildFlowModel(records, task), [records, task]);
  const trackMeta = useMemo(() => flowTrackMeta(flow), [flow]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/35 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[86vh] w-[min(1180px,calc(100vw-32px))] flex-col overflow-hidden rounded-[18px] border border-[var(--app-border)] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)] dark:bg-[var(--app-panel)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-5 border-b border-[var(--app-border)] px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold text-[var(--app-text)]">处理轨迹</h2>
            <p className="mt-1 text-[14px] text-[var(--app-muted)]">任务从创建到当前状态的完整流转路径</p>
            <p className="mt-2 text-[13px] text-[var(--app-muted)]">{trackMeta.summary}</p>
          </div>
          <div className="flex shrink-0 items-start gap-3">
            <div className="mt-0.5 rounded-full border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1.5 text-[12px] text-[var(--app-muted)]">
              最长停留：{trackMeta.longestText}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-[10px] text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label="关闭处理轨迹"
            >
              <X size={18} strokeWidth={1.7} />
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <FlowCanvas flow={flow} task={task} onRemind={onRemind} user={user} />
          <ReminderDetailList reminders={task?.reminders || []} />
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function ReminderDetailList({ reminders }) {
  if (!reminders.length) return null;

  return (
    <div className="mt-5 rounded-[14px] border border-[var(--app-border)] bg-[var(--app-bg)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[var(--app-text)]">催办明细</h3>
        <span className="rounded-full bg-[var(--app-panel-soft)] px-2 py-0.5 text-[12px] font-medium text-[var(--app-muted)]">{reminders.length}</span>
      </div>
      <div className="mt-3 divide-y divide-[var(--app-border)]">
        {reminders.map((reminder) => (
          <div key={reminder.id} className="grid grid-cols-[1fr_auto] gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[14px] text-[var(--app-text)]">
                <span className="font-medium">{displayUser(reminder.from_user)}</span>
                <span className="text-[var(--app-muted)]">催办</span>
                <span className="font-medium">{displayUser(reminder.to_user)}</span>
                <span className="text-[var(--app-muted)]">{reminder.remind_type_label}</span>
              </div>
              {reminder.remark && <div className="mt-1 text-[13px] text-[var(--app-muted)]">{reminder.remark}</div>}
            </div>
            <span className="shrink-0 text-[12px] text-[var(--app-subtle)]">{formatDateTime(reminder.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function flowPersonKey(user) {
  if (!user) return 'unknown';
  return user.id ? `id:${user.id}` : `name:${displayUser(user) || 'unknown'}`;
}

function compactStatusTrail(items) {
  const labels = [];
  items.forEach((item) => {
    if (item.statusLabel && labels[labels.length - 1] !== item.statusLabel) {
      labels.push(item.statusLabel);
    }
  });
  return labels;
}

function compactNodeStatusEntries(items) {
  const entries = [];
  items.forEach((item) => {
    const label = item.roleLabel && item.statusLabel ? `${item.roleLabel} · ${item.statusLabel}` : item.statusLabel;
    const previous = entries[entries.length - 1];

    if (previous?.label === label) {
      previous.time = formatDateTime(item.createdAt);
      previous.item = item;
      return;
    }

    entries.push({
      id: `${item.id}-status-${entries.length}`,
      label,
      time: formatDateTime(item.createdAt),
      item,
    });
  });
  return entries;
}

function buildFlowActorGraph(flow) {
  const nodes = [];
  const nodeByPerson = new Map();
  const edgeByRoute = new Map();
  let previousNode = null;
  let lastRealNodeId = null;

  const addNodeForItem = (item) => {
    const key = flowPersonKey(item.person);
    const existing = nodeByPerson.get(key);

    if (existing) {
      existing.items.push(item);
      existing.lastItem = item;
      existing.statusTrail = compactStatusTrail(existing.items);
      existing.statusEntries = compactNodeStatusEntries(existing.items);
      existing.durationMinutes += item.durationMinutes;
      existing.durationText = formatFlowDuration(existing.durationMinutes);
      return existing;
    }

    const node = {
      id: `actor-${item.id}`,
      person: item.person,
      personKey: key,
      items: [item],
      entryItem: item,
      lastItem: item,
      statusTrail: [item.statusLabel],
      statusEntries: compactNodeStatusEntries([item]),
      durationMinutes: item.durationMinutes,
      durationText: item.durationText,
      isPlaceholder: false,
    };

    nodes.push(node);
    nodeByPerson.set(key, node);
    return node;
  };

  const addEdge = (fromNode, toNode, item, isPlaceholder = false) => {
    if (!fromNode || !toNode || fromNode.id === toNode.id) return;

    const label = isPlaceholder ? '待完成' : item?.edgeLabel || item?.actionLabel || '流转';
    const routeKey = `${fromNode.id}->${toNode.id}->${label}`;
    const durationMinutes = isPlaceholder ? 0 : item?.durationMinutes || 0;
    const existing = edgeByRoute.get(routeKey);

    if (existing) {
      existing.count += 1;
      existing.durationMinutes += durationMinutes;
      existing.durationText = formatFlowDuration(existing.durationMinutes);
      existing.long = existing.durationMinutes >= 120;
      existing.item = item || existing.item;
      return;
    }

    edgeByRoute.set(routeKey, {
      id: `edge-${fromNode.id}-${toNode.id}-${edgeByRoute.size}`,
      fromId: fromNode.id,
      toId: toNode.id,
      label,
      durationMinutes,
      durationText: formatFlowDuration(durationMinutes),
      long: durationMinutes >= 120,
      dashed: isPlaceholder,
      count: 1,
      item,
    });
  };

  flow.items.forEach((item) => {
    // 转派操作需要显示两个节点：转派人(actor)和被转派人(to_owner)
    if (item.isTransfer && item.record?.to_owner) {
      // 先处理转派人（actor）节点
      const actorPerson = item.record.actor || item.person;
      const actorKey = flowPersonKey(actorPerson);
      const actorExists = nodeByPerson.has(actorKey);
      let actorNode = nodeByPerson.get(actorKey);

      if (!actorNode) {
        actorNode = {
          id: `actor-${item.id}-from`,
          person: actorPerson,
          personKey: actorKey,
          items: [],
          entryItem: item,
          lastItem: item,
          statusTrail: [],
          statusEntries: [],
          durationMinutes: 0,
          durationText: '少于1分钟',
          isPlaceholder: false,
        };
        nodes.push(actorNode);
        nodeByPerson.set(actorKey, actorNode);
      }

      // 连接上一个节点到转派人（仅当actor是首次出现）
      if (previousNode && !actorExists) {
        addEdge(previousNode, actorNode, item);
      }

      // 然后处理被转派人节点
      const toPerson = item.record.to_owner;
      const toKey = flowPersonKey(toPerson);
      let toNode = nodeByPerson.get(toKey);

      if (!toNode) {
        toNode = {
          id: `actor-${item.id}-to`,
          person: toPerson,
          personKey: toKey,
          items: [item],
          entryItem: item,
          lastItem: item,
          statusTrail: [item.statusLabel],
          statusEntries: compactNodeStatusEntries([item]),
          durationMinutes: item.durationMinutes,
          durationText: item.durationText,
          isPlaceholder: false,
        };
        nodes.push(toNode);
        nodeByPerson.set(toKey, toNode);
      } else {
        toNode.items.push(item);
        toNode.lastItem = item;
        toNode.statusTrail = compactStatusTrail(toNode.items);
        toNode.statusEntries = compactNodeStatusEntries(toNode.items);
        toNode.durationMinutes += item.durationMinutes;
        toNode.durationText = formatFlowDuration(toNode.durationMinutes);
      }

      // 连接转派人到被转派人
      addEdge(actorNode, toNode, item);
      previousNode = toNode;
      lastRealNodeId = toNode.id;
    } else {
      // 非转派操作，正常处理
      const node = addNodeForItem(item);
      addEdge(previousNode, node, item);
      previousNode = node;
      lastRealNodeId = node.id;
    }
  });

  if (!flow.closed && nodes.length) {
    const placeholder = {
      id: 'pending-end',
      person: null,
      personKey: 'pending-end',
      items: [],
      entryItem: null,
      lastItem: null,
      statusTrail: ['待完成'],
      statusEntries: [{ id: 'pending-end-status', label: '待完成', time: '未完成' }],
      durationMinutes: 0,
      durationText: '少于1分钟',
      isPlaceholder: true,
    };
    nodes.push(placeholder);
    addEdge(previousNode, placeholder, null, true);
  }

  return { nodes, edges: Array.from(edgeByRoute.values()), lastRealNodeId };
}

function buildFlowActorNodes(flow) {
  return buildFlowActorGraph(flow).nodes;
}

function actorNodeEdge(node) {
  if (node.isPlaceholder) {
    return { label: '待完成', durationText: '少于1分钟', long: false };
  }
  const item = node.entryItem;
  return {
    label: item?.edgeLabel || item?.actionLabel || '流转',
    durationText: item?.durationText || '少于1分钟',
    long: (item?.durationMinutes || 0) >= 120,
  };
}

function flowTrackMeta(flow) {
  const actorNodes = buildFlowActorNodes(flow);
  const peopleCount = new Set(actorNodes.filter((node) => !node.isPlaceholder).map((node) => node.personKey)).size;
  const transferCount = flow.items.filter((item) => item.isTransfer).length;
  const creator = flow.items.find((item) => item.status === 'created')?.person || flow.items[0]?.person;
  const creatorName = displayUser(creator) || '-';
  const currentPersonName = displayUser(flow.currentPerson.user) || '-';

  return {
    summary: `共 ${peopleCount} 位责任人 · 创建人：${creatorName} · ${transferCount} 次转派 · 总耗时 ${flow.totalText} · ${flow.currentStatusLabel} · ${flow.currentPerson.label}：${currentPersonName}`,
    longestText: flow.longestText,
  };
}

function FlowCanvas({ flow, task, onRemind, user }) {
  const actorGraph = buildFlowActorGraph(flow);
  const actorNodes = actorGraph.nodes;
  const actorEdges = actorGraph.edges;

  if (!flow.items.length) {
    return <div className="rounded-[14px] border border-dashed border-[var(--app-border)] p-6 text-[15px] text-[var(--app-muted)]">暂无处理轨迹。</div>;
  }

  // 计算边的偏移量，避免重叠
  const edgeOffsetMap = new Map();
  const edgesByNodePair = new Map();
  actorEdges.forEach((edge) => {
    const key = `${edge.fromId}-${edge.toId}`;
    const list = edgesByNodePair.get(key) || [];
    list.push(edge);
    edgesByNodePair.set(key, list);
  });
  edgesByNodePair.forEach((edges, key) => {
    edges.forEach((edge, index) => {
      edgeOffsetMap.set(edge.id, index);
    });
  });

  const nodeIndexById = new Map(actorNodes.map((node, index) => [node.id, index]));
  const viewportWidth = 1060;
  const padding = 34;
  const availableWidth = viewportWidth - padding * 2;
  const nodeWidth = 136;
  const gap = 112;
  const nodeHeight = 154;
  const rowGap = 152;
  const rowCapacity = Math.max(1, Math.min(actorNodes.length, Math.floor((availableWidth + gap) / (nodeWidth + gap))));
  const rowCount = Math.max(1, Math.ceil(actorNodes.length / rowCapacity));
  const contentHeight = rowCount * nodeHeight + Math.max(rowCount - 1, 0) * rowGap;
  const canvasHeight = Math.max(360, contentHeight + 128);
  const canvasWidth = viewportWidth;
  const nodeTop = Math.floor((canvasHeight - contentHeight) / 2);
  const avatarSize = 42;
  const offsetStep = 18; // 每条边偏移量
  const positionFor = (index) => {
    const row = Math.floor(index / rowCapacity);
    const indexInRow = index % rowCapacity;
    const rowStart = row * rowCapacity;
    const nodesInRow = Math.min(rowCapacity, actorNodes.length - rowStart);
    const rowWidth = nodesInRow * nodeWidth + Math.max(nodesInRow - 1, 0) * gap;
    const rowLeft = padding + Math.max(0, (availableWidth - rowWidth) / 2);
    const direction = row % 2 === 0 ? 1 : -1;
    const visualColumn = direction === 1 ? indexInRow : nodesInRow - 1 - indexInRow;
    return {
      x: rowLeft + visualColumn * (nodeWidth + gap),
      y: nodeTop + row * (nodeHeight + rowGap),
      row,
      direction,
    };
  };
  const initialFor = (node) => {
    const name = displayUser(node.person);
    return node.isPlaceholder ? '终' : (name || node.statusTrail[0] || '?').trim().slice(0, 1);
  };

  return (
      <div className="overflow-x-auto rounded-[14px] border border-[var(--app-border)] bg-white dark:bg-[var(--app-panel)]">
        <div className="relative mx-auto" style={{ width: canvasWidth, height: canvasHeight }}>
          <svg className="absolute inset-0 pointer-events-none" width={canvasWidth} height={canvasHeight} aria-hidden="true">
            <defs>
              <marker id="flow-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="#9aa7b8" />
              </marker>
            </defs>
            {actorEdges.map((edge) => {
              const fromIndex = nodeIndexById.get(edge.fromId);
              const toIndex = nodeIndexById.get(edge.toId);

              if (fromIndex == null || toIndex == null) return null;

              const from = positionFor(fromIndex);
              const to = positionFor(toIndex);
              const fromCenterX = from.x + nodeWidth / 2;
              const toCenterX = to.x + nodeWidth / 2;
              const edgeTarget = actorNodes[toIndex];
              const longestLabel = Math.max(edge.label.length, edge.durationText.length);
              const labelGap = Math.max(longestLabel * 5.8 + 14, 44);
              const dashed = edge.dashed || edgeTarget?.isPlaceholder;
              const edgeOffset = edgeOffsetMap.get(edge.id) || 0;
              const useDashed = dashed || edgeOffset > 0;
              const yOffset = edgeOffset * offsetStep;

              if (from.row !== to.row) {
                const startX = fromCenterX;
                const startY = from.y + nodeHeight + 4 + yOffset;
                const endX = toCenterX;
                const endY = to.y - 10;
                const midY = (startY + endY) / 2;
                const labelGapY = 20;
                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${startX} ${startY} L ${startX} ${midY - labelGapY}`}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="1.2"
                      strokeDasharray={useDashed ? '6 5' : undefined}
                    />
                    <path
                      d={`M ${startX} ${midY + labelGapY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="1.2"
                      strokeDasharray={useDashed ? '6 5' : undefined}
                      markerEnd="url(#flow-arrow)"
                    />
                    <text
                      x={startX + (edgeOffset > 0 ? edgeOffset * 12 : 0)}
                      y={midY - 5 + yOffset}
                      textAnchor="middle"
                      className="fill-slate-500 text-[11px] font-medium dark:fill-slate-400"
                    >
                      <tspan x={startX + (edgeOffset > 0 ? edgeOffset * 12 : 0)}>{edge.label}</tspan>
                      <tspan x={startX + (edgeOffset > 0 ? edgeOffset * 12 : 0)} dy="13" className="fill-slate-400 text-[10px] font-normal dark:fill-slate-500">
                        {edge.durationText}
                      </tspan>
                    </text>
                  </g>
                );
              }

              const direction = toCenterX > fromCenterX ? 1 : -1;
              const nonAdjacentReturn = Math.abs(toCenterX - fromCenterX) > nodeWidth + gap + 16;

              if (nonAdjacentReturn) {
                const startX = fromCenterX;
                const endX = toCenterX;
                const startY = from.y + nodeHeight + 4 + yOffset;
                const endY = to.y + nodeHeight + 4;
                const routeY = from.y + nodeHeight + 44 + yOffset;
                const midX = (startX + endX) / 2;
                const safeLabelGap = Math.min(labelGap, Math.max(36, (Math.abs(endX - startX) - 18) / 2));
                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${startX} ${startY} L ${startX} ${routeY} L ${midX - direction * safeLabelGap} ${routeY}`}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="1.2"
                      strokeDasharray={useDashed ? '6 5' : undefined}
                    />
                    <path
                      d={`M ${midX + direction * safeLabelGap} ${routeY} L ${endX} ${routeY} L ${endX} ${endY}`}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="1.2"
                      strokeDasharray={useDashed ? '6 5' : undefined}
                      markerEnd="url(#flow-arrow)"
                    />
                    <text
                      x={midX}
                      y={routeY - 5}
                      textAnchor="middle"
                      className="fill-slate-500 text-[11px] font-medium dark:fill-slate-400"
                    >
                      <tspan x={midX}>{edge.label}</tspan>
                      <tspan x={midX} dy="13" className="fill-slate-400 text-[10px] font-normal dark:fill-slate-500">
                        {edge.durationText}
                      </tspan>
                    </text>
                  </g>
                );
              }

              const startX = fromCenterX + direction * (avatarSize / 2 + 10);
              const endX = toCenterX - direction * (avatarSize / 2 + 10);
              const lineStartX = startX + direction * 8;
              const lineEndX = endX - direction * 8;
              const midX = (lineStartX + lineEndX) / 2;
              const lineY = from.y + avatarSize / 2 + yOffset;
              const safeLabelGap = Math.min(labelGap, Math.max(36, (Math.abs(lineEndX - lineStartX) - 18) / 2));
              // 同行多边使用弯曲线绕开
              if (edgeOffset > 0) {
                const curveY = lineY + edgeOffset * 14;
                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${lineStartX} ${lineY} L ${lineStartX} ${curveY} L ${lineEndX} ${curveY} L ${lineEndX} ${lineY}`}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="1.2"
                      strokeDasharray="6 5"
                      markerEnd="url(#flow-arrow)"
                    />
                    <text
                      x={midX}
                      y={curveY - 5}
                      textAnchor="middle"
                      className="fill-slate-500 text-[11px] font-medium dark:fill-slate-400"
                    >
                      <tspan x={midX}>{edge.label}</tspan>
                      <tspan x={midX} dy="13" className="fill-slate-400 text-[10px] font-normal dark:fill-slate-500">
                        {edge.durationText}
                      </tspan>
                    </text>
                  </g>
                );
              }
              return (
                <g key={edge.id}>
                  <path
                    d={`M ${lineStartX} ${lineY} L ${midX - direction * safeLabelGap} ${lineY}`}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="1.2"
                    strokeDasharray={useDashed ? '6 5' : undefined}
                  />
                  <path
                    d={`M ${midX + direction * safeLabelGap} ${lineY} L ${lineEndX} ${lineY}`}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="1.2"
                    strokeDasharray={useDashed ? '6 5' : undefined}
                    markerEnd="url(#flow-arrow)"
                  />
                  <text
                    x={midX}
                    y={lineY - 5}
                    textAnchor="middle"
                    className="fill-slate-500 text-[11px] font-medium dark:fill-slate-400"
                  >
                    <tspan x={midX}>{edge.label}</tspan>
                    <tspan x={midX} dy="13" className="fill-slate-400 text-[10px] font-normal dark:fill-slate-500">
                      {edge.durationText}
                    </tspan>
                  </text>
                </g>
              );
            })}
          </svg>

          {actorNodes.map((node, index) => {
            const pos = positionFor(index);
            const active = !node.isPlaceholder && node.id === actorGraph.lastRealNodeId;
            const done = flow.closed && active;
            const lastItem = node.lastItem;
            const timeText = node.isPlaceholder ? '未完成' : formatDateTime(lastItem?.createdAt);
            const visibleStatuses = (node.statusEntries || []).slice(-3);
            const hiddenStatusCount = Math.max((node.statusEntries || []).length - visibleStatuses.length, 0);
            const reminderCount = task?.reminder_count || 0;
            return (
              <div
                key={node.id}
                className={`absolute flex flex-col items-center text-center ${
                  active
                    ? done
                      ? 'rounded-[14px] bg-emerald-50/70 px-2 py-2 ring-1 ring-emerald-200/80 dark:bg-emerald-500/10 dark:ring-emerald-500/25'
                      : 'rounded-[14px] bg-blue-50/70 px-2 py-2 ring-1 ring-blue-200/80 dark:bg-blue-500/10 dark:ring-blue-500/25'
                    : node.isPlaceholder
                      ? 'opacity-75'
                      : ''
                }`}
                style={{ left: pos.x, top: pos.y, width: nodeWidth, minHeight: nodeHeight }}
              >
                <div
                  className={`grid shrink-0 place-items-center rounded-full border font-semibold shadow-[0_4px_12px_rgba(15,23,42,0.04)] ${
                    node.isPlaceholder
                      ? 'border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-white/20 dark:bg-white/5'
                      : done
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : active
                          ? 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300'
                          : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                  }`}
                  style={{ width: avatarSize, height: avatarSize, fontSize: Math.max(15, Math.floor(avatarSize * 0.38)) }}
                >
                  {initialFor(node)}
                </div>
                <div className="mt-2 w-full min-w-0">
                  <div className="truncate text-[13px] font-semibold leading-tight text-[var(--app-text)]">{node.isPlaceholder ? '任务结束' : displayUser(node.person) || '-'}</div>
                  <div className="mt-1 space-y-0.5">
                    {visibleStatuses.map((entry) => (
                      <div key={entry.id} className="truncate text-[11px] leading-tight text-[var(--app-muted)]">
                        {entry.label}
                      </div>
                    ))}
                    {hiddenStatusCount > 0 && (
                      <div className="text-[10.5px] leading-tight text-[var(--app-subtle)]">+{hiddenStatusCount} 个状态</div>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 whitespace-nowrap text-[11px] leading-tight text-[var(--app-subtle)] tabular-nums">
                  {timeText}
                </div>
                {active && !node.isPlaceholder && !flow.closed && (
                  <div className="mt-2 w-full space-y-1 text-[11px] leading-tight text-[var(--app-muted)]">
                    <div>已停留 {node.durationText}</div>
                    {reminderCount > 0 && (
                      <div>
                        催办 {reminderCount} 次{task?.latest_reminder_at ? ` · 最近 ${formatActivityTime(task.latest_reminder_at)}` : ''}
                      </div>
                    )}
                    <RemindActionButton task={task} onRemind={onRemind} user={user} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
  );
}

function FlowTimeline({ flow }) {
  if (!flow.items.length) {
    return <div className="rounded-[12px] border border-dashed border-[var(--app-border)] p-4 text-[15px] text-[var(--app-muted)]">暂无流转记录。</div>;
  }

  return (
    <div className="rounded-[14px] border border-[var(--app-border)] bg-white p-4 dark:bg-[var(--app-bg)]">
      {flow.items.map((item, index) => {
        const transferText = item.isTransfer ? `由 ${displayUser(item.record?.actor)} 转派给 ${displayUser(item.toUser)}` : '';
        const remindText = item.record?.event_type === 'remind' ? item.rawAction || item.note : '';
        const personText = remindText || transferText || `${item.roleLabel}：${displayUser(item.person) || '-'}`;
        const quick = item.durationMinutes <= 0;
        const noteText = item.note && item.note !== item.actionLabel && item.note !== item.rawAction ? item.note : '';

        return (
          <div key={item.id} className="relative grid grid-cols-[20px_1fr_auto] gap-3 pb-5 last:pb-0">
            <span className={`mt-1.5 size-2.5 rounded-full ring-4 ring-white dark:ring-[var(--app-bg)] ${index === flow.items.length - 1 ? 'bg-[var(--app-primary)]' : 'bg-slate-300 dark:bg-slate-600'}`} />
            {index < flow.items.length - 1 && <span className="absolute left-[8px] top-6 h-[calc(100%-0.9rem)] w-px bg-[var(--app-border)]" />}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-[var(--app-text)]">{item.actionKnown ? item.actionLabel : item.statusLabel}</span>
                <Badge className={badgeClass(flowStatusTone, item.status)}>{item.statusLabel}</Badge>
                {item.isTransfer && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">真实转派</span>}
              </div>
              <div className="mt-1.5 text-[13px] text-[var(--app-muted)]">{personText}</div>
              {!item.actionKnown && item.rawAction && <div className="mt-1 text-[12px] text-[var(--app-subtle)]">{item.rawAction}</div>}
              {noteText && <div className="mt-1 text-[12px] text-[var(--app-subtle)]">{noteText}</div>}
            </div>
            <div className="shrink-0 text-right text-[13px]">
              <div className="font-medium tabular-nums text-[var(--app-text)]">{formatDateTime(item.createdAt)}</div>
              <div className="mt-1 text-[var(--app-muted)]">{item.durationText}</div>
              {quick && <div className="mt-1 text-[11px] text-[var(--app-subtle)]">快速流转</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DurationAnalysis({ data }) {
  const rows = [
    ['负责人', data?.owner || []],
    ['部门', data?.department || []],
    ['状态', data?.status || []],
  ];

  return (
    <div className="space-y-3 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-3">
      {rows.map(([label, items]) => (
        <div key={label} className="space-y-1.5">
          <div className="text-xs font-medium text-[var(--app-muted)]">{label}停留</div>
          {(items.length ? items : [{ label: '-', hours: 0, percent: 0 }]).slice(0, 3).map((item) => {
            const minutes = Math.round(item.hours * 60);
            return (
              <div key={`${label}-${item.label}`}>
                <div className="mb-0.5 flex justify-between text-xs text-[var(--app-muted)]">
                  <span>{item.label}</span>
                  <span className="font-medium">{minutes}分钟</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--app-border)]">
                  <div className="h-1.5 rounded-full bg-[var(--app-primary)]" style={{ width: `${item.percent || 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Deadline display with countdown and urgency coloring
function DeadlineDisplay({ dueAt, isOverdue }) {
  const urgency = getDeadlineUrgency(dueAt, isOverdue);

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 ${urgency.className}`}>
      <Clock size={16} strokeWidth={1.5} />
      <span className="text-[15px] font-medium">{urgency.text}</span>
    </div>
  );
}

// Task content section with locked/unlocked state
function TaskContentSection({ task, isLocked }) {
  if (isLocked) {
    return (
      <div className="rounded-xl border border-[var(--app-border)] bg-gradient-to-b from-[var(--app-panel-soft)] to-[var(--app-bg)] p-10 text-center">
        <div className="mb-5 flex justify-center">
          <div className="relative">
            <div className="grid size-14 place-items-center rounded-full bg-[var(--app-panel-soft)]">
              <Lock size={26} strokeWidth={1.5} className="text-[var(--app-subtle)]" />
            </div>
          </div>
        </div>
        <p className="text-[15px] text-[var(--app-muted)] mb-2">
          任务详细内容在开始处理后可见
        </p>
        <p className="text-[13px] text-[var(--app-subtle)]">
          点击下方「开始处理」按钮解锁内容
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-5">
      {task.description ? (
        <div className="task-rich-content task-detail-content text-[15px] leading-7 text-[var(--app-text)]" dangerouslySetInnerHTML={{ __html: task.description }} />
      ) : (
        <p className="text-[15px] text-[var(--app-muted)]">暂无详细内容。</p>
      )}
    </div>
  );
}

// Rich text modal dialog - centered, elegant, full featured
function RichTextModal({ open, onClose, onSubmit, value, onChange, saving, config }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const linkInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // Initialize editor content when modal opens
  useEffect(() => {
    if (!open || !editorRef.current) return;
    // Set initial content when modal opens
    editorRef.current.innerHTML = value || '';
  }, [open]);

  // Only sync innerHTML when editor is not focused
  useEffect(() => {
    if (!open || !editorRef.current) return;
    if (document.activeElement === editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [open, value]);

  // Reset link state when modal closes
  useEffect(() => {
    if (!open) {
      setLinkOpen(false);
      setLinkUrl('');
    }
  }, [open]);

  function syncValue() {
    onChange(editorRef.current?.innerHTML || '');
  }

  function runCommand(command) {
    editorRef.current?.focus();
    document.execCommand(command, false, null);
    syncValue();
  }

  function rememberSelection() {
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    if (!selection?.rangeCount || !anchorNode || !editorRef.current?.contains(anchorNode)) return;
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    editorRef.current?.focus();
    if (!savedRangeRef.current) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(savedRangeRef.current);
  }

  function normalizeLinkUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) return '';
    return /^(https?:\/\/|mailto:|tel:|#|\/)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  function insertImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, `<img src="${reader.result}" alt="图片">`);
      syncValue();
    };
    reader.readAsDataURL(file);
  }

  function openLinkEditor() {
    rememberSelection();
    setLinkOpen(true);
    requestAnimationFrame(() => linkInputRef.current?.focus());
  }

  function closeLinkEditor() {
    setLinkOpen(false);
    setLinkUrl('');
  }

  function applyLink() {
    const normalizedUrl = normalizeLinkUrl(linkUrl);
    if (!normalizedUrl) return;
    restoreSelection();
    const selection = window.getSelection();
    const hasSelectedText = selection?.rangeCount && !selection.isCollapsed && editorRef.current?.contains(selection.anchorNode);
    if (hasSelectedText) {
      document.execCommand('createLink', false, normalizedUrl);
    } else {
      const anchor = document.createElement('a');
      anchor.href = normalizedUrl;
      anchor.textContent = linkUrl.trim();
      document.execCommand('insertHTML', false, anchor.outerHTML);
    }
    syncValue();
    closeLinkEditor();
  }

  function handleLinkKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyLink();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLinkEditor();
      editorRef.current?.focus();
    }
  }

  if (!open) return null;

  const { icon: Icon, title, hint, placeholder, submitLabel, color } = config;
  const hasContent = value.replace(/<[^>]*>/g, '').trim();

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30 px-4 py-6 backdrop-blur-[2px]">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-modalPop rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(15,23,42,0.24)]" onMouseDown={(event) => event.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--app-border)]">
          <div className={`flex items-center gap-2 text-base font-semibold ${color.text}`}>
            <Icon size={20} />
            {title}
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {/* Target Info - for remind dialog */}
          {config.targetInfo && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-700/50 dark:bg-amber-900/30">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-amber-700 dark:text-amber-400">催办对象：</span>
                <span className="font-medium text-amber-800 dark:text-amber-300">{config.targetInfo}</span>
              </div>
              {config.senderInfo && (
                <div className="flex items-center gap-2 text-sm mt-1.5">
                  <span className="text-amber-700 dark:text-amber-400">催办人：</span>
                  <span className="font-medium text-amber-800 dark:text-amber-300">{config.senderInfo}</span>
                </div>
              )}
              {config.taskTitle && (
                <div className="flex items-center gap-2 text-sm mt-1.5">
                  <span className="text-amber-700 dark:text-amber-400">任务标题：</span>
                  <span className="font-medium text-amber-800 dark:text-amber-300 truncate">{config.taskTitle}</span>
                </div>
              )}
              {config.dueAt && (
                <div className="flex items-center gap-2 text-sm mt-1.5">
                  <span className="text-amber-700 dark:text-amber-400">截止时间：</span>
                  <span className="font-medium text-amber-800 dark:text-amber-300">{config.dueAt}</span>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-[var(--app-muted)] mb-3">{hint}</p>

          {/* Toolbar - full featured */}
          <div className="relative flex items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-1 mb-2">
            {[
              ['bold', Bold, '加粗'],
              ['italic', Italic, '斜体'],
              ['insertUnorderedList', List, '列表'],
            ].map(([command, CmdIcon, label]) => (
              <button
                key={command}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runCommand(command)}
                className="grid size-7 place-items-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
                title={label}
              >
                <CmdIcon size={14} />
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openLinkEditor}
              className={`grid size-7 place-items-center rounded-md transition ${
                linkOpen ? 'bg-[var(--app-primary)]/10 text-[var(--app-primary)]' : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'
              }`}
              title="插入链接"
            >
              <Link2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="grid size-7 place-items-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              title="插入图片"
            >
              <ImagePlus size={14} />
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => insertImage(e.target.files?.[0])} />

            {linkOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[260px] rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-2 shadow-lg">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--app-text)] mb-1.5">
                  <span className="grid size-5 place-items-center rounded bg-[var(--app-primary)]/10 text-[var(--app-primary)]">
                    <Link2 size={12} />
                  </span>
                  链接地址
                </div>
                <div className="flex items-center gap-1.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 focus-within:border-[var(--app-primary)]">
                  <input
                    ref={linkInputRef}
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={handleLinkKeyDown}
                    placeholder="https://..."
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    disabled={!linkUrl.trim()}
                    onClick={applyLink}
                    className="grid size-6 place-items-center rounded bg-[var(--app-primary)] text-white disabled:bg-[var(--app-panel-soft)] disabled:text-[var(--app-subtle)]"
                  >
                    <Check size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Editor */}
          <div
            ref={editorRef}
            className="task-rich-text min-h-[120px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[var(--app-primary)]"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            data-placeholder={placeholder}
            onInput={syncValue}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-[var(--app-border)]">
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-[var(--app-border)] px-4 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)]"
          >
            取消
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !hasContent}
            className={`h-9 rounded-lg px-5 text-sm font-semibold text-white transition-all disabled:opacity-50 ${color.button}`}
          >
            <span className="flex items-center gap-1.5">
              <Icon size={15} />
              {saving ? '提交中...' : submitLabel}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Collapsible section wrapper
function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2.5 text-[15px] font-medium text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"
      >
        <span>{title}</span>
        <ChevronDown
          size={18}
          strokeWidth={1.5}
          className={`text-[var(--app-subtle)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="animate-slideDown">
          {children}
        </div>
      )}
    </section>
  );
}

function localDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const deadlineQuickOptions = [
  { label: '今天', days: 0 },
  { label: '明天', days: 1 },
  { label: '本周五', days: ((5 - new Date().getDay()) % 7) || 7 },
  { label: '下周', days: 7 },
];

function deadlineToIso(dateValue, includeTime, timeValue) {
  if (!dateValue) return null;
  return new Date(`${dateValue}T${includeTime ? timeValue || '23:59' : '23:59'}`).toISOString();
}

// 精致的日期选择器组件
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function ElegantDatePicker({ value, onChange, showTime, timeValue, onTimeChange, onToggleTime }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(value + 'T00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const containerRef = useRef(null);

  const selectedDate = value ? new Date(value + 'T00:00') : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function formatDateDisplay(d) {
    if (!d) return '选择日期';
    const date = new Date(d + 'T00:00');
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return '今天';
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function getDaysInMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }

  function isDateDisabled(date) {
    return date < today;
  }

  function selectDate(date) {
    if (isDateDisabled(date)) return;
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    onChange(local.toISOString().slice(0, 10));
    setOpen(false);
  }

  function prevMonth() {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  }

  function nextMonth() {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  }

  const days = getDaysInMonth(viewMonth);

  return (
    <div className="flex items-center gap-2">
      {/* 日期选择 */}
      <div ref={containerRef} className="relative flex-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="h-11 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 pr-10 text-left text-sm font-medium outline-none transition hover:border-[var(--app-muted)] focus:border-[var(--app-primary)]"
        >
          <span className={value ? 'text-[var(--app-text)]' : 'text-[var(--app-subtle)]'}>
            {formatDateDisplay(value)}
          </span>
          <Calendar size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
        </button>

        {open && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-[240px] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            {/* 月份导航 */}
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={prevMonth} className="grid size-7 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-semibold">{viewMonth.getFullYear()}年{MONTHS[viewMonth.getMonth()]}</span>
              <button type="button" onClick={nextMonth} className="grid size-7 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]">
                <ChevronRight size={14} />
              </button>
            </div>

            {/* 星期头 */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((day) => (
                <div key={day} className="text-center text-[10px] font-medium text-[var(--app-subtle)] py-0.5">{day}</div>
              ))}
            </div>

            {/* 日期格子 */}
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((date, idx) => {
                if (!date) return <div key={`empty-${idx}`} className="h-7" />;
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                const isTodayDate = date.toDateString() === today.toDateString();
                const disabled = isDateDisabled(date);
                return (
                  <button
                    key={date.getTime()}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectDate(date)}
                    className={`h-7 rounded-[4px] text-xs font-medium transition ${
                      disabled
                        ? 'text-[var(--app-subtle)] cursor-not-allowed'
                        : isSelected
                          ? 'bg-[var(--app-primary)] text-white'
                          : isTodayDate
                            ? 'text-[var(--app-primary)] font-bold hover:bg-[var(--app-panel-soft)]'
                            : 'text-[var(--app-text)] hover:bg-[var(--app-panel-soft)]'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* 快捷选项 */}
            <div className="mt-2 flex gap-1 border-t border-[var(--app-border)] pt-2">
              {deadlineQuickOptions.slice(0, 3).map((option) => {
                const optionValue = localDateInputValue(new Date(Date.now() + option.days * 86400000));
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => { onChange(optionValue); setOpen(false); }}
                    className={`h-6 rounded-[4px] px-2 text-[10px] font-medium transition ${
                      value === optionValue ? 'bg-[var(--app-primary)] text-white' : 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 时间选择 */}
      <button
        type="button"
        onClick={onToggleTime}
        className={`flex h-11 items-center gap-1 rounded-[8px] border px-3 text-xs font-medium transition ${
          showTime
            ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
            : 'border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)] hover:text-[var(--app-text)]'
        }`}
      >
        <Clock3 size={13} />
        {showTime ? '关闭' : '时间'}
      </button>

      {showTime && (
        <input
          type="time"
          autoFocus
          value={timeValue}
          onChange={(e) => onTimeChange(e.target.value)}
          className="h-11 w-[88px] rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel)] px-2 text-xs font-medium outline-none focus:border-[var(--app-primary)]"
        />
      )}
    </div>
  );
}

function createInitialTaskForm(currentUser) {
  return {
    title: '',
    description: '',
    candidate_owner_ids: [],
    due_date: localDateInputValue(),
    due_has_time: false,
    due_time: '23:59',
    confirmer_id: '',
    participant_ids: [],
    priority: 'low',
  };
}

function selectedUsers(users = [], selectedIds = []) {
  const selectedSet = new Set(selectedIds.map(String));
  return users.filter((item) => selectedSet.has(String(item.id)));
}

function toggleStringId(values, id) {
  const idText = String(id);
  return values.includes(idText) ? values.filter((value) => value !== idText) : [...values, idText];
}

function TaskCreateModal({ open, meta, currentUser, restoreFocusRef, onClose, onCreated }) {
  const [form, setForm] = useState(() => createInitialTaskForm(currentUser));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      setForm(createInitialTaskForm(currentUser));
      setAdvancedOpen(false);
      setError('');
      requestAnimationFrame(() => titleRef.current?.focus());
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      setSaving(false);
      setForm(createInitialTaskForm(currentUser));
      setAdvancedOpen(false);
      setError('');
      requestAnimationFrame(() => restoreFocusRef?.current?.focus());
    }
  }, [currentUser, open, restoreFocusRef]);

  function closeModal() {
    if (saving) return;
    onClose();
  }

  async function submit() {
    const candidateIds = form.candidate_owner_ids.map(Number).filter(Boolean);
    if (!form.title.trim()) {
      setError('请填写任务标题。');
      titleRef.current?.focus();
      return;
    }
    if (!candidateIds.length) {
      setError('请至少选择一位负责人。');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const task = await api.createTask({
        title: form.title.trim(),
        description: form.description,
        candidate_owner_ids: candidateIds,
        due_at: deadlineToIso(form.due_date, form.due_has_time, form.due_time),
        confirmer_id: form.confirmer_id ? Number(form.confirmer_id) : null,
        participant_ids: form.participant_ids.map(Number).filter(Boolean),
        priority: form.priority,
      });
      onCreated(task);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/35 px-4 pt-[8vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
      role="presentation"
    >
      <section
        className="flex max-h-[86vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.28)] animate-modalPop"
        role="dialog"
        aria-modal="true"
        aria-label="新建任务"
      >
        <div className="flex min-h-[68px] items-center gap-3 border-b border-[var(--app-border)] px-6">
          <input
            ref={titleRef}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            className="h-16 min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none placeholder:text-[var(--app-subtle)] focus-visible:outline-none"
            placeholder="任务标题"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={closeModal}
            className="grid size-10 shrink-0 place-items-center rounded-[10px] text-[var(--app-muted)] transition-all duration-200 hover:bg-[var(--app-panel-soft)]"
            aria-label="关闭新建任务"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            <RichTextEditor
              value={form.description}
              onChange={(description) => setForm({ ...form, description })}
            />

            <div className="space-y-2">
              <SmartUserPicker
                label="负责人"
                users={meta.users}
                currentUser={currentUser}
                selectedIds={form.candidate_owner_ids}
                onChange={(candidate_owner_ids) => setForm({ ...form, candidate_owner_ids })}
                required
              />
              <p className="text-[13px] leading-5 text-[var(--app-muted)]">多人时先进入各自待办，最先开始处理的人会成为实际负责人。可搜索其他人员，部门将自动匹配。</p>
            </div>

            {/* 精致截止日期选择器 */}
            <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-[10px] bg-[var(--app-primary)]/10 text-[var(--app-primary)]">
                  <Calendar size={16} strokeWidth={1.5} />
                </span>
                <div>
                  <div className="text-[15px] font-semibold">截止日期</div>
                  <div className="text-[13px] text-[var(--app-muted)]">默认截止到 23:59</div>
                </div>
              </div>

              <ElegantDatePicker
                value={form.due_date}
                onChange={(due_date) => setForm({ ...form, due_date })}
                showTime={form.due_has_time}
                timeValue={form.due_time}
                onTimeChange={(due_time) => setForm({ ...form, due_time })}
                onToggleTime={() => setForm({ ...form, due_has_time: !form.due_has_time })}
              />
            </div>

            <div className="rounded-[10px] border border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                className="flex h-12 w-full items-center justify-between px-4 text-[15px] font-medium transition-colors hover:bg-[var(--app-panel-soft)]"
              >
                高级字段
                <ChevronDown size={16} strokeWidth={1.5} className={`text-[var(--app-muted)] transition ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>

              {advancedOpen && (
                <div className="space-y-5 border-t border-[var(--app-border)] p-4">
                  <PriorityControl
                    priorities={meta.priorities}
                    value={form.priority}
                    onChange={(priority) => setForm({ ...form, priority })}
                  />

                    <SingleUserSelect
                      label="确认"
                      users={meta.users}
                      value={form.confirmer_id}
                      onChange={(confirmer_id) => setForm({ ...form, confirmer_id })}
                    emptyLabel="不指定"
                  />

                  <UserMultiPicker
                    label="协作人 / 关注人"
                    helper="用于同步任务进展，不影响实际负责人。"
                    users={meta.users}
                    selectedIds={form.participant_ids}
                    onChange={(participant_ids) => setForm({ ...form, participant_ids })}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] bg-[var(--app-panel)] px-6 py-4">
          <div className="min-w-0 text-[15px] text-red-600 dark:text-red-300">{error}</div>
          <div className="flex shrink-0 items-center gap-2.5">
            <button type="button" onClick={closeModal} disabled={saving} className="h-11 rounded-[10px] border border-[var(--app-border)] px-5 text-[15px] font-medium text-[var(--app-muted)] transition-colors disabled:opacity-60 hover:bg-[var(--app-panel-soft)]">
              取消
            </button>
            <button type="button" disabled={saving || !form.title.trim()} onClick={submit} className="h-11 rounded-[10px] bg-[var(--app-primary)] px-6 text-[15px] font-medium text-white transition-colors disabled:opacity-60 hover:bg-[var(--app-primary-strong)]">
              {saving ? '创建中...' : '创建任务'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const linkInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    if (!editorRef.current || document.activeElement === editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  function syncValue() {
    onChange(editorRef.current?.innerHTML || '');
  }

  function runCommand(command, commandValue = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  }

  function rememberSelection() {
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    if (!selection?.rangeCount || !anchorNode || !editorRef.current?.contains(anchorNode)) return;
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    editorRef.current?.focus();
    if (!savedRangeRef.current) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(savedRangeRef.current);
  }

  function normalizeLinkUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) return '';
    return /^(https?:\/\/|mailto:|tel:|#|\/)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  function insertImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, `<img src="${reader.result}" alt="粘贴图片">`);
      syncValue();
    };
    reader.readAsDataURL(file);
  }

  function handlePaste(event) {
    const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    event.preventDefault();
    insertImage(imageItem.getAsFile());
  }

  function openLinkEditor() {
    rememberSelection();
    setLinkOpen(true);
    requestAnimationFrame(() => linkInputRef.current?.focus());
  }

  function closeLinkEditor() {
    setLinkOpen(false);
    setLinkUrl('');
  }

  function applyLink() {
    const normalizedUrl = normalizeLinkUrl(linkUrl);
    if (!normalizedUrl) return;

    restoreSelection();
    const selection = window.getSelection();
    const hasSelectedText = selection?.rangeCount && !selection.isCollapsed && editorRef.current?.contains(selection.anchorNode);

    if (hasSelectedText) {
      document.execCommand('createLink', false, normalizedUrl);
    } else {
      const anchor = document.createElement('a');
      anchor.href = normalizedUrl;
      anchor.textContent = linkUrl.trim();
      document.execCommand('insertHTML', false, anchor.outerHTML);
    }

    syncValue();
    closeLinkEditor();
  }

  function handleLinkKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyLink();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLinkEditor();
      editorRef.current?.focus();
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">任务内容</span>
        <div className="relative flex items-center gap-1 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] p-1">
          {[
            ['bold', Bold, '加粗'],
            ['italic', Italic, '斜体'],
            ['insertUnorderedList', List, '项目列表'],
          ].map(([command, Icon, label]) => (
            <button
              key={command}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand(command)}
              className="grid size-8 place-items-center rounded-[7px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label={label}
              title={label}
            >
              <Icon size={15} />
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={openLinkEditor}
            className={`grid size-8 place-items-center rounded-[7px] transition ${
              linkOpen
                ? 'bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
                : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'
            }`}
            aria-label="插入链接"
            title="插入链接"
          >
            <Link2 size={15} />
          </button>
          <button type="button" onClick={() => imageInputRef.current?.click()} className="grid size-8 place-items-center rounded-[7px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]" aria-label="插入图片" title="插入图片">
            <ImagePlus size={15} />
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => insertImage(event.target.files?.[0])} />

          {linkOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] p-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.16)] sm:w-[320px]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--app-text)]">
                  <span className="grid size-6 place-items-center rounded-[7px] bg-[var(--app-primary)]/10 text-[var(--app-primary)]">
                    <Link2 size={13} />
                  </span>
                  链接地址
                </div>
                <button
                  type="button"
                  onClick={closeLinkEditor}
                  className="grid size-6 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
                  aria-label="关闭链接输入"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-2 transition focus-within:border-[var(--app-primary)]">
                <input
                  ref={linkInputRef}
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  onKeyDown={handleLinkKeyDown}
                  placeholder="https://example.com"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--app-subtle)] focus-visible:outline-none"
                  autoComplete="off"
                />
                <button
                  type="button"
                  disabled={!linkUrl.trim()}
                  onClick={applyLink}
                  className="grid size-7 place-items-center rounded-[7px] bg-[var(--app-primary)] text-white transition disabled:bg-[var(--app-panel-soft)] disabled:text-[var(--app-subtle)]"
                  aria-label="应用链接"
                >
                  <Check size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div
        ref={editorRef}
        className="task-rich-text min-h-[180px] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[var(--app-primary)]"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="任务内容"
        data-placeholder="输入任务内容，支持粘贴图片。"
        onInput={syncValue}
        onPaste={handlePaste}
      />
    </div>
  );
}

function userSearchText(user) {
  return [
    displayUser(user),
    user?.username,
    user?.email,
    user?.default_department?.name,
  ].filter(Boolean).join(' ').toLowerCase();
}

function UserSelectControl({
  label,
  helper,
  users = [],
  selectedIds = [],
  value = '',
  onChange,
  onUserSelect,
  multiple = false,
  required,
  className = '',
  emptyLabel = '选择人员',
  emptyDescription = '搜索姓名或部门后选择',
  includeEmpty = false,
  emptyOptionLabel = '不指定',
  emptyOptionDescription = '保留默认确认流程',
  searchPlaceholder = '搜索姓名、部门',
  showFrequent = false,
  frequentUsers = [],
  manageFrequentOpen = false,
  onToggleManageFrequent,
  onRemoveFrequent,
  showSelectedChips = false,
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const selectedSet = new Set(multiple ? selectedIds.map(String) : (value ? [String(value)] : []));
  const pickedUsers = multiple ? selectedUsers(users, selectedIds) : [];
  const selectedUser = multiple ? null : users.find((item) => String(item.id) === String(value));
  const query = searchQuery.trim().toLowerCase();
  const visibleUsers = useMemo(() => {
    if (!query) return users;
    return users.filter((user) => userSearchText(user).includes(query));
  }, [query, users]);

  const primaryText = multiple
    ? pickedUsers.length
      ? `${pickedUsers.slice(0, 2).map(displayUser).join('、')}${pickedUsers.length > 2 ? ` 等 ${pickedUsers.length} 人` : ''}`
      : emptyLabel
    : selectedUser
      ? displayUser(selectedUser)
      : emptyLabel;
  const secondaryText = multiple
    ? pickedUsers.length
      ? `已选择 ${pickedUsers.length} 人 · 点击调整`
      : emptyDescription
    : selectedUser?.default_department?.name || emptyDescription;
  const leadUser = multiple ? pickedUsers[0] : selectedUser;

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function chooseUser(user) {
    if (multiple) {
      const nextIds = toggleStringId(selectedIds, user.id);
      onChange(nextIds);
      onUserSelect?.(user, nextIds);
      setSearchQuery('');
      return;
    }

    onChange(String(user.id));
    onUserSelect?.(user, String(user.id));
    setOpen(false);
    setSearchQuery('');
  }

  function chooseEmpty() {
    onChange('');
    setOpen(false);
    setSearchQuery('');
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setSearchQuery('');
    }
  }

  function renderUserRow(user, { compact = false, frequent = false } = {}) {
    const selected = selectedSet.has(String(user.id));
    const canRemove = frequent && manageFrequentOpen && user.id !== undefined;
    return (
      <button
        key={`${frequent ? 'frequent' : 'user'}-${user.id}`}
        type="button"
        onClick={() => canRemove ? onRemoveFrequent?.(user.id) : chooseUser(user)}
        className={`flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left transition hover:bg-[var(--app-panel-soft)] ${
          selected ? 'bg-[var(--app-primary)]/10' : ''
        } ${compact ? 'py-1.5' : ''}`}
      >
        <span className={`grid size-8 shrink-0 place-items-center rounded-[8px] text-sm font-semibold ${
          selected
            ? 'bg-[var(--app-primary)] text-white'
            : canRemove
              ? 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300'
              : 'bg-[var(--app-panel-soft)] text-[var(--app-text)]'
        }`}
        >
          {canRemove ? <X size={14} /> : displayUser(user)[0]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--app-text)]">{displayUser(user)}</span>
          <span className="block truncate text-xs text-[var(--app-subtle)]">{user.default_department?.name || '未设置部门'}</span>
        </span>
        {selected && !canRemove && <Check size={14} className="text-[var(--app-primary)]" />}
      </button>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <div className="flex items-center gap-1 text-sm font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}
      </div>
      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`flex min-h-11 w-full items-center gap-3 rounded-[10px] border px-3 py-2 text-left transition ${
            open
              ? 'border-[var(--app-primary)] bg-[var(--app-panel)]'
              : 'border-[var(--app-border)] bg-[var(--app-bg)] hover:border-[var(--app-muted)]'
          }`}
        >
          <span className={`grid size-8 shrink-0 place-items-center rounded-[8px] text-sm font-semibold ${
            leadUser
              ? 'bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
              : 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
          }`}
          >
            {leadUser ? displayUser(leadUser)[0] : multiple ? <Users size={15} /> : <ClipboardCheck size={15} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm font-medium ${leadUser ? 'text-[var(--app-text)]' : 'text-[var(--app-muted)]'}`}>
              {primaryText}
            </span>
            <span className="block truncate text-xs text-[var(--app-subtle)]">{secondaryText}</span>
          </span>
          <ChevronDown size={15} className={`shrink-0 text-[var(--app-muted)] transition ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_12px_36px_rgba(0,0,0,0.16)]">
            <div className="border-b border-[var(--app-border)] p-2">
              <div className="flex items-center gap-2 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-2 transition focus-within:border-[var(--app-primary)]">
                <Search size={14} className="shrink-0 text-[var(--app-muted)]" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--app-subtle)] focus-visible:outline-none"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="grid size-5 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]"
                    aria-label="清空搜索"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {showFrequent && !query && frequentUsers.length > 0 && (
              <div className="border-b border-[var(--app-border)] p-1.5">
                <div className="flex items-center justify-between px-1.5 py-1 text-[11px] text-[var(--app-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles size={12} />
                    常用负责人
                  </span>
                  <button
                    type="button"
                    onClick={onToggleManageFrequent}
                    className="rounded-[6px] px-1.5 py-0.5 text-[11px] text-[var(--app-subtle)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-muted)]"
                  >
                    {manageFrequentOpen ? '完成' : '管理'}
                  </button>
                </div>
                <div className="space-y-1">
                  {frequentUsers.map((item) => renderUserRow(item, { compact: true, frequent: true }))}
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-auto p-1.5">
              {includeEmpty && !query && (
                <button
                  type="button"
                  onClick={chooseEmpty}
                  className={`mb-1 flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left transition hover:bg-[var(--app-panel-soft)] ${
                    !selectedUser ? 'bg-[var(--app-panel-soft)]' : ''
                  }`}
                >
                  <span className="grid size-8 place-items-center rounded-[8px] bg-[var(--app-panel-soft)] text-[var(--app-muted)]">
                    <ClipboardCheck size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--app-text)]">{emptyOptionLabel}</span>
                    <span className="block truncate text-xs text-[var(--app-subtle)]">{emptyOptionDescription}</span>
                  </span>
                  {!selectedUser && <Check size={14} className="text-[var(--app-primary)]" />}
                </button>
              )}

              {visibleUsers.length > 0 ? (
                <div className="space-y-1">
                  {visibleUsers.map((item) => renderUserRow(item))}
                </div>
              ) : (
                <div className="px-3 py-5 text-center text-sm text-[var(--app-subtle)]">未找到匹配的人员</div>
              )}
            </div>
          </div>
        )}
      </div>
      {multiple && showSelectedChips && pickedUsers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pickedUsers.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(toggleStringId(selectedIds, item.id))}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-[var(--app-text)] px-2.5 text-xs font-medium text-[var(--app-panel)] transition hover:opacity-80"
            >
              {displayUser(item)}
              <X size={12} />
            </button>
          ))}
        </div>
      )}
      {helper && <p className="mt-1.5 text-xs leading-5 text-[var(--app-muted)]">{helper}</p>}
    </div>
  );
}

// 智能负责人选择器：常用气泡快速选 + 搜索兜底
function SmartUserPicker({ label, helper, users = [], selectedIds = [], onChange, required, currentUser, className = '' }) {
  const [manageOpen, setManageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const containerRef = useRef(null);
  const [frequentIds, setFrequentIds] = useState(() => {
    try {
      const saved = localStorage.getItem('flowdesk_frequent_owners');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  function saveFrequentIds(ids) {
    setFrequentIds(ids);
    localStorage.setItem('flowdesk_frequent_owners', JSON.stringify(ids));
  }

  const frequentUsers = useMemo(() => {
    const byId = {};
    users.forEach((user) => {
      byId[user.id] = user;
    });
    const list = frequentIds.map((id) => byId[id]).filter(Boolean);
    if (currentUser && !frequentIds.includes(currentUser.id)) {
      return [currentUser, ...list.slice(0, 4)];
    }
    return list.slice(0, 5);
  }, [users, frequentIds, currentUser]);

  const pickedUsers = selectedUsers(users, selectedIds);
  const selectedSet = new Set(selectedIds.map(String));
  const query = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!query) return [];
    return users.filter((user) => userSearchText(user).includes(query)).slice(0, 8);
  }, [query, users]);

  useEffect(() => {
    if (!searchOpen) return;
    const handleClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchOpen]);

  function rememberFrequent(user) {
    if (!frequentIds.includes(user.id)) {
      saveFrequentIds([user.id, ...frequentIds.slice(0, 4)]);
    }
  }

  function removeFromFrequent(userId) {
    saveFrequentIds(frequentIds.filter((id) => id !== userId));
  }

  function toggleOwner(user, { remember = false } = {}) {
    onChange(toggleStringId(selectedIds, user.id));
    if (remember) rememberFrequent(user);
  }

  function selectSearchUser(user) {
    toggleOwner(user);
    setSearchQuery('');
    setSearchOpen(false);
  }

  return (
    <div ref={containerRef} className={className}>
      <div className="flex items-center gap-1 text-sm font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}
      </div>
      <div className="mt-2 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-2.5">
        {pickedUsers.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pickedUsers.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleOwner(item)}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-[var(--app-text)] px-2.5 text-xs font-medium text-[var(--app-panel)] transition hover:opacity-80"
              >
                {displayUser(item)}
                <X size={12} />
              </button>
            ))}
          </div>
        )}

        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 text-[11px] text-[var(--app-muted)]">
            <Sparkles size={12} />
            <span>常用负责人</span>
          </div>
          {frequentUsers.length > 0 && (
            <button
              type="button"
              onClick={() => setManageOpen((value) => !value)}
              className="rounded-[6px] px-1.5 py-0.5 text-[11px] text-[var(--app-subtle)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-muted)]"
            >
              {manageOpen ? '完成' : '管理'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {frequentUsers.map((item) => {
            const selected = selectedSet.has(String(item.id));
            const canRemove = manageOpen && item.id !== currentUser?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => canRemove ? removeFromFrequent(item.id) : toggleOwner(item)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${
                  canRemove
                    ? 'border-red-300 bg-red-50 text-red-500 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
                    : selected
                      ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
                      : 'border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)] hover:border-[var(--app-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                {canRemove ? <X size={12} /> : null}
                {displayUser(item)}
                {!canRemove && selected && <Check size={12} />}
              </button>
            );
          })}
          {frequentUsers.length === 0 && (
            <span className="px-1 py-1 text-sm text-[var(--app-subtle)]">暂无常用负责人</span>
          )}
        </div>

        <div className="relative mt-3">
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 transition focus-within:border-[var(--app-primary)]">
            <Search size={14} className="shrink-0 text-[var(--app-muted)]" />
            <input
              value={searchQuery}
              onFocus={() => {
                if (searchQuery.trim()) setSearchOpen(true);
              }}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchOpen(Boolean(event.target.value.trim()));
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearchOpen(false);
                  setSearchQuery('');
                }
              }}
              placeholder="搜索添加其他负责人"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--app-subtle)] focus-visible:outline-none"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                className="grid size-5 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]"
                aria-label="清空搜索"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {searchOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-auto rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.16)]">
              {searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((item) => {
                    const selected = selectedSet.has(String(item.id));
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectSearchUser(item)}
                        className={`flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left transition hover:bg-[var(--app-panel-soft)] ${
                          selected ? 'bg-[var(--app-primary)]/10' : ''
                        }`}
                      >
                        <span className={`grid size-8 shrink-0 place-items-center rounded-[8px] text-sm font-semibold ${
                          selected ? 'bg-[var(--app-primary)] text-white' : 'bg-[var(--app-panel-soft)] text-[var(--app-text)]'
                        }`}
                        >
                          {displayUser(item)[0]}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--app-text)]">{displayUser(item)}</span>
                          <span className="block truncate text-xs text-[var(--app-subtle)]">{item.default_department?.name || '未设置部门'}</span>
                        </span>
                        {selected && <Check size={14} className="text-[var(--app-primary)]" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-5 text-center text-sm text-[var(--app-subtle)]">未找到匹配的人员</div>
              )}
            </div>
          )}
        </div>
      </div>
      {helper && <p className="mt-1.5 text-xs leading-5 text-[var(--app-muted)]">{helper}</p>}
    </div>
  );
}

function UserMultiPicker({ label, helper, users = [], selectedIds = [], onChange, required, className = '' }) {
  return (
    <UserSelectControl
      label={label}
      helper={helper}
      users={users}
      selectedIds={selectedIds}
      onChange={onChange}
      multiple
      required={required}
      className={className}
      emptyLabel="选择协作人"
      emptyDescription="搜索姓名、部门后添加"
      searchPlaceholder="搜索协作人姓名、部门"
      showSelectedChips
    />
  );
}

function SingleUserSelect({ label, users = [], value, onChange, emptyLabel = '不指定', helper }) {
  return (
    <UserSelectControl
      label={label}
      helper={helper}
      users={users}
        value={value}
        onChange={onChange}
        emptyLabel={emptyLabel}
        emptyDescription="不指定时由创建人确认"
        includeEmpty
        emptyOptionLabel={emptyLabel}
        emptyOptionDescription="默认由创建人确认"
        searchPlaceholder="搜索确认人姓名、部门"
      />
  );
}

function PriorityControl({ priorities = [], value, onChange }) {
  return (
    <div>
      <div className="text-sm font-medium">优先级</div>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-1">
        {priorities.map((priority) => (
          <button
            key={priority.value}
            type="button"
            onClick={() => onChange(priority.value)}
            className={`h-9 rounded-[8px] text-sm font-medium transition ${
              value === priority.value
                ? 'bg-[var(--app-text)] text-[var(--app-panel)]'
                : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'
            }`}
          >
            {priority.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// 成员行组件
function MemberItem({ member, canManage, onEdit, onDeactivate, onDelete, onResetPassword, onTransferTasks }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-[var(--app-border)] last:border-0 hover:bg-[var(--app-panel-soft)] transition-colors">
      {/* 成员头像 */}
      <div className="size-8 rounded-full bg-[var(--app-primary)]/10 grid place-items-center text-[var(--app-primary)]">
        <span className="text-[13px] font-medium">
          {(member.display_name || member.first_name || member.username)?.[0]?.toUpperCase()}
        </span>
      </div>

      {/* 成员信息 */}
      <div className="flex-1 min-w-0">
        <span className="text-[15px] font-medium text-[var(--app-text)]">
          {member.display_name || member.first_name || member.username}
        </span>
        <span className="text-[13px] text-[var(--app-subtle)] ml-2">@{member.username}</span>
      </div>

      {/* 角色 Badge */}
      <span className={`text-[13px] px-2.5 py-1 rounded-full font-medium ${
        member.role === 'super_admin'
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
        : member.role === 'department_manager'
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
        : 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
      }`}>
        {member.role === 'super_admin' ? '超管'
          : member.role === 'department_manager' ? '负责人'
          : '成员'}
      </span>

      {/* 操作按钮 */}
      {canManage && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-[6px] px-2 py-1 text-[13px] text-[var(--app-muted)] hover:bg-[var(--app-panel)] transition-colors"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={onTransferTasks}
            className="rounded-[6px] px-2 py-1 text-[13px] text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 transition-colors"
          >
            转移
          </button>
          <button
            type="button"
            onClick={onDeactivate}
            className="rounded-[6px] px-2 py-1 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            禁用
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-[6px] px-2 py-1 text-[13px] text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            删除
          </button>
          <button
            type="button"
            onClick={onResetPassword}
            className="rounded-[6px] px-2 py-1 text-[13px] text-[var(--app-muted)] hover:bg-[var(--app-panel)] transition-colors"
          >
            重置密码
          </button>
        </div>
      )}
    </div>
  );
}

// 部门树节点组件 - 重构版本
function DeptTreeNode({
  dept,
  isSuperAdmin,
  managedDeptIds,
  onCreateChild,
  onEditDept,
  onCreateMember,
  onEditMember,
  onDeactivateDept,
  onDeactivateMember,
  onDeleteMember,
  onResetPassword,
  onTransferTasks,
  expandedDepts,
  toggleExpand,
  membersByDept,
  loadingMembers,
  level = 0
}) {
  const canManage = isSuperAdmin || managedDeptIds.includes(dept.id);
  const hasChildren = dept.children?.length > 0;
  const isExpanded = expandedDepts[dept.id];
  const members = membersByDept[dept.id] || [];
  const isLoading = loadingMembers[dept.id];

  // 检查是否可禁用部门：无子部门且无成员
  const canDeactivate = canManage && !hasChildren && (dept.member_count === 0);

  return (
    <div className="select-none">
      {/* 部门节点头部 */}
      <div
        className={`flex items-center gap-3 py-3 px-4 rounded-[10px]
          bg-[var(--app-panel)] border border-[var(--app-border)]
          transition-all duration-200
          ${level > 0 ? 'ml-7 mt-1' : ''}
          hover:shadow-[var(--shadow-sm)]`}
      >
        {/* 展开/收起按钮 */}
        <button
          type="button"
          onClick={() => toggleExpand(dept.id)}
          className="flex size-6 items-center justify-center rounded-[6px]
            text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]
            hover:text-[var(--app-text)] transition-colors"
        >
          <ChevronRight
            size={16}
            strokeWidth={1.5}
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>

        {/* 部门图标 */}
        <Building2 size={16} strokeWidth={1.5} className="text-[var(--app-muted)]" />

        {/* 部门名称 */}
        <span className="flex-1 text-[15px] font-medium text-[var(--app-text)]">
          {dept.name}
        </span>

        {/* 负责人 */}
        {dept.manager && (
          <span className="text-[13px] text-[var(--app-subtle)]">
            {dept.manager.display_name || dept.manager.first_name || dept.manager.username}
          </span>
        )}

        {/* 成员数 */}
        <span className="text-[13px] text-[var(--app-muted)] tabular-nums">
          {dept.member_count || 0} 人
        </span>

        {/* 操作按钮 */}
        {canManage && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onCreateChild(dept.id)}
              className="rounded-[6px] px-2.5 py-1.5 text-[13px] text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 transition-colors"
            >
              新增子部门
            </button>
            <button
              type="button"
              onClick={() => onEditDept(dept)}
              className="rounded-[6px] px-2.5 py-1.5 text-[13px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              编辑
            </button>
            {canDeactivate && (
              <button
                type="button"
                onClick={() => onDeactivateDept(dept)}
                className="rounded-[6px] px-2.5 py-1.5 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                禁用
              </button>
            )}
          </div>
        )}
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className={`ml-7 mt-1 ${level > 0 ? '' : ''}`}>
          {/* 成员列表 */}
          <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] overflow-hidden">
            {isLoading ? (
              <div className="py-6 text-center text-[var(--app-muted)]">
                <RefreshCw size={16} className="animate-spin mx-auto" />
                <span className="mt-2 text-[13px]">加载成员...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="py-6 text-center text-[var(--app-subtle)]">
                <Users size={20} strokeWidth={1.5} className="mx-auto opacity-50" />
                <span className="mt-2 text-[13px]">暂无成员</span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onCreateMember(dept.id)}
                    className="mt-3 text-[13px] text-[var(--app-primary)] hover:underline"
                  >
                    添加成员
                  </button>
                )}
              </div>
            ) : (
              <>
                {members.map(member => (
                  <MemberItem
                    key={member.id}
                    member={member}
                    canManage={member.can_manage}
                    onEdit={() => onEditMember(member)}
                    onDeactivate={() => onDeactivateMember(member)}
                    onDelete={() => onDeleteMember(member)}
                    onResetPassword={() => onResetPassword(member)}
                    onTransferTasks={() => onTransferTasks(member)}
                  />
                ))}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onCreateMember(dept.id)}
                    className="w-full py-2.5 text-[13px] text-[var(--app-primary)]
                      border-t border-[var(--app-border)]
                      hover:bg-[var(--app-primary)]/10 transition-colors"
                  >
                    + 新增成员
                  </button>
                )}
              </>
            )}
          </div>

          {/* 子部门 */}
          {hasChildren && (
            <div className="mt-2 border-l-2 border-[var(--app-border)] pl-2">
              {dept.children.map(child => (
                <DeptTreeNode
                  key={child.id}
                  dept={child}
                  isSuperAdmin={isSuperAdmin}
                  managedDeptIds={managedDeptIds}
                  onCreateChild={onCreateChild}
                  onEditDept={onEditDept}
                  onCreateMember={onCreateMember}
                  onEditMember={onEditMember}
                  onDeactivateDept={onDeactivateDept}
                  onDeactivateMember={onDeactivateMember}
                  onDeleteMember={onDeleteMember}
                  onResetPassword={onResetPassword}
                  onTransferTasks={onTransferTasks}
                  expandedDepts={expandedDepts}
                  toggleExpand={toggleExpand}
                  membersByDept={membersByDept}
                  loadingMembers={loadingMembers}
                  level={level + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 确认操作弹窗
function ConfirmDialog({ open, action, onConfirm, onClose }) {
  if (!open || !action) return null;

  const isDept = action.type.includes('dept');
  const isDelete = action.type === 'delete_user';
  const isActivate = action.type.includes('activate');

  const getTitle = () => {
    if (isActivate && isDept) return '确认启用部门';
    if (isActivate) return '确认启用用户';
    if (isDept) return '确认禁用部门';
    if (isDelete) return '确认删除用户';
    return '确认禁用成员';
  };

  const getMessage = () => {
    if (isActivate && isDept) return `启用后，「${action.target.name}」将重新显示。`;
    if (isActivate) return `启用后，${action.target.display_name || action.target.username} 将可以登录系统。`;
    if (isDept) return `禁用后，「${action.target.name}」将不再显示。此操作可恢复。`;
    if (isDelete) return `删除后，${action.target.display_name || action.target.username} 的所有数据将被永久删除。`;
    return `禁用后，${action.target.display_name || action.target.username} 将无法登录系统。此操作可恢复。`;
  };

  const getButtonLabel = () => {
    if (isActivate) return '确认启用';
    if (isDelete) return '确认删除';
    return '确认禁用';
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[360px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)]">{getTitle()}</h2>
        <p className="mt-3 text-[15px] text-[var(--app-muted)]">{getMessage()}</p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-10 rounded-[10px] px-4 text-[15px] font-medium text-white transition-colors ${
              isActivate ? 'bg-[var(--app-primary)] hover:bg-[var(--app-primary-strong)]'
              : isDelete ? 'bg-red-600 hover:bg-red-700'
              : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {getButtonLabel()}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// 密码重置弹窗
function PasswordResetModal({ targetUser, onClose, onSuccess }) {
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setError('请输入新密码');
      return;
    }
    if (newPassword.length < 6) {
      setError('密码长度至少6位');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.resetUserPassword(targetUser.id, { new_password: newPassword });
      onSuccess();
    } catch (err) {
      setError(err.message || '重置失败');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[360px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)]">重置密码</h2>
        <p className="mt-2 text-[13px] text-[var(--app-muted)]">
          为 @{targetUser?.username} 设置新密码
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="输入新密码"
            className="w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
            autoFocus
          />

          {error && <p className="mt-2 text-[13px] text-red-500">{error}</p>}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// 转移部门弹窗
function TransferDepartmentModal({ targetUser, deptTree, onClose, onSuccess }) {
  const [departmentId, setDepartmentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 递归获取所有部门
  function getAllDepts(depts, result = []) {
    for (const d of depts) {
      result.push(d);
      if (d.children?.length > 0) {
        getAllDepts(d.children, result);
      }
    }
    return result;
  }

  const allDepts = getAllDepts(deptTree);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.updateOrgUser(targetUser.id, { department_id: departmentId || null });
      onSuccess();
    } catch (err) {
      setError(err.message || '转移失败');
    } finally {
      setSaving(false);
    }
  };

  const currentDeptName = targetUser?.default_department?.name || '未分配部门';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[400px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)]">转移部门</h2>
        <p className="mt-2 text-[13px] text-[var(--app-muted)]">
          {targetUser?.display_name || targetUser?.username} 当前在「{currentDeptName}」
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <label className="text-[13px] font-medium text-[var(--app-text)]">转移目标部门</label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
          >
            <option value="">未分配部门</option>
            {allDepts.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {error && <p className="mt-2 text-[13px] text-red-500">{error}</p>}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50 transition-colors"
            >
              {saving ? '转移中...' : '确认转移'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// 组织管理页面组件 - 重构版本
function OrganizationPage({ user }) {
  const [deptTree, setDeptTree] = useState([]);
  const [noDeptUsers, setNoDeptUsers] = useState([]);
  const [inactiveDepts, setInactiveDepts] = useState([]);
  const [inactiveUsers, setInactiveUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 展开状态管理
  const [expandedDepts, setExpandedDepts] = useState({});
  const [membersByDept, setMembersByDept] = useState({});
  const [loadingMembers, setLoadingMembers] = useState({});

  // 弹窗状态
  const [deptEditOpen, setDeptEditOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptCreateOpen, setDeptCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState(null);

  const [userEditOpen, setUserEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userCreateOpen, setUserCreateOpen] = useState(false);
  const [createMemberDeptId, setCreateMemberDeptId] = useState(null);

  // 确认弹窗状态
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // 密码重置弹窗状态
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);

  // 转移任务弹窗状态
  const [transferTasksOpen, setTransferTasksOpen] = useState(false);
  const [transferTargetUser, setTransferTargetUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  const isSuperAdmin = user?.is_super_admin;
  const managedDeptIds = user?.managed_department_ids || [];

  // 加载部门树
  const loadDeptTree = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.departmentTree();
      setDeptTree(data);
    } catch (e) {
      setError(e.message || '加载部门树失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载无部门用户
  const loadNoDeptUsers = useCallback(async () => {
    try {
      const data = await api.orgUsers({ no_department: true });
      setNoDeptUsers(data);
    } catch (e) {
      console.error('加载无部门用户失败:', e);
    }
  }, []);

  // 加载所有用户（用于转移任务）
  const loadAllUsers = useCallback(async () => {
    try {
      const data = await api.orgUsers();
      setAllUsers(data);
    } catch (e) {
      console.error('加载用户列表失败:', e);
    }
  }, []);

  // 加载禁用部门
  const loadInactiveDepts = useCallback(async () => {
    try {
      const data = await api.inactiveDepartments();
      setInactiveDepts(data);
    } catch (e) {
      console.error('加载禁用部门失败:', e);
    }
  }, []);

  // 加载禁用用户
  const loadInactiveUsers = useCallback(async () => {
    try {
      const data = await api.orgUsers({ include_inactive: true });
      // 过滤出禁用的用户
      setInactiveUsers(data.filter(u => u.is_active === false));
    } catch (e) {
      console.error('加载禁用用户失败:', e);
    }
  }, []);

  // 懒加载部门成员
  const loadDeptMembers = useCallback(async (deptId) => {
    if (membersByDept[deptId]) return; // 已缓存
    setLoadingMembers(prev => ({ ...prev, [deptId]: true }));
    try {
      const data = await api.orgUsers({ department_id: deptId });
      setMembersByDept(prev => ({ ...prev, [deptId]: data }));
    } catch (e) {
      console.error('加载成员失败:', e);
    } finally {
      setLoadingMembers(prev => ({ ...prev, [deptId]: false }));
    }
  }, [membersByDept]);

  // 展开/收起切换
  const toggleExpand = useCallback((deptId) => {
    const newExpanded = !expandedDepts[deptId];
    setExpandedDepts(prev => ({ ...prev, [deptId]: newExpanded }));
    if (newExpanded) {
      loadDeptMembers(deptId);
    }
  }, [expandedDepts, loadDeptMembers]);

  // 初始化加载
  useEffect(() => {
    if (user?.is_super_admin || user?.is_department_manager) {
      loadDeptTree();
      loadNoDeptUsers();
      loadAllUsers();
    }
    if (user?.is_super_admin) {
      loadInactiveDepts();
      loadInactiveUsers();
    }
  }, [user, loadDeptTree, loadNoDeptUsers, loadAllUsers, loadInactiveDepts, loadInactiveUsers]);

  // 禁用部门
  const handleDeactivateDept = async () => {
    if (!confirmAction?.target) return;
    try {
      await api.deactivateDepartment(confirmAction.target.id);
      setConfirmDialogOpen(false);
      setConfirmAction(null);
      // 刷新部门树
      loadDeptTree();
      // 清除成员缓存
      setMembersByDept({});
      // 刷新禁用列表
      loadInactiveDepts();
    } catch (e) {
      setError(e.message || '禁用失败');
    }
  };

  // 禁用用户
  const handleDeactivateMember = async () => {
    if (!confirmAction?.target) return;
    try {
      await api.deactivateOrgUser(confirmAction.target.id);
      setConfirmDialogOpen(false);
      setConfirmAction(null);
      // 清除缓存重新加载
      setMembersByDept({});
      loadDeptTree();
      loadNoDeptUsers();
      loadInactiveUsers();
    } catch (e) {
      setError(e.message || '禁用失败');
    }
  };

  // 删除用户
  const handleDeleteUser = async () => {
    if (!confirmAction?.target) return;
    try {
      await api.deleteOrgUser(confirmAction.target.id);
      setConfirmDialogOpen(false);
      setConfirmAction(null);
      // 清除缓存重新加载
      setMembersByDept({});
      loadDeptTree();
      loadNoDeptUsers();
      loadInactiveUsers();
    } catch (e) {
      setError(e.message || '删除失败');
    }
  };

  // 启用部门
  const handleActivateDept = async () => {
    if (!confirmAction?.target) return;
    try {
      await api.activateDepartment(confirmAction.target.id);
      setConfirmDialogOpen(false);
      setConfirmAction(null);
      loadDeptTree();
      loadInactiveDepts();
    } catch (e) {
      setError(e.message || '启用失败');
    }
  };

  // 启用用户
  const handleActivateUser = async () => {
    if (!confirmAction?.target) return;
    try {
      await api.activateOrgUser(confirmAction.target.id);
      setConfirmDialogOpen(false);
      setConfirmAction(null);
      setMembersByDept({});
      loadDeptTree();
      loadNoDeptUsers();
      loadInactiveUsers();
    } catch (e) {
      setError(e.message || '启用失败');
    }
  };

  // 打开禁用确认弹窗
  const openDeactivateDeptDialog = (dept) => {
    setConfirmAction({ type: 'deactivate_dept', target: dept });
    setConfirmDialogOpen(true);
  };

  const openDeactivateMemberDialog = (member) => {
    setConfirmAction({ type: 'deactivate_member', target: member });
    setConfirmDialogOpen(true);
  };

  const openDeleteUserDialog = (member) => {
    setConfirmAction({ type: 'delete_user', target: member });
    setConfirmDialogOpen(true);
  };

  const openActivateDeptDialog = (dept) => {
    setConfirmAction({ type: 'activate_dept', target: dept });
    setConfirmDialogOpen(true);
  };

  const openActivateUserDialog = (user) => {
    setConfirmAction({ type: 'activate_user', target: user });
    setConfirmDialogOpen(true);
  };

  // 打开密码重置弹窗
  const openPasswordResetModal = (member) => {
    setResetTargetUser(member);
    setPasswordResetOpen(true);
  };

  // 打开转移任务弹窗
  const openTransferDepartmentModal = (member) => {
    setTransferTargetUser(member);
    setTransferTasksOpen(true);
  };

  // 部门树渲染
  const renderDeptTree = (depts) => {
    return depts.map(dept => (
      <DeptTreeNode
        key={dept.id}
        dept={dept}
        isSuperAdmin={isSuperAdmin}
        managedDeptIds={managedDeptIds}
        onCreateChild={(parentId) => {
          setCreateParentId(parentId);
          setDeptCreateOpen(true);
        }}
        onEditDept={(dept) => {
          setEditingDept(dept);
          setDeptEditOpen(true);
        }}
        onCreateMember={(deptId) => {
          setCreateMemberDeptId(deptId);
          setUserCreateOpen(true);
        }}
        onEditMember={(member) => {
          setEditingUser(member);
          setUserEditOpen(true);
        }}
        onDeactivateDept={openDeactivateDeptDialog}
        onDeactivateMember={openDeactivateMemberDialog}
        onDeleteMember={openDeleteUserDialog}
        onResetPassword={openPasswordResetModal}
        onTransferTasks={openTransferDepartmentModal}
        expandedDepts={expandedDepts}
        toggleExpand={toggleExpand}
        membersByDept={membersByDept}
        loadingMembers={loadingMembers}
      />
    ));
  };

  // 确认操作执行
  const handleConfirmAction = () => {
    if (confirmAction?.type === 'deactivate_dept') {
      handleDeactivateDept();
    } else if (confirmAction?.type === 'deactivate_member') {
      handleDeactivateMember();
    } else if (confirmAction?.type === 'delete_user') {
      handleDeleteUser();
    } else if (confirmAction?.type === 'activate_dept') {
      handleActivateDept();
    } else if (confirmAction?.type === 'activate_user') {
      handleActivateUser();
    }
  };

  return (
    <div className="h-full overflow-auto bg-[var(--app-bg)] p-6">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-semibold text-[var(--app-text)]">组织管理</h1>
          <p className="mt-0.5 text-[13px] text-[var(--app-muted)]">管理部门架构和成员信息</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && (
            <span className="flex items-center gap-2 text-[13px] text-[var(--app-muted)]">
              <RefreshCw size={14} className="animate-spin" />
              加载中...
            </span>
          )}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setCreateParentId(null);
                setDeptCreateOpen(true);
              }}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] transition-colors"
            >
              + 新增顶级部门
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-[10px] bg-red-50 dark:bg-red-500/10 px-4 py-3 text-[13px] text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {/* 部门树 */}
      <div className="rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
        {deptTree.length === 0 ? (
          <div className="text-center text-[var(--app-muted)] py-12">
            <Building2 size={32} strokeWidth={1.5} className="mx-auto mb-3 opacity-50" />
            <p className="text-[15px]">暂无部门数据</p>
          </div>
        ) : (
          <div className="space-y-1">
            {renderDeptTree(deptTree)}
          </div>
        )}
      </div>

      {/* 无部门用户 */}
      {noDeptUsers.length > 0 && (
        <div className="mt-6 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <Users size={16} strokeWidth={1.5} className="text-[var(--app-muted)]" />
            <h3 className="text-[15px] font-semibold text-[var(--app-text)]">无部门用户</h3>
            <span className="text-[13px] text-[var(--app-muted)]">{noDeptUsers.length} 人</span>
          </div>
          <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)]">
            {noDeptUsers.map(member => (
              <MemberItem
                key={member.id}
                member={member}
                canManage={member.can_manage}
                onEdit={() => {
                  setEditingUser(member);
                  setUserEditOpen(true);
                }}
                onDeactivate={() => openDeactivateMemberDialog(member)}
                onDelete={() => openDeleteUserDialog(member)}
                onResetPassword={() => openPasswordResetModal(member)}
                onTransferTasks={() => openTransferTasksModal(member)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 已禁用的部门 */}
      {isSuperAdmin && inactiveDepts.length > 0 && (
        <div className="mt-6 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <Building2 size={16} strokeWidth={1.5} className="text-[var(--app-muted)]" />
            <h3 className="text-[15px] font-semibold text-[var(--app-text)]">已禁用的部门</h3>
            <span className="text-[13px] text-[var(--app-muted)]">{inactiveDepts.length} 个</span>
          </div>
          <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)]">
            {inactiveDepts.map(dept => (
              <div key={dept.id} className="flex items-center gap-4 py-3 px-4 border-b border-[var(--app-border)] last:border-0">
                <span className="text-[15px] font-medium text-[var(--app-text)]">{dept.name}</span>
                {dept.parent_name && (
                  <span className="text-[13px] text-[var(--app-subtle)]">(原上级: {dept.parent_name})</span>
                )}
                <span className="text-[13px] text-[var(--app-muted)]">{dept.member_count || 0} 人</span>
                <button
                  type="button"
                  onClick={() => openActivateDeptDialog(dept)}
                  className="ml-auto rounded-[6px] px-2.5 py-1.5 text-[13px] text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 transition-colors"
                >
                  启用
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 已禁用的用户 */}
      {isSuperAdmin && inactiveUsers.length > 0 && (
        <div className="mt-6 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <Users size={16} strokeWidth={1.5} className="text-[var(--app-muted)]" />
            <h3 className="text-[15px] font-semibold text-[var(--app-text)]">已禁用的用户</h3>
            <span className="text-[13px] text-[var(--app-muted)]">{inactiveUsers.length} 人</span>
          </div>
          <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)]">
            {inactiveUsers.map(user => (
              <div key={user.id} className="flex items-center gap-4 py-3 px-4 border-b border-[var(--app-border)] last:border-0">
                <div className="size-8 rounded-full bg-[var(--app-muted)]/20 grid place-items-center text-[var(--app-muted)]">
                  <span className="text-[13px] font-medium">
                    {(user.display_name || user.username)?.[0]?.toUpperCase()}
                  </span>
                </div>
                <span className="text-[15px] font-medium text-[var(--app-muted)]">
                  {user.display_name || user.username}
                </span>
                <span className="text-[13px] text-[var(--app-subtle)]">@{user.username}</span>
                <button
                  type="button"
                  onClick={() => openTransferDepartmentModal(user)}
                  className="rounded-[6px] px-2 py-1 text-[13px] text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 transition-colors"
                >
                  转移
                </button>
                <button
                  type="button"
                  onClick={() => openActivateUserDialog(user)}
                  className="rounded-[6px] px-2.5 py-1.5 text-[13px] text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 transition-colors"
                >
                  启用
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 确认弹窗 */}
      <ConfirmDialog
        open={confirmDialogOpen}
        action={confirmAction}
        onConfirm={handleConfirmAction}
        onClose={() => {
          setConfirmDialogOpen(false);
          setConfirmAction(null);
        }}
      />

      {/* 密码重置弹窗 */}
      {passwordResetOpen && (
        <PasswordResetModal
          targetUser={resetTargetUser}
          onClose={() => {
            setPasswordResetOpen(false);
            setResetTargetUser(null);
          }}
          onSuccess={() => {
            setPasswordResetOpen(false);
            setResetTargetUser(null);
          }}
        />
      )}

      {/* 转移部门弹窗 */}
      {transferTasksOpen && (
        <TransferDepartmentModal
          targetUser={transferTargetUser}
          deptTree={deptTree}
          onClose={() => {
            setTransferTasksOpen(false);
            setTransferTargetUser(null);
          }}
          onSuccess={() => {
            setTransferTasksOpen(false);
            setTransferTargetUser(null);
            // 刷新数据
            setMembersByDept({});
            loadDeptTree();
            loadNoDeptUsers();
            loadInactiveUsers();
          }}
        />
      )}

      {/* 部门编辑弹窗 */}
      {deptEditOpen && (
        <DeptEditModal
          dept={editingDept}
          deptTree={deptTree}
          isSuperAdmin={isSuperAdmin}
          onClose={() => {
            setDeptEditOpen(false);
            setEditingDept(null);
          }}
          onSuccess={() => {
            loadDeptTree();
            setMembersByDept({});
            setDeptEditOpen(false);
            setEditingDept(null);
          }}
        />
      )}

      {/* 部门创建弹窗 */}
      {deptCreateOpen && (
        <DeptCreateModal
          parentId={createParentId}
          deptTree={deptTree}
          isSuperAdmin={isSuperAdmin}
          onClose={() => {
            setDeptCreateOpen(false);
            setCreateParentId(null);
          }}
          onSuccess={() => {
            loadDeptTree();
            setDeptCreateOpen(false);
            setCreateParentId(null);
          }}
        />
      )}

      {/* 用户编辑弹窗 */}
      {userEditOpen && (
        <UserEditModal
          targetUser={editingUser}
          deptTree={deptTree}
          isSuperAdmin={isSuperAdmin}
          onClose={() => {
            setUserEditOpen(false);
            setEditingUser(null);
          }}
          onSuccess={() => {
            setMembersByDept({});
            loadDeptTree();
            setUserEditOpen(false);
            setEditingUser(null);
          }}
        />
      )}

      {/* 用户创建弹窗 */}
      {userCreateOpen && (
        <UserCreateModal
          deptTree={deptTree}
          defaultDeptId={createMemberDeptId}
          isSuperAdmin={isSuperAdmin}
          managedDeptIds={managedDeptIds}
          onClose={() => {
            setUserCreateOpen(false);
            setCreateMemberDeptId(null);
          }}
          onSuccess={() => {
            setMembersByDept({});
            loadDeptTree();
            setUserCreateOpen(false);
            setCreateMemberDeptId(null);
          }}
        />
      )}
    </div>
  );
}

// 部门编辑弹窗
function DeptEditModal({ dept, isSuperAdmin, onClose, onSuccess }) {
  const [name, setName] = useState(dept?.name || '');
  const [code, setCode] = useState(dept?.code || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.updateDepartment(dept.id, {
        name: name.trim(),
        code: code.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[400px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)] mb-4">编辑部门</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">部门名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
              required
            />
          </div>

          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">部门代码</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
              required
            />
          </div>

          {dept?.manager && (
            <div>
              <label className="text-[13px] font-medium text-[var(--app-text)]">部门负责人</label>
              <div className="mt-1.5 text-[15px] text-[var(--app-muted)]">
                {dept.manager.display_name || dept.manager.first_name || dept.manager.username}
              </div>
            </div>
          )}

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// 部门创建弹窗
function DeptCreateModal({ parentId, deptTree, isSuperAdmin, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 找到父部门名称
  const findDept = (depts, id) => {
    for (const d of depts) {
      if (d.id === id) return d;
      if (d.children?.length > 0) {
        const found = findDept(d.children, id);
        if (found) return found;
      }
    }
    return null;
  };
  const parentDept = parentId ? findDept(deptTree, parentId) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createDepartment({
        name: name.trim(),
        code: code.trim(),
        parent_id: parentId || null,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[400px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)] mb-2">
          {parentDept ? `在「${parentDept.name}」下新增子部门` : '新增顶级部门'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">部门名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">部门代码</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
              required
            />
          </div>

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50 transition-colors"
            >
              {saving ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// 用户编辑弹窗
function UserEditModal({ targetUser, deptTree, isSuperAdmin, onClose, onSuccess }) {
  const [displayName, setDisplayName] = useState(targetUser?.first_name || '');
  const [departmentId, setDepartmentId] = useState(targetUser?.default_department?.id || '');
  const [role, setRole] = useState(targetUser?.role || 'member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 递归获取所有部门
  function getAllDepts(depts, result = []) {
    for (const d of depts) {
      result.push(d);
      if (d.children?.length > 0) {
        getAllDepts(d.children, result);
      }
    }
    return result;
  }

  const allDepts = getAllDepts(deptTree);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.updateOrgUser(targetUser.id, {
        display_name: displayName.trim(),
        department_id: departmentId || null,
        role: role,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[400px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)] mb-4">编辑成员</h2>

        <div className="mb-4 text-[13px] text-[var(--app-muted)]">
          用户名：@{targetUser?.username}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">显示名称</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
            />
          </div>

          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">所属部门</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
            >
              <option value="">未分配</option>
              {allDepts.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {isSuperAdmin && (
            <div>
              <label className="text-[13px] font-medium text-[var(--app-text)]">角色</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
              >
                <option value="member">普通成员</option>
                <option value="department_manager">部门负责人</option>
                <option value="super_admin">超级管理员</option>
              </select>
            </div>
          )}

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// 用户创建弹窗
function UserCreateModal({ deptTree, defaultDeptId, isSuperAdmin, managedDeptIds, onClose, onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [departmentId, setDepartmentId] = useState(defaultDeptId || '');
  const [role, setRole] = useState('member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 递归获取所有部门
  function getAllDepts(depts, result = []) {
    for (const d of depts) {
      result.push(d);
      if (d.children?.length > 0) {
        getAllDepts(d.children, result);
      }
    }
    return result;
  }

  const allDepts = getAllDepts(deptTree);

  // 部门负责人只能选择自己管理的部门
  const availableDepts = isSuperAdmin
    ? allDepts
    : allDepts.filter(d => managedDeptIds.includes(d.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createOrgUser({
        username: username.trim(),
        password: password,
        display_name: displayName.trim(),
        department_id: departmentId || null,
        role: role,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[400px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">新增成员</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">用户名 *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">密码 *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">显示名称</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">所属部门</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm"
            >
              <option value="">未分配</option>
              {availableDepts.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {isSuperAdmin && (
            <div>
              <label className="text-sm font-medium">角色</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm"
              >
                <option value="member">普通成员</option>
                <option value="department_manager">部门负责人</option>
                <option value="super_admin">超级管理员</option>
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[8px] px-4 py-2 text-sm text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[8px] bg-[var(--app-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50"
            >
              {saving ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
