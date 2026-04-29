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
import WorkspaceSidebar from './app/modules/navigation/components/WorkspaceSidebar.jsx';
import WorkspaceTopBar from './app/modules/navigation/components/WorkspaceTopBar.jsx';
import { ToastContainer, ToastMessage } from './app/modules/notifications/components/NotificationCenter.jsx';
import { useNotifications } from './app/modules/notifications/hooks/useNotifications.js';
import OrganizationPage from './app/modules/organization/components/OrganizationManager.jsx';
import { DailyActivityCalendar, DailyActivityTimeline } from './app/modules/statistics/components/DailyActivityViews.jsx';
import { useStatistics } from './app/modules/statistics/hooks/useStatistics.js';
import TaskBoard from './app/modules/tasks/components/TaskBoard.jsx';
import TaskCreateModal from './app/modules/tasks/components/TaskCreateModal.jsx';
import { ReminderModal, TaskSearchModal } from './app/modules/tasks/components/TaskModals.jsx';
import TaskDetailDrawer from './app/modules/tasks/components/TaskDetailDrawer.jsx';
import TaskContentHeader from './app/modules/tasks/components/TaskContentHeader.jsx';
import { Badge, badgeClass } from './app/shared/components/Badge.jsx';
import { Tooltip } from './app/shared/components/Tooltip.jsx';
import LoginPage from './app/modules/auth/components/LoginPage.jsx';
import { useTasks } from './app/modules/tasks/hooks/useTasks.js';
import {
  buildCalendarCells,
  activityDayMap,
  dateFromKey,
  dateKey,
  formatActivityTime,
  formatDateTime,
  formatFullDate,
  formatFullDateTime,
  formatMonthTitle,
  formatRelativeTime,
  monthKey,
  shiftMonthKey,
} from './app/shared/utils/dateUtils.js';
import {
  completedStatusTone,
  eventBarStyles,
  flowPendingStatusTone,
  statusLabels,
  statusTextClass,
  statusTone,
} from './app/modules/tasks/utils/taskConstants.js';
import {
  canRemindTask,
  displayUser,
  dueMeta,
  getDeadlineUrgency,
  groupSearchTasks,
  isTaskOverdue,
  reminderButtonLabel,
  reminderTargetForTask,
  sameUser,
  scopeForTask,
  searchGroupKey,
  taskDueDateKey,
} from './app/modules/tasks/utils/taskUtils.js';
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

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
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
    return <LoginPage onAuthed={setUser} />;
  }

  return <Workspace user={user} onLogout={() => { setToken(null); setUser(null); }} />;
}

