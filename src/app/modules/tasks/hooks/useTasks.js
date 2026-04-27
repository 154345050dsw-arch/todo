import { useCallback, useEffect, useRef, useState } from 'react';

import { api, getToken } from '../../../../api.js';
import { wsConnection } from '../../notifications/services/websocketService.js';
import { canRemindTask, scopeForTask } from '../utils/taskUtils.js';

export function useTasks({
  user,
  workspaceMode,
  setWorkspaceMode,
  loadDailyActivity,
  setDashboard,
  setMeta,
  setNotifications,
  showToast,
}) {
  const [scope, setScope] = useState('my_todo');
  const [tasks, setTasks] = useState([]);
  const [tasksScope, setTasksScope] = useState('my_todo');
  const [detail, setDetail] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [reminderModal, setReminderModal] = useState({ open: false, task: null });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [filters, setFilters] = useState({ mineOnly: false, sortDue: true });
  const [error, setError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');

  const searchInputRef = useRef(null);
  const searchRequestRef = useRef(0);
  const dataRequestRef = useRef(0);
  const createButtonRef = useRef(null);
  const pendingNotificationsRef = useRef([]);

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
  }, [filters.mineOnly, filters.sortDue, scope, setDashboard, setMeta, setNotifications]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WebSocket 监听：实时刷新任务列表
  useEffect(() => {
    if (!getToken()) return undefined;

    const handleTaskNotification = (notification) => {
      // 任务相关的通知类型
      const taskRelatedTypes = ['task_created', 'task_transferred', 'task_reworked', 'task_completed', 'task_cancel_requested'];
      if (!taskRelatedTypes.includes(notification.notification_type)) return;

      // 用户正在创建任务时缓存通知，不打断
      if (createOpen) {
        pendingNotificationsRef.current.push(notification);
        return;
      }

      // 检查通知是否与当前视图相关
      const shouldRefresh = ['my_todo', 'future', 'created', 'participated', 'overdue', 'confirming'].includes(scope);
      if (shouldRefresh) {
        loadData();
      }
    };

    // 添加监听器
    const removeMessageListener = wsConnection.addMessageListener(handleTaskNotification);

    // 启动连接
    wsConnection.connect();

    return () => {
      removeMessageListener();
    };
  }, [createOpen, scope, loadData]);

  // 处理缓存的通知：用户完成创建任务后
  useEffect(() => {
    if (!createOpen && pendingNotificationsRef.current.length > 0) {
      pendingNotificationsRef.current = [];
      loadData();
    }
  }, [createOpen, loadData]);

  const selectTaskScope = useCallback((nextScope) => {
    setWorkspaceMode('tasks');
    if (nextScope !== scope) {
      dataRequestRef.current += 1;
      setTasks([]);
      setTasksScope(nextScope);
      setFilters((current) => ({ ...current, sortDue: true }));
    }
    setScope(nextScope);
  }, [scope, setWorkspaceMode]);

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

  const openTask = useCallback(async (taskId) => {
    const data = await api.task(taskId);
    setDetail(data);
    setDrawerOpen(true);
  }, []);

  const patchTask = useCallback(async (taskId, payload) => {
    const updatedTask = await api.patchTask(taskId, payload);
    if (detail?.id === updatedTask.id) {
      setDetail(updatedTask);
    }
    await loadData();
    return updatedTask;
  }, [detail?.id, loadData]);

  const openSearchResult = useCallback(async (task) => {
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
  }, [closeSearch, openTask, scope, setWorkspaceMode, user]);

  const refreshDetail = useCallback(async (taskId = detail?.id) => {
    if (taskId) {
      setDetail(await api.task(taskId));
    }
    await loadData();
    if (workspaceMode === 'overview') {
      await loadDailyActivity();
    }
  }, [detail?.id, loadData, loadDailyActivity, workspaceMode]);

  const openReminder = useCallback((task) => {
    const check = canRemindTask(task, user);
    if (!check.can) return;
    setReminderModal({ open: true, task });
  }, [user]);

  const submitReminder = useCallback(async (task, remark) => {
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
  }, [detail?.id, loadData, loadDailyActivity, showToast, workspaceMode]);

  return {
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
    patchTask,
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
    tasks,
    tasksScope,
    visibleTasks: workspaceMode === 'tasks' && tasksScope === scope ? tasks : [],
    closeSearch,
  };
}
