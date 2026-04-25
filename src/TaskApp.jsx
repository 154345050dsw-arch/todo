import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Plus,
  RefreshCw,
  Search,
  Sun,
  TrendingUp,
  Users,
  X,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Activity,
  Check,
  Bold,
  Italic,
  ImagePlus,
  Link2,
  List,
  Sparkles,
  ArrowRightLeft,
  PlayCircle,
  CircleDot,
  XCircle,
} from 'lucide-react';
import { api, getToken, setToken } from './api.js';
import { useTheme } from './theme.jsx';

const scopes = [
  { key: 'my_todo', label: '我的待办', icon: ListChecks, countKey: 'my_todo' },
  { key: 'created', label: '我创建的', icon: FileCheck2, countKey: 'created' },
  { key: 'transferred', label: '我转派的', icon: ArrowRightLeft, countKey: 'transferred' },
  { key: 'participated', label: '我参与的', icon: Users, countKey: 'participated' },
  { key: 'confirming', label: '待我确认', icon: ClipboardCheck, countKey: 'confirming' },
  { key: 'cancel_pending', label: '待取消确认', icon: AlertTriangle, countKey: 'cancel_pending' },
  { key: 'overdue', label: '已超时', icon: Clock3, countKey: 'overdue' },
  { key: 'done', label: '已完成', icon: CheckCircle2, countKey: 'done' },
  { key: 'cancelled', label: '已取消', icon: X, countKey: 'cancelled' },
];

// 状态文案统一映射
const statusLabels = {
  todo: '待处理',
  in_progress: '处理中',
  confirming: '待确认',
  acceptance: '验收中',
  overdue: '已超时',
  done: '已完成',
  cancel_pending: '待取消确认',
  cancelled: '已取消',
};

const statusTone = {
  todo: 'border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]',
  in_progress: 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400',
  confirming: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400',
  acceptance: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  overdue: 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  cancel_pending: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400',
  cancelled: 'border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]',
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
  return Boolean(left?.id && right?.id && left.id === right.id);
}

function isTaskClosed(task) {
  return ['done', 'cancelled'].includes(task?.status);
}

function isTaskOverdue(task) {
  return !isTaskClosed(task) && (task?.is_overdue || task?.status === 'overdue');
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
  if (task?.can_claim) return 'my_todo';
  if (task?.status === 'done') return 'done';
  if (task?.status === 'cancelled') return 'cancelled';
  if (task?.status === 'cancel_pending' && sameUser(task.creator, user)) return 'cancel_pending';
  if (isTaskOverdue(task)) return 'overdue';
  if (task?.status === 'confirming' && (sameUser(task.confirmer, user) || sameUser(task.owner, user))) return 'confirming';
  if (!isTaskClosed(task) && sameUser(task.owner, user)) return 'my_todo';
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
  if (task.is_overdue) {
    return { label: formatDate(task.due_at), className: 'text-[#c24141] dark:text-[#fca5a5]' };
  }
  return { label: formatDate(task.due_at), className: 'text-[var(--app-muted)]' };
}

function primaryActionForTask(task, user) {
  if (!task || ['done', 'cancelled'].includes(task.status)) return null;
  if (task.can_claim) {
    return { label: '开始处理', payload: { action: 'claim_task', note: '开始处理' } };
  }
  // 待取消确认状态的特殊操作
  if (task.status === 'cancel_pending') {
    if (task.creator?.id === user?.id) {
      return { label: '确认取消', payload: { action: 'confirm_cancel', note: '确认取消任务' } };
    }
    return null;
  }
  if (task.status === 'todo') {
    return { label: '开始处理', payload: { action: 'change_status', status: 'in_progress', note: '开始处理' } };
  }
  if (task.status === 'in_progress') {
    // 处理人直接点击确认完成，自动进入待确认状态等待创建人审批
    return { label: '确认完成', payload: { action: 'confirm_complete', note: '提交确认完成' } };
  }
  if (task.status === 'confirming') {
    // 创建人/确认人最终确认
    return { label: '确认完成', payload: { action: 'confirm_complete', note: '确认完成' } };
  }
  return null;
}

function badgeClass(map, key) {
  return map[key] || 'border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]';
}