function Workspace({ user, onLogout }) {
  const [workspaceMode, setWorkspaceMode] = useState('tasks');
  const [notifications, setNotifications] = useState({ unread_count: 0, results: [] });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationToasts, setNotificationToasts] = useState([]);
  const [toast, setToast] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [dataScope, setDataScope] = useState(() => {
    if (user?.is_super_admin) return 'all_departments';
    if (user?.is_department_manager) return 'my_department_tree';
    return 'related';
  }); // 数据范围：related/my_department/my_department_tree/all_departments
  const [detailSurfaceMode, setDetailSurfaceMode] = useState(() => {
    try {
      const stored = localStorage.getItem('flowdesk_detail_surface_mode');
      return stored === 'modal' || stored === 'side' ? stored : 'side';
    } catch {
      return 'side';
    }
  });
  const { theme, setTheme } = useTheme();
  const {
    activityError,
    activityLoading,
    activityMonth,
    activityTimelineOpen,
    calendarMode,
    dailyActivity,
    dashboard,
    loadDailyActivity,
    meta,
    openOverview,
    selectActivityDate,
    selectActivityMonth,
    selectedActivityDate,
    setActivityTimelineOpen,
    setCalendarMode,
    setDashboard,
    setMeta,
  } = useStatistics({ workspaceMode, setWorkspaceMode });
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message) => {
    window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);
  const {
    activeSearchIndex,
    createButtonRef,
    createOpen,
    detail,
    drawerOpen,
    error,
    filters,
    lastSyncTime,
    loadData,
    openReminder,
    openSearchResult,
    openTask,
    refreshDetail,
    reminderModal,
    scope,
    searchError,
    searchInputRef,
    searchLoading,
    searchOpen,
    searchQuery,
    searchResults,
    selectTaskScope,
    setActiveSearchIndex,
    setCreateOpen,
    setDrawerOpen,
    setError,
    setFilters,
    setReminderModal,
    setSearchOpen,
    setSearchQuery,
    syncStatus,
    submitReminder,
    visibleTasks,
    closeSearch,
  } = useTasks({
    user,
    workspaceMode,
    dataScope,
    setWorkspaceMode,
    loadDailyActivity,
    setDashboard,
    setMeta,
    showToast,
    setNotifications,
  });
  const {
    closeNotificationToast,
    openNotificationTask,
    openNotificationTaskWithToast,
    refreshAndMarkShown,
    markAllRead,
  } = useNotifications({
    notifications,
    openTask,
    setError,
    setNotifications,
    setNotificationsOpen,
    setNotificationToasts,
  });

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setUserMenuOpen(false);
    setNotificationsOpen(false);
  }, []);

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e) => {
      const typingInEditable = isEditableTarget(e.target);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
        return;
      }
      if (typingInEditable) {
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

  const updateDetailSurfaceMode = useCallback((mode) => {
    setDetailSurfaceMode(mode);
    try {
      localStorage.setItem('flowdesk_detail_surface_mode', mode);
    } catch {}
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="grid h-full grid-cols-[280px_minmax(0,1fr)]">
        <WorkspaceSidebar
          navGroups={navGroups}
          dashboard={dashboard}
          workspaceMode={workspaceMode}
          scope={scope}
          onSelectTaskScope={selectTaskScope}
          onOpenOverview={openOverview}
          onOpenOrganization={() => setWorkspaceMode('organization')}
          user={user}
        />

        {/* Main Content Area */}
        <main className={`relative min-w-0 flex flex-col overflow-hidden transition-all duration-300 ${drawerOpen && detailSurfaceMode === 'side' ? 'mr-[min(clamp(640px,58vw,860px),calc(100vw-300px))]' : ''}`}>
          <WorkspaceTopBar
            onSearchOpen={openSearch}
            notificationsOpen={notificationsOpen}
            notifications={notifications}
            onToggleNotifications={() => {
              setNotificationsOpen((value) => {
                if (!value) {
                  // 打开铃铛时刷新通知并标记已显示ID
                  refreshAndMarkShown();
                }
                return !value;
              });
              setUserMenuOpen(false);
            }}
            onOpenNotificationTask={openNotificationTask}
            onMarkAllRead={markAllRead}
            formatActivityTime={formatActivityTime}
            onCreate={() => setCreateOpen(true)}
            createButtonRef={createButtonRef}
            user={user}
            userMenuOpen={userMenuOpen}
            onToggleUserMenu={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotificationsOpen(false);
            }}
            displayUser={displayUser}
            theme={theme}
            setTheme={setTheme}
            onLogout={() => {
              setUserMenuOpen(false);
              onLogout();
            }}
          />

          {/* Content Section - Kanban Only */}
          <section className={`relative flex-1 flex flex-col overflow-hidden p-5`}>
            {/* Click away to close drawer - only covers empty space */}
            {drawerOpen && detailSurfaceMode === 'side' && (
              <div
                className="absolute inset-0 z-0 cursor-pointer"
                onClick={() => setDrawerOpen(false)}
              />
            )}
            <div className="relative z-10 flex flex-1 flex-col min-h-0">
              <TaskContentHeader
                workspaceMode={workspaceMode}
                pageInfo={pageInfo}
                syncStatus={syncStatus}
                lastSyncTime={lastSyncTime}
                formatRelativeTime={formatRelativeTime}
                onRetry={loadData}
                error={error}
                user={user}
                dataScope={dataScope}
                onDataScopeChange={setDataScope}
                filters={filters}
                onFiltersChange={setFilters}
              />

            {/* Kanban Board / Task List */}
            <div className="flex-1 min-h-0 overflow-auto">
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
                buildCalendarCells={buildCalendarCells}
                activityDayMap={activityDayMap}
                dateFromKey={dateFromKey}
                dateKey={dateKey}
                monthKey={monthKey}
                shiftMonthKey={shiftMonthKey}
                formatMonthTitle={formatMonthTitle}
                formatActivityTime={formatActivityTime}
                WEEKDAYS={WEEKDAYS}
                eventBarStyles={eventBarStyles}
              />
            ) : (
              <TaskBoard
                tasks={visibleTasks}
                onOpen={openTask}
                onRemind={openReminder}
                scope={scope}
                user={user}
                Tooltip={Tooltip}
                canRemindTask={canRemindTask}
                isTaskOverdue={isTaskOverdue}
                reminderButtonLabel={reminderButtonLabel}
                taskDueDateKey={taskDueDateKey}
                dateKey={dateKey}
                dateFromKey={dateFromKey}
                dueMeta={dueMeta}
                displayUser={displayUser}
                statusTextClass={statusTextClass}
                statusLabels={statusLabels}
                formatActivityTime={formatActivityTime}
              />
            )}
            </div>
            </div>
          </section>

          {/* Right Panel: Detail Drawer or Insight Panel */}
          {drawerOpen ? (
            <TaskDetailDrawer
              task={detail}
              open={drawerOpen}
              surfaceMode={detailSurfaceMode}
              onSurfaceModeChange={updateDetailSurfaceMode}
              meta={meta}
              user={user}
              onClose={() => setDrawerOpen(false)}
              onRefresh={refreshDetail}
              statusLabels={statusLabels}
              statusTone={statusTone}
              completedStatusTone={completedStatusTone}
              flowPendingStatusTone={flowPendingStatusTone}
              getDeadlineUrgency={getDeadlineUrgency}
              displayUser={displayUser}
              sameUser={sameUser}
              reminderTargetForTask={reminderTargetForTask}
              canRemindTask={canRemindTask}
              isTaskOverdue={isTaskOverdue}
              formatFullDateTime={formatFullDateTime}
              formatDateTime={formatDateTime}
              formatRelativeTime={formatRelativeTime}
              formatActivityTime={formatActivityTime}
            />
          ) : workspaceMode === 'overview' && activityTimelineOpen ? (
            <DailyActivityTimeline
              data={dailyActivity}
              selectedDate={selectedActivityDate}
              loading={activityLoading}
              onOpenTask={openTask}
              onClose={() => setActivityTimelineOpen(false)}
              activityDayMap={activityDayMap}
              formatFullDate={formatFullDate}
              formatActivityTime={formatActivityTime}
              Badge={Badge}
              badgeClass={badgeClass}
              statusTone={statusTone}
              statusLabels={statusLabels}
              displayUser={displayUser}
            />
          ) : null}

          {/* Create Modal */}
          <TaskCreateModal
            open={createOpen}
            meta={meta}
            currentUser={user}
            restoreFocusRef={createButtonRef}
            displayUser={displayUser}
            onClose={() => setCreateOpen(false)}
            onRefreshMeta={loadData}
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
            groupSearchTasks={groupSearchTasks}
            displayUser={displayUser}
            dueMeta={dueMeta}
            Badge={Badge}
            badgeClass={badgeClass}
            statusTone={statusTone}
            searchGroupKey={searchGroupKey}
            statusLabels={statusLabels}
          />

          <ReminderModal
            open={reminderModal.open}
            task={reminderModal.task}
            onClose={() => setReminderModal({ open: false, task: null })}
            onSubmit={submitReminder}
            reminderTargetForTask={reminderTargetForTask}
            displayUser={displayUser}
            reminderButtonLabel={reminderButtonLabel}
            dueMeta={dueMeta}
            formatFullDateTime={formatFullDateTime}
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
