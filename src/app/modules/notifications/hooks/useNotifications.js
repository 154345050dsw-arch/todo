import { useCallback, useEffect, useRef } from 'react';

import { api, getToken } from '../../../../api.js';
import { wsConnection } from '../services/websocketService.js';

export function useNotifications({
  notifications,
  openTask,
  setError,
  setNotifications,
  setNotificationsOpen,
  setNotificationToasts,
}) {
  const shownToastIdsRef = useRef(new Set());

  const refreshNotifications = useCallback(async (params = { limit: 20 }) => {
    const notificationsData = await api.notifications(params);
    setNotifications(notificationsData);
    return notificationsData;
  }, []);

  // WebSocket 连接：实时接收通知
  useEffect(() => {
    if (!getToken()) return undefined;

    const handleNewNotification = (notification) => {
      if (notification?.kind === 'task_update' || !notification?.id) return;

      // 避免重复显示
      if (shownToastIdsRef.current.has(notification.id)) return;

      shownToastIdsRef.current.add(notification.id);

      // 更新通知列表
      setNotifications((prev) => {
        const results = [notification, ...prev.results].slice(0, 20);
        const unread_count = prev.unread_count + 1;
        return { results, unread_count };
      });

      // 显示 toast（最多同时3个）
      setNotificationToasts((prev) => {
        if (prev.length >= 3) return prev;
        return [...prev, notification];
      });
    };

    const handleWebSocketError = (error) => {
      console.warn('WebSocket connection error:', error);
    };

    // 添加监听器
    const removeMessageListener = wsConnection.addMessageListener(handleNewNotification);
    const removeErrorListener = wsConnection.addErrorListener(handleWebSocketError);

    // 启动连接
    wsConnection.connect();

    return () => {
      removeMessageListener();
      removeErrorListener();
    };
  }, [setNotifications, setNotificationToasts]);

  // 备用轮询：启动时刷新一次，之后每小时刷新一次作为同步检查
  useEffect(() => {
    if (!getToken()) return undefined;

    // 启动时立即刷新一次
    refreshNotifications({ limit: 20 });

    // 每小时刷新一次作为同步检查
    const intervalId = setInterval(() => {
      refreshNotifications({ limit: 20 });
    }, 3600000); // 1小时

    return () => clearInterval(intervalId);
  }, [refreshNotifications]);

  const closeNotificationToast = useCallback((id) => {
    setNotificationToasts((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const openNotificationTaskWithToast = useCallback(async (notification) => {
    setNotificationToasts((prev) => prev.filter((item) => item.id !== notification.id));
    if (!notification?.task?.id) return;
    if (!notification.is_read) {
      await api.markNotificationRead(notification.id);
      await refreshNotifications({ limit: 20 });
    }
    await openTask(notification.task.id);
  }, [openTask, refreshNotifications]);

  const openNotificationTask = useCallback(async (notification) => {
    if (!notification?.task?.id) return;
    setNotificationsOpen(false);
    try {
      if (!notification.is_read) {
        await api.markNotificationRead(notification.id);
      }
      await refreshNotifications({ limit: 20 });
    } catch (err) {
      setError(err.message);
    }
    await openTask(notification.task.id);
  }, [openTask, refreshNotifications, setError]);

  const markAllRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      await refreshNotifications({ limit: 20 });
    } catch (err) {
      setError(err.message);
    }
  }, [refreshNotifications, setError]);

  return {
    closeNotificationToast,
    notifications,
    openNotificationTask,
    openNotificationTaskWithToast,
    refreshNotifications,
    refreshAndMarkShown: useCallback(async () => {
      const notificationsData = await api.notifications({ limit: 20 });
      setNotifications(notificationsData);
      // 更新已显示ID集合，避免后续重复toast
      notificationsData.results.forEach((n) => shownToastIdsRef.current.add(n.id));
      return notificationsData;
    }, [setNotifications]),
    markAllRead,
  };
}