function Badge({ children, className }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

// 获取任务流转上下文
function getFlowContext(task) {
  if (!task?.events?.length) return null;
  const recentEvents = task.events.slice(-2);
  if (recentEvents.length < 2) return null;
  const prev = recentEvents[0];
  const curr = recentEvents[1] || task;
  const fromDept = prev.to_department?.name || task.department?.name;
  const toAction = curr.label || '';
  if (fromDept && toAction) {
    return `${fromDept} → ${toAction}`;
  }
  return null;
}

export default function TaskApp() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const loadMe = useCallback(async () => {
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
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: 'demo', password: 'demo123456', display_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme, setTheme } = useTheme();

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = mode === 'login' ? await api.login(form) : await api.register(form);
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
          <div className="mb-6 inline-flex rounded-[10px] border border-[var(--app-border)] p-1">
            {[
              ['login', '登录'],
              ['register', '注册'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`h-9 rounded-[8px] px-4 text-sm font-medium ${mode === value ? 'bg-[var(--app-text)] text-[var(--app-panel)]' : 'text-[var(--app-muted)]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'register' && (
            <label className="mb-4 block">
              <span className="text-sm font-medium">显示名称</span>
              <input
                value={form.display_name}
                onChange={(event) => setForm({ ...form, display_name: event.target.value })}
                className="mt-2 h-10 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-sm outline-none transition-colors focus:border-[var(--app-primary)] focus:ring-2 focus:ring-[var(--app-primary)]/10"
                placeholder="例如：周岚"
              />
            </label>
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
          <button disabled={loading} className="h-10 w-full rounded-[8px] bg-[var(--app-primary)] text-sm font-semibold text-white transition-colors disabled:opacity-60 hover:bg-[var(--app-primary-strong)]">
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
          <p className="mt-4 text-xs text-[var(--app-muted)]">演示账号：demo / demo123456。先运行后端 seed 命令生成。</p>
        </form>
      </div>
    </div>
  );
}

function Workspace({ user, onLogout }) {
  const [scope, setScope] = useState('my_todo');
  const [workspaceMode, setWorkspaceMode] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [meta, setMeta] = useState({ users: [], departments: [], statuses: [], priorities: [] });
  const [activityMonth, setActivityMonth] = useState(() => monthKey(new Date()));
  const [selectedActivityDate, setSelectedActivityDate] = useState(() => dateKey(new Date()));
  const [calendarMode, setCalendarMode] = useState('month'); // 'month' | 'week'
  const [dailyActivity, setDailyActivity] = useState(() => ({ month: monthKey(new Date()), total_actions: 0, days: [] }));
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [detail, setDetail] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [filters, setFilters] = useState({ mineOnly: false, sortDue: false });
  const [error, setError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const { theme, setTheme } = useTheme();
  const searchInputRef = useRef(null);
  const searchRequestRef = useRef(0);
  const createButtonRef = useRef(null);

  const loadData = useCallback(async () => {
    setSyncStatus('syncing');
    setError('');
    try {
      const [dashboardData, tasksData, metaData] = await Promise.all([
        api.dashboard(),
        api.tasks({
          scope,
          mine_only: filters.mineOnly ? '1' : '',
          sort: filters.sortDue ? 'due_at' : '',
        }),
        api.meta(),
      ]);
      setDashboard(dashboardData);
      setTasks(tasksData);
      setMeta(metaData);
      setLastSyncTime(new Date());
      setSyncStatus('success');
    } catch (err) {
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
    setScope(nextScope);
  }

  function selectActivityMonth(nextMonth) {
    setActivityMonth(nextMonth);
    setSelectedActivityDate(nextMonth === monthKey(new Date()) ? dateKey(new Date()) : `${nextMonth}-01`);
  }

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setUserMenuOpen(false);
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
        if (createOpen) setCreateOpen(false);
        if (drawerOpen) setDrawerOpen(false);
        if (userMenuOpen) setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeSearch, createOpen, drawerOpen, openSearch, searchOpen, userMenuOpen]);

  async function openTask(taskId) {
    const data = await api.task(taskId);
    setDetail(data);
    setDrawerOpen(true);
  }

  async function openSearchResult(task) {
    setWorkspaceMode('tasks');
    setScope(scopeForTask(task, user, scope));
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

  // Scope title and subtitle
  const scopeInfo = useMemo(() => {
    const scopeMap = {
      my_todo: { title: '我的待办任务', subtitle: '跟踪你负责的待处理、处理中任务' },
      created: { title: '我创建的任务', subtitle: '跟踪你发起的任务进度、流转和耗时' },
      participated: { title: '我参与的任务', subtitle: '查看你作为参与人协作的任务' },
      confirming: { title: '待我确认的任务', subtitle: '等待你验收确认的任务，请及时处理' },
      cancel_pending: { title: '待取消确认', subtitle: '负责人申请取消的任务，需要你确认' },
      overdue: { title: '已超时任务', subtitle: '超过截止时间的任务，需要优先关注' },
      done: { title: '已完成任务', subtitle: '查看已完成的任务历史' },
      cancelled: { title: '已取消任务', subtitle: '已取消的任务记录' },
    };
    return scopeMap[scope] || scopeMap.my_todo;
  }, [scope]);

  const pageInfo = workspaceMode === 'overview'
    ? { title: '', subtitle: '' }
    : scopeInfo;

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)]">
        {/* Left Sidebar */}
        <aside className="border-r border-[var(--app-border)] bg-[var(--app-bg)] p-4">
          <div className="mb-6 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-[12px] bg-[var(--app-text)] text-sm font-semibold text-[var(--app-panel)]">F</span>
              <div>
                <div className="text-sm font-semibold">FlowDesk</div>
                <div className="text-xs text-[var(--app-muted)]">任务流转工作区</div>
              </div>
            </a>
          </div>

          {/* Navigation Items */}
          <div className="space-y-1">
            {scopes.map((item) => {
              const count = dashboard[item.countKey] ?? 0;
              const isSelected = workspaceMode === 'tasks' && scope === item.key;
              const isTodoCount = item.key === 'my_todo' && count > 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectTaskScope(item.key)}
                  className={`relative flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-[var(--app-panel)] font-medium shadow-[0_0_0_1px_var(--app-border)]'
                      : 'text-[var(--app-muted)] hover:bg-[var(--app-panel)] hover:text-[var(--app-text)] dark:hover:bg-[rgba(255,255,255,0.05)]'
                  }`}
                >
                  {isSelected && <span className="nav-selected-left" />}
                  <span className={`flex items-center gap-2 ${isSelected || isTodoCount ? 'text-[var(--app-text)]' : ''}`}>
                    <item.icon size={15} aria-hidden="true" />
                    {item.label}
                  </span>
                  {count > 0 && (
                    <span
                      className={`min-w-6 rounded-full border px-2 py-0.5 text-center text-xs font-bold tabular-nums transition ${
                        isSelected
                          ? 'border-transparent bg-[var(--app-primary)] text-white'
                          : isTodoCount
                            ? 'border-transparent bg-[var(--app-text)] text-[var(--app-panel)]'
                            : 'border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Statistics Section */}
          <div className="mt-6 border-t border-[var(--app-border)] pt-4">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase text-[var(--app-subtle)]">统计</div>
            <button
              type="button"
              onClick={() => setWorkspaceMode('overview')}
              className={`relative flex h-10 w-full items-center gap-2 rounded-[8px] px-3 text-left text-sm transition-colors ${
                workspaceMode === 'overview'
                  ? 'bg-[var(--app-panel)] font-medium shadow-[0_0_0_1px_var(--app-border)]'
                  : 'text-[var(--app-muted)] hover:bg-[var(--app-panel)] hover:text-[var(--app-text)] dark:hover:bg-[rgba(255,255,255,0.05)]'
              }`}
            >
              {workspaceMode === 'overview' && <span className="nav-selected-left" />}
              <BarChart3 size={15} aria-hidden="true" />
              <span>任务总览</span>
            </button>
            {[
              ['人员统计', Users],
              ['部门统计', Building2],
            ].map(([label, Icon]) => (
              <button key={label} type="button" className="flex h-10 w-full items-center gap-2 rounded-[8px] px-3 text-left text-sm text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel)] hover:text-[var(--app-text)] dark:hover:bg-[rgba(255,255,255,0.05)]">
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="relative min-w-0 overflow-hidden">
          {/* Top Header */}
          <header className={`flex h-14 items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-bg)] px-5 transition-all duration-300 ${drawerOpen ? 'mr-[min(520px,42vw)]' : 'mr-[340px]'}`}>
            {/* Search Box */}
            <button
              type="button"
              onClick={openSearch}
              className="relative flex h-9 w-[360px] items-center gap-2 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 text-left text-sm transition-colors hover:border-[var(--app-primary)]"
              aria-label="打开任务搜索"
            >
              <Search size={15} className="text-[var(--app-muted)]" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[var(--app-muted)]">搜索任务、人员、部门</span>
              <kbd className="hidden rounded-[6px] bg-[var(--app-panel-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--app-muted)] sm:inline">⌘K</kbd>
            </button>

            {/* Right Toolbar */}
            <div className="flex items-center gap-2">
              {/* New Task Button */}
              <button
                ref={createButtonRef}
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-[8px] bg-[var(--app-primary)] px-3 text-sm font-medium text-white transition-colors hover:bg-[var(--app-primary-strong)]"
              >
                <Plus size={14} />
                新建
                <kbd className="rounded-[6px] bg-[rgba(255,255,255,0.15)] px-1 py-0.5 text-[11px] font-medium">N</kbd>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex h-9 items-center gap-2 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel)] px-2.5 text-sm transition-colors hover:border-[var(--app-primary)]"
                >
                  <div className="grid size-6 place-items-center rounded-[8px] bg-[var(--app-text)] text-xs font-semibold text-[var(--app-panel)]">
                    {user.first_name?.[0] || user.username?.[0] || 'U'}
                  </div>
                  <span className="max-w-[80px] truncate font-medium">{displayUser(user)}</span>
                  <ChevronDown size={14} className={`text-[var(--app-muted)] transition ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-11 z-30 w-48 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-1 shadow-[var(--app-shadow)]">
                    <div className="mb-1 px-3 py-2">
                      <div className="text-sm font-semibold">{displayUser(user)}</div>
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
                          className={`flex h-9 w-full items-center gap-2 rounded-[8px] px-3 text-left text-sm ${theme === value ? 'bg-[var(--app-panel-soft)] font-medium' : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]'}`}
                        >
                          <Icon size={14} />
                          {label}
                          {theme === value && <Check size={14} className="ml-auto text-[var(--app-primary)]" />}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-[var(--app-border)] py-1">
                      <button
                        type="button"
                        onClick={() => { setUserMenuOpen(false); onLogout(); }}
                        className="flex h-9 w-full items-center gap-2 rounded-[8px] px-3 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <X size={14} />
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Content Section - Kanban Only */}
          <section className={`h-[calc(100vh-3.5rem)] overflow-auto p-5 transition-all duration-300 ${drawerOpen ? 'mr-[min(520px,42vw)]' : workspaceMode === 'overview' ? '' : 'mr-[340px]'}`}>
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
                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, mineOnly: !filters.mineOnly })}
                    className={`flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-medium transition ${
                      filters.mineOnly
                        ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
                        : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-primary)] hover:text-[var(--app-primary)]'
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
                        : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-primary)] hover:text-[var(--app-primary)]'
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
            {workspaceMode === 'overview' ? (
              <DailyActivityCalendar
                data={dailyActivity}
                month={activityMonth}
                selectedDate={selectedActivityDate}
                loading={activityLoading}
                error={activityError}
                onMonthChange={selectActivityMonth}
                onDateSelect={setSelectedActivityDate}
                calendarMode={calendarMode}
                onCalendarModeChange={setCalendarMode}
              />
            ) : (
              <TaskBoard tasks={tasks} onOpen={openTask} scope={scope} />
            )}
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
            />
          ) : workspaceMode === 'overview' ? (
            <DailyActivityTimeline
              data={dailyActivity}
              selectedDate={selectedActivityDate}
              loading={activityLoading}
              onOpenTask={openTask}
            />
          ) : (
            <InsightPanel dashboard={dashboard} tasks={tasks} />
          )}

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
        </main>
      </div>
    </div>
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

  useEffect(() => {
    if (!open || !activeTask) return;
    document.getElementById(`task-search-result-${activeTask.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeTask, open]);

  function moveActive(offset) {
    if (!flatResults.length) return;
    onActiveIndexChange((current) => (current + offset + flatResults.length) % flatResults.length);
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
        className="w-full max-w-[760px] overflow-hidden rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.32)]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="搜索任务"
      >
        <div className="flex h-14 items-center gap-3 border-b border-[var(--app-border)] px-4">
          <Search size={18} className="shrink-0 text-[var(--app-muted)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            className="task-search-input h-full min-w-0 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-[var(--app-subtle)]"
            placeholder="搜索任务、人员、部门"
            autoComplete="off"
          />
          {loading && <RefreshCw size={15} className="shrink-0 animate-spin text-[var(--app-muted)]" aria-hidden="true" />}
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-[8px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]"
            aria-label="关闭搜索"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto p-2">
          <div className="px-2 pb-2 pt-1 text-xs font-semibold text-[var(--app-subtle)]">
            {isEmptyQuery ? '最近任务' : '搜索结果'}
          </div>

          {error && (
            <div className="mx-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {!error && !loading && !flatResults.length && (
            <div className="mx-2 rounded-[10px] border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-muted)]">
              {isEmptyQuery ? '暂无最近任务' : '没有匹配的任务'}
            </div>
          )}

          {!error && groups.map((group) => (
            <div key={group.key} className="mb-2 last:mb-0">
              <div className="flex h-8 items-center gap-2 px-2 text-xs font-semibold text-[var(--app-muted)]">
                <group.Icon size={13} className={group.className} aria-hidden="true" />
                <span>{group.label}</span>
                <span className="rounded-[6px] bg-[var(--app-panel-soft)] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[var(--app-muted)]">
                  {group.tasks.length}
                </span>
              </div>

              <div className="space-y-1">
                {group.tasks.map((task) => {
                  const resultIndex = flatResults.findIndex((item) => item.id === task.id);
                  const isActive = resultIndex === activeIndex;
                  return (
                    <button
                      key={task.id}
                      id={`task-search-result-${task.id}`}
                      type="button"
                      onMouseEnter={() => onActiveIndexChange(resultIndex)}
                      onClick={() => onSelect(task)}
                      className={`flex min-h-16 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left transition ${
                        isActive
                          ? 'bg-[var(--app-panel-soft)] shadow-[inset_0_0_0_1px_var(--app-border)]'
                          : 'hover:bg-[var(--app-panel-soft)]'
                      }`}
                    >
                      <div className="grid size-9 shrink-0 place-items-center rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-muted)]">
                        <FileCheck2 size={16} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--app-subtle)]">{task.code}</span>
                          <span className="truncate text-sm font-semibold">{task.title}</span>
                        </div>
                        {task.is_limited_view ? (
                          <div className="mt-1 text-xs text-[var(--app-muted)]">我的待办</div>
                        ) : (
                          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--app-muted)]">
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
                onDateSelect(dateKey(current));
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
                onDateSelect(dateKey(current));
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

function DailyActivityTimeline({ data, selectedDate, loading, onOpenTask }) {
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
        {loading && <RefreshCw size={14} className="animate-spin text-[var(--app-muted)]" />}
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

function TaskBoard({ tasks, onOpen, scope }) {
  // Define single-status scopes that should show list view instead of kanban
  const singleStatusScopes = {
    done: { Icon: CheckCircle2, label: '已完成', colorClass: 'text-green-500', badgeClass: 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400' },
    cancelled: { Icon: X, label: '已取消', colorClass: 'text-[var(--app-muted)]', badgeClass: 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]' },
    cancel_pending: { Icon: AlertTriangle, label: '待取消确认', colorClass: 'text-yellow-500', badgeClass: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400' },
    overdue: { Icon: AlertTriangle, label: '已超时', colorClass: 'text-red-500', badgeClass: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' },
    confirming: { Icon: ClipboardCheck, label: '待确认', colorClass: 'text-purple-500', badgeClass: 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400' },
  };

  // For single-status scopes, show a simple list view
  if (singleStatusScopes[scope]) {
    const config = singleStatusScopes[scope];

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 py-2 mb-2">
          <config.Icon size={14} className={config.colorClass} />
          <span className="text-sm font-medium">{config.label}</span>
          <span className={`rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${config.badgeClass}`}>
            {tasks.length}
          </span>
        </div>

        <div className="grid gap-2 lg:grid-cols-3 xl:grid-cols-4">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpen(task.id)}
              className={`rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel)] p-2.5 text-left transition hover:border-[var(--app-primary)] hover:shadow-sm ${
                scope === 'done' || scope === 'cancelled' ? 'opacity-60' : ''
              }`}
            >
              {task.is_limited_view ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--app-subtle)]">{task.code}</span>
                    <span className="rounded-[6px] bg-[var(--app-panel-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--app-muted)]">待处理</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-medium leading-5">{task.title}</div>
                </>
              ) : (
                <>
                  <div className="text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--app-subtle)]">
                    {scope === 'done' && <span className="text-green-500 mr-1">✓</span>}
                    {scope === 'cancelled' && <span className="text-[var(--app-muted)] mr-1">✕</span>}
                    {task.code}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-medium leading-5">{task.title}</div>
                  {getFlowContext(task) && (
                    <div className="mt-1 text-xs text-[var(--app-muted)]">{getFlowContext(task)}</div>
                  )}
                  {scope === 'cancel_pending' && task.cancel_reason && (
                    <div className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">取消原因：{task.cancel_reason}</div>
                  )}
                  {scope === 'cancelled' && task.cancel_reason && (
                    <div className="mt-1 text-xs text-[var(--app-muted)]">取消原因：{task.cancel_reason}</div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--app-muted)]">
                    <span className="truncate">{displayUser(task.owner)}</span>
                    <span className="text-[var(--app-subtle)]">·</span>
                    <span className={dueMeta(task).className}>{dueMeta(task).label}</span>
                    <span className="text-[var(--app-subtle)]">·</span>
                    <span className="tabular-nums">{task.current_duration_hours}h</span>
                  </div>
                  {task.priority === 'high' && scope !== 'done' && scope !== 'cancelled' && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      高优先
                    </div>
                  )}
                </>
              )}
            </button>
          ))}
          {!tasks.length && (
            <div className="rounded-[8px] border border-dashed border-[var(--app-border)] p-4 text-xs text-center text-[var(--app-muted)] col-span-full">
              暂无{config.label}任务
            </div>
          )}
        </div>
      </div>
    );
  }

  // For other scopes, show kanban view
  const columnHeaders = [
    { key: 'todo', label: '待处理', Icon: ListChecks },
    { key: 'in_progress', label: '处理中', Icon: Clock3 },
    { key: 'confirming', label: '待确认', Icon: ClipboardCheck },
    { key: 'overdue', label: '已超时', Icon: AlertTriangle },
  ];

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columnHeaders.map((col) => {
        const colTasks = tasks.filter((task) => {
          if (col.key === 'overdue') return task.is_overdue || task.status === 'overdue';
          return task.status === col.key;
        });
        const isActive = col.key === 'overdue' || col.key === 'confirming';

        return (
          <div key={col.key} className="flex min-w-[280px] max-w-[320px] flex-1 flex-col">
            {/* Column Header - Notion Style */}
            <div className="flex items-center justify-between px-1 py-2 mb-2">
              <div className="flex items-center gap-2">
                <col.Icon size={14} className={isActive ? 'text-red-500' : 'text-[var(--app-muted)]'} />
                <span className="text-sm font-medium">{col.label}</span>
                <span className={`rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                  isActive
                    ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                    : 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
                }`}>
                  {colTasks.length}
                </span>
              </div>
            </div>

            {/* Task Cards - Minimal Notion Style */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-[10px] bg-[var(--app-bg)]/50 p-2">
              {colTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpen(task.id)}
                  className="group rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel)] p-2.5 text-left transition-all hover:border-[var(--app-primary)] hover:shadow-sm"
                >
                  {task.is_limited_view ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--app-subtle)]">{task.code}</span>
                        <span className="rounded-[6px] bg-[var(--app-panel-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--app-muted)]">待处理</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-medium leading-5">{task.title}</div>
                    </>
                  ) : (
                    <>
                      {/* Task Code */}
                      <div className="text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--app-subtle)]">{task.code}</div>

                      {/* Task Title */}
                      <div className="mt-1 line-clamp-2 text-sm font-medium leading-5">{task.title}</div>

                      {/* Flow Context */}
                      {getFlowContext(task) && (
                        <div className="mt-1 text-xs text-[var(--app-muted)]">{getFlowContext(task)}</div>
                      )}

                      {/* Task Meta - Compact */}
                      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--app-muted)]">
                        <span className="truncate">{displayUser(task.owner)}</span>
                        <span className="text-[var(--app-subtle)]">·</span>
                        <span className={dueMeta(task).className}>{dueMeta(task).label}</span>
                        <span className="text-[var(--app-subtle)]">·</span>
                        <span className="tabular-nums">{task.current_duration_hours}h</span>
                      </div>

                      {/* Priority Indicator - Subtle */}
                      {task.priority === 'high' && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-[6px] bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-500 dark:bg-red-500/10">
                          <span className="size-1.5 rounded-full bg-red-500"></span>
                          高优先
                        </div>
                      )}
                    </>
                  )}
                </button>
              ))}

              {/* Empty State */}
              {!colTasks.length && (
                <div className="rounded-[8px] border border-dashed border-[var(--app-border)] p-2.5 text-xs text-center text-[var(--app-muted)] min-h-[80px] flex flex-col items-center justify-center">
                  <span className="text-[11px]">暂无任务</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Insight Panel (shown when no task is selected)
function InsightPanel({ dashboard, tasks }) {
  const recentTasks = tasks.slice(0, 5);
  const overdueTasks = tasks.filter((t) => t.is_overdue || t.status === 'overdue').slice(0, 3);
  const todayDueTasks = tasks.filter((t) => {
    if (!t.due_at) return false;
    const dueDate = new Date(t.due_at).toDateString();
    return dueDate === new Date().toDateString();
  }).slice(0, 3);

  return (
    <aside className="absolute inset-y-0 right-0 z-10 w-[340px] border-l border-[var(--app-border)] bg-[var(--app-bg)]">
      <div className="h-14 flex items-center justify-between border-b border-[var(--app-border)] px-5">
        <div className="text-sm font-semibold">工作洞察</div>
      </div>
      <div className="h-[calc(100%-3.5rem)] overflow-y-auto p-4 space-y-5">
        {/* Today's Focus */}
        <section>
          <h3 className="flex items-center gap-2 px-1 text-xs font-semibold text-[var(--app-muted)] uppercase">
            <Calendar size={12} />
            今日关注
          </h3>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2">
              <span className="text-sm">待我确认</span>
              <span className="text-lg font-semibold text-[#6d5bd0]">{dashboard.confirming ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2">
              <span className="text-sm">今日到期</span>
              <span className="text-lg font-semibold text-[#9a5b13]">{dashboard.due_today ?? 0}</span>
            </div>
          </div>
          {todayDueTasks.length > 0 && (
            <div className="mt-2 space-y-1">
              {todayDueTasks.map((task) => (
                <div key={task.id} className="text-xs text-[var(--app-muted)] truncate">
                  {task.code} · {task.title}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Flow */}
        <section>
          <h3 className="flex items-center gap-2 px-1 text-xs font-semibold text-[var(--app-muted)] uppercase">
            <Activity size={12} />
            最近流转
          </h3>
          <div className="mt-2 space-y-1">
            {recentTasks.map((task) => (
              <div key={task.id} className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--app-subtle)]">{task.code}</span>
                  <Badge className={badgeClass(statusTone, task.status)}>{statusLabels[task.status]}</Badge>
                </div>
                <div className="mt-1 text-xs truncate">{task.title}</div>
                <div className="mt-1 text-[11px] text-[var(--app-muted)]">
                  {displayUser(task.owner)} · {task.current_duration_hours}h
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Overdue Alerts */}
        <section>
          <h3 className="flex items-center gap-2 px-1 text-xs font-semibold text-red-500 uppercase">
            <AlertTriangle size={12} />
            超时提醒
          </h3>
          <div className="mt-2 space-y-1">
            {overdueTasks.length > 0 ? (
              overdueTasks.map((task) => (
                <div key={task.id} className="rounded-[10px] border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-red-600 dark:text-red-400">{task.code}</span>
                    <span className="text-[11px] text-red-500">超时</span>
                  </div>
                  <div className="mt-1 text-xs truncate text-red-700 dark:text-red-300">{task.title}</div>
                </div>
              ))
            ) : (
              <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] p-3 text-xs text-[var(--app-muted)] text-center">
                <CheckCircle2 size={16} className="mx-auto mb-1 text-green-500" />
                当前没有超时任务
              </div>
            )}
          </div>
        </section>

        {/* Performance Summary */}
        <section>
          <h3 className="flex items-center gap-2 px-1 text-xs font-semibold text-[var(--app-muted)] uppercase">
            <TrendingUp size={12} />
            本周表现
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] p-2 text-center">
              <div className="text-lg font-semibold text-[#16825a]">{dashboard.done_week ?? 0}</div>
              <div className="text-xs text-[var(--app-muted)]">本周完成</div>
            </div>
            <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] p-2 text-center">
              <div className="text-lg font-semibold text-[var(--app-primary)]">{dashboard.my_todo ?? 0}</div>
              <div className="text-xs text-[var(--app-muted)]">待处理</div>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

function TaskDetailDrawer({ task, open, meta, user, onClose, onRefresh }) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showTransferPicker, setShowTransferPicker] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
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
    setCompletionNote('');
    setExpandedSections({ info: false, timeline: true, comments: false });
  }, [task?.id]);

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

  async function handleCancel(reason) {
    if (!reason.trim()) return;
    await runAction({ action: 'cancel', note: reason.trim() });
    setShowCancelDialog(false);
    setCancelReason('');
  }

  async function handleApplyCancel(reason) {
    if (!reason.trim()) return;
    await runAction({ action: 'apply_cancel', note: reason.trim() });
    setShowCancelDialog(false);
    setCancelReason('');
  }

  async function handleConfirmComplete() {
    const noteText = completionNote.replace(/<[^>]*>/g, '').trim();
    if (!noteText) return;
    setSaving(true);
    try {
      await api.taskAction(task.id, { action: 'confirm_complete', completion_note: completionNote });
      setShowCompletionDialog(false);
      setCompletionNote('');
      await onRefresh(task.id);
    } finally {
      setSaving(false);
    }
  }

  const primaryAction = primaryActionForTask(task, user);
  const isClosed = task ? ['done', 'cancelled'].includes(task.status) : false;
  const isCreator = task?.creator?.id === user?.id;
  const isOwner = task?.owner?.id === user?.id;
  const isCancelPending = task?.status === 'cancel_pending';
  const isContentLocked = task?.is_limited_view;

  // Determine if we need completion dialog
  const needsCompletionNote = primaryAction?.payload?.action === 'confirm_complete';

  function handlePrimaryAction() {
    if (needsCompletionNote) {
      setShowCompletionDialog(true);
    } else if (primaryAction) {
      runAction(primaryAction.payload);
    }
  }

  return (
    <aside
      className={`absolute inset-y-0 right-0 z-20 w-[min(520px,42vw)] min-w-[460px] max-w-full border-l border-[var(--app-border)] bg-[var(--app-panel)] shadow-[-18px_0_38px_rgba(17,24,39,0.10)] transition-transform duration-300 dark:shadow-[-18px_0_38px_rgba(0,0,0,0.35)] ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!open}
    >
      {/* Header - Minimal */}
      <div className="flex h-14 items-center justify-between border-b border-[var(--app-border)] px-5">
        <span className="text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--app-subtle)]">{task?.code}</span>
        <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]" aria-label="关闭详情">
          <X size={14} />
        </button>
      </div>

      {task ? (
        <div className="h-[calc(100%-3rem)] overflow-y-auto">
          {/* Title Section - Prominent */}
          <div className="px-6 pt-5 pb-4">
            <h1 className="text-xl font-semibold leading-snug font-[var(--app-title-font)]">
              {task.title}
            </h1>

            {/* Creator and Created Time - Key Info */}
            <div className="mt-2 flex items-center gap-4 text-sm text-[var(--app-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--app-subtle)]">创建人</span>
                <span className="font-medium text-[var(--app-text)]">{displayUser(task.creator)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--app-subtle)]">创建时间</span>
                <span className="font-medium text-[var(--app-text)]">{formatFullDateTime(task.created_at)}</span>
              </span>
            </div>

            {/* Deadline - Countdown Display */}
            {task.due_at && (
              <div className="mt-3">
                <DeadlineDisplay dueAt={task.due_at} isOverdue={task.is_overdue} />
              </div>
            )}

            {/* Status Badge - Inline */}
            <div className="mt-3 inline-flex items-center gap-2">
              <Badge className={badgeClass(statusTone, task.status)}>{statusLabels[task.status]}</Badge>
              {task.priority === 'high' && !isClosed && (
                <span className="inline-flex items-center gap-1 rounded-[6px] bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500 dark:bg-red-500/10">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  高优先
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--app-border)]" />

          {/* Task Content Section - Main Focus */}
          <div className="px-6 py-5">
            <h3 className="mb-3 text-sm font-medium text-[var(--app-muted)]">任务内容</h3>
            <TaskContentSection task={task} isLocked={isContentLocked} />
          </div>

          {/* Cancel Reason Alert */}
          {(isCancelPending || task.status === 'cancelled') && task.cancel_reason && (
            <div className="px-6 pb-4">
              <div className="rounded-[10px] border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-900 dark:bg-yellow-950">
                <div className="text-xs font-medium text-yellow-600 dark:text-yellow-400">取消原因</div>
                <div className="mt-1 text-yellow-700 dark:text-yellow-300">{task.cancel_reason}</div>
              </div>
            </div>
          )}

          {/* Primary Action */}
          {!isClosed && !isContentLocked && (
            <div className="px-6 pb-5">
              {isCancelPending && isCreator ? (
                <div className="flex gap-3">
                  <button
                    disabled={saving}
                    type="button"
                    onClick={() => runAction({ action: 'confirm_cancel', note: '确认取消' })}
                    className="group relative h-11 flex-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-all duration-300 disabled:opacity-60 disabled:shadow-none hover:shadow-xl hover:shadow-red-500/30 hover:from-red-600 hover:to-red-700"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <XCircle size={18} className="transition-transform group-hover:rotate-12" />
                      {saving ? '处理中...' : '确认取消'}
                    </span>
                  </button>
                  <button
                    disabled={saving}
                    type="button"
                    onClick={() => runAction({ action: 'reject_cancel', note: '拒绝取消，继续执行' })}
                    className="h-11 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-700 transition-all duration-300 disabled:opacity-60 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/50"
                  >
                    <span className="flex items-center gap-2">
                      <PlayCircle size={16} />
                      拒绝取消
                    </span>
                  </button>
                </div>
              ) : primaryAction ? (
                <div className="flex items-center gap-2.5">
                  {/* Primary action button */}
                  <button
                    disabled={saving}
                    type="button"
                    onClick={handlePrimaryAction}
                    className="group relative h-10 flex-1 rounded-xl bg-gradient-to-r from-[var(--app-primary)] to-[#4f7de8] text-sm font-semibold text-white shadow-md shadow-[var(--app-primary)]/15 transition-all disabled:opacity-60 disabled:shadow-none hover:shadow-lg hover:shadow-[var(--app-primary)]/20"
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      {primaryAction.label === '开始处理' ? (
                        <PlayCircle size={16} className="transition-transform group-hover:scale-110" />
                      ) : (
                        <CheckCircle2 size={16} className="transition-transform group-hover:scale-110" />
                      )}
                      {saving ? '处理中...' : primaryAction.label}
                    </span>
                  </button>

                  {/* Transfer button */}
                  <div className="relative">
                    <button
                      disabled={saving}
                      type="button"
                      onClick={() => setShowTransferPicker(v => !v)}
                      className="h-10 shrink-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3.5 text-sm font-medium text-[var(--app-text)] transition-all disabled:opacity-50 hover:border-[var(--app-primary)]/30 hover:bg-[var(--app-primary)]/5 hover:text-[var(--app-primary)]"
                    >
                      <span className="flex items-center gap-1">
                        <ArrowRightLeft size={14} />
                        转派
                      </span>
                    </button>
                    {showTransferPicker && (
                      <div className="absolute right-0 top-12 z-20 min-w-[180px] rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-1.5 shadow-[var(--app-shadow)] animate-slideDown">
                        {meta.users?.filter(u => u.id !== task?.owner?.id).map(u => (
                          <button
                            key={u.id}
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              setShowTransferPicker(false);
                              runAction({ action: 'transfer', owner_id: u.id, note: `转派给 ${displayUser(u)}` });
                            }}
                            className="h-9 w-full rounded-lg px-3 text-left text-sm transition-colors hover:bg-[var(--app-panel-soft)]"
                          >
                            {displayUser(u)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cancel button */}
                  {(isCreator || isOwner) && (
                    <button
                      disabled={saving}
                      type="button"
                      onClick={() => setShowCancelDialog(true)}
                      className="h-10 shrink-0 rounded-xl border border-red-200 bg-red-50/50 px-3.5 text-sm font-medium text-red-500 transition-all disabled:opacity-60 hover:border-red-300 hover:bg-red-50"
                    >
                      <span className="flex items-center gap-1">
                        <XCircle size={14} />
                        取消
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex h-11 items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 text-sm text-[var(--app-muted)]">
                  <CircleDot size={16} className="mr-2 opacity-60" />
                  当前任务已关闭
                </div>
              )}
            </div>
          )}

          {/* Limited View - Action for candidate owner */}
          {isContentLocked && primaryAction && (
            <div className="px-6 pb-5">
              <button
                disabled={saving}
                type="button"
                onClick={() => runAction(primaryAction.payload)}
                className="group relative h-11 w-full rounded-xl bg-gradient-to-r from-[var(--app-primary)] to-[#4f7de8] text-sm font-semibold text-white shadow-lg shadow-[var(--app-primary)]/20 transition-all duration-300 disabled:opacity-60 disabled:shadow-none hover:shadow-xl hover:shadow-[var(--app-primary)]/25 dark:shadow-[var(--app-primary)]/10"
              >
                <span className="flex items-center justify-center gap-2">
                  <PlayCircle size={18} className="transition-transform group-hover:scale-110" />
                  {saving ? '处理中...' : primaryAction.label}
                </span>
                <span className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
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
                text: 'text-emerald-600',
                button: 'bg-emerald-500 hover:bg-emerald-600',
              },
            }}
          />

          {/* Cancel Dialog */}
          <RichTextModal
            open={showCancelDialog}
            onClose={() => { setShowCancelDialog(false); setCancelReason(''); }}
            onSubmit={() => isCreator ? handleCancel(cancelReason) : handleApplyCancel(cancelReason)}
            value={cancelReason}
            onChange={setCancelReason}
            saving={saving}
            config={{
              icon: XCircle,
              title: isCreator ? '取消任务' : '申请取消',
              hint: '请填写取消原因（必填），支持富文本格式',
              placeholder: '例如：资源不足、需求变更...',
              submitLabel: isCreator ? '确认取消' : '提交申请',
              color: {
                text: 'text-red-500',
                button: 'bg-red-500 hover:bg-red-600',
              },
            }}
          />

          {/* Divider */}
          <div className="border-t border-[var(--app-border)]" />

          {/* Collapsible Sections */}
          <div className="px-6 py-4">
            {/* Flow Timeline */}
            <CollapsibleSection
              key={`${task.id}-timeline`}
              title="流转记录"
              defaultOpen={expandedSections.timeline}
            >
              <FlowTimeline events={task.events || []} />
            </CollapsibleSection>

            {/* Task Info */}
            <CollapsibleSection
              title="任务信息"
              defaultOpen={expandedSections.info}
            >
              <div className="grid grid-cols-3 gap-2 text-sm">
                {[
                  ['负责人', displayUser(task.owner)],
                  ['部门', task.department?.name || '-'],
                  ['当前耗时', `${Math.round(task.current_duration_hours * 60)}分钟`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] p-2">
                    <div className="text-xs text-[var(--app-muted)]">{label}</div>
                    <div className="mt-0.5 font-medium text-[var(--app-text)]">{value || '-'}</div>
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
              <div className="space-y-2">
                {task.comments?.map((item) => (
                  <div key={item.id} className="rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{displayUser(item.author)}</span>
                      <span className="text-[11px] text-[var(--app-subtle)]">{formatRelativeTime(item.created_at)}</span>
                    </div>
                    <div className="mt-1 text-sm text-[var(--app-muted)]">{item.content}</div>
                  </div>
                ))}
                {!task.comments?.length && <div className="rounded-[8px] border border-dashed border-[var(--app-border)] p-3 text-sm text-[var(--app-muted)]">暂无评论。</div>}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-sm outline-none focus:border-[var(--app-primary)]"
                  placeholder="添加评论..."
                />
                <button type="button" onClick={addComment} disabled={saving || !comment.trim()} className="h-9 rounded-[8px] bg-[var(--app-text)] px-3 text-sm font-medium text-[var(--app-panel)] disabled:opacity-60">
                  发送
                </button>
              </div>
            </CollapsibleSection>
          </div>
        </div>
      ) : (
        <div className="p-5 text-sm text-[var(--app-muted)]">点击任务标题查看详情。</div>
      )}
    </aside>
  );
}

function FlowTimeline({ events }) {
  if (!events.length) {
    return <div className="rounded-[10px] border border-dashed border-[var(--app-border)] p-3 text-sm text-[var(--app-muted)]">暂无流转记录。</div>;
  }

  return (
    <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-3">
      {events.map((event, index) => {
        const durationMinutes = Math.round(event.duration_until_next_hours * 60);
        return (
          <div key={event.id} className="relative grid grid-cols-[16px_1fr_auto] gap-2 pb-3 last:pb-0">
            <span className="mt-1 size-2 rounded-full bg-[var(--app-primary)] ring-3 ring-[var(--app-panel)]" />
            {index < events.length - 1 && <span className="absolute left-[6px] top-4 h-[calc(100%-0.5rem)] w-px bg-[var(--app-border)]" />}
            <div>
              <div className="text-sm font-medium">{event.label}</div>
              <div className="mt-0.5 text-xs text-[var(--app-muted)]">
                {displayUser(event.actor)}
                {event.to_owner ? ` → ${displayUser(event.to_owner)}` : ''}
              </div>
              {event.note && <div className="mt-1 text-[11px] text-[var(--app-subtle)]">{event.note}</div>}
            </div>
            <div className="text-right text-xs">
              <div className="font-medium tabular-nums">{formatDateTime(event.created_at)}</div>
              <div className="mt-0.5 text-[var(--app-muted)]">{durationMinutes}分钟</div>
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
    <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${urgency.className}`}>
      <Clock size={14} />
      <span className="text-sm font-medium">{urgency.text}</span>
    </div>
  );
}

// Task content section with locked/unlocked state
function TaskContentSection({ task, isLocked }) {
  if (isLocked) {
    return (
      <div className="rounded-xl border border-[var(--app-border)] bg-gradient-to-b from-[var(--app-panel-soft)] to-[var(--app-bg)] p-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="relative">
            <div className="grid size-12 place-items-center rounded-full bg-[var(--app-panel-soft)]">
              <Lock size={24} className="text-[var(--app-subtle)]" />
            </div>
          </div>
        </div>
        <p className="text-sm text-[var(--app-muted)] mb-1">
          任务详细内容在开始处理后可见
        </p>
        <p className="text-xs text-[var(--app-subtle)]">
          点击下方「开始处理」按钮解锁内容
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4">
      {task.description ? (
        <div className="task-rich-content task-detail-content text-sm leading-7 text-[var(--app-text)]" dangerouslySetInnerHTML={{ __html: task.description }} />
      ) : (
        <p className="text-sm text-[var(--app-muted)]">暂无详细内容。</p>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-modalPop rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl">
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
    </div>
  );
}

// Collapsible section wrapper
function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 text-sm font-medium text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"
      >
        <span>{title}</span>
        <ChevronDown
          size={16}
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
    candidate_owner_ids: currentUser?.id ? [String(currentUser.id)] : [],
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
        className="flex max-h-[86vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
        role="dialog"
        aria-modal="true"
        aria-label="新建任务"
      >
        <div className="flex min-h-16 items-center gap-3 border-b border-[var(--app-border)] px-5">
          <input
            ref={titleRef}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            className="h-14 min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none placeholder:text-[var(--app-subtle)] focus-visible:outline-none"
            placeholder="任务标题"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={closeModal}
            className="grid size-9 shrink-0 place-items-center rounded-[8px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]"
            aria-label="关闭新建任务"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            <RichTextEditor
              value={form.description}
              onChange={(description) => setForm({ ...form, description })}
            />

            <div className="space-y-1.5">
              <SmartUserPicker
                label="负责人"
                users={meta.users}
                currentUser={currentUser}
                selectedIds={form.candidate_owner_ids}
                onChange={(candidate_owner_ids) => setForm({ ...form, candidate_owner_ids })}
                required
              />
              <p className="text-xs leading-5 text-[var(--app-muted)]">多人时先进入各自待办，最先开始处理的人会成为实际负责人。可搜索其他人员，部门将自动匹配。</p>
            </div>

            {/* 精致截止日期选择器 */}
            <div className="rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-[8px] bg-[var(--app-primary)]/10 text-[var(--app-primary)]">
                  <Calendar size={15} />
                </span>
                <div>
                  <div className="text-sm font-semibold">截止日期</div>
                  <div className="text-xs text-[var(--app-muted)]">默认截止到 23:59</div>
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

            <div className="rounded-[8px] border border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                className="flex h-11 w-full items-center justify-between px-3 text-sm font-medium transition-colors hover:bg-[var(--app-panel-soft)]"
              >
                高级字段
                <ChevronDown size={15} className={`text-[var(--app-muted)] transition ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>

              {advancedOpen && (
                <div className="space-y-4 border-t border-[var(--app-border)] p-3">
                  <PriorityControl
                    priorities={meta.priorities}
                    value={form.priority}
                    onChange={(priority) => setForm({ ...form, priority })}
                  />

                  <SingleUserSelect
                    label="确认人"
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

        <div className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] bg-[var(--app-panel)] px-5 py-4">
          <div className="min-w-0 text-sm text-red-600 dark:text-red-300">{error}</div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={closeModal} disabled={saving} className="h-10 rounded-[8px] border border-[var(--app-border)] px-4 text-sm font-medium text-[var(--app-muted)] transition-colors disabled:opacity-60 hover:bg-[var(--app-panel-soft)]">
              取消
            </button>
            <button type="button" disabled={saving || !form.title.trim()} onClick={submit} className="h-10 rounded-[8px] bg-[var(--app-primary)] px-5 text-sm font-medium text-white transition-colors disabled:opacity-60 hover:bg-[var(--app-primary-strong)]">
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
      emptyDescription="不指定时由流程默认确认"
      includeEmpty
      emptyOptionLabel={emptyLabel}
      emptyOptionDescription="保留默认确认流程"
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
