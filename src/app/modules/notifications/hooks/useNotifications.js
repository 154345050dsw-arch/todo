import { useCallback, useEffect, useRef } from 'react';

import { api, getToken } from '../../../../api.js';

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

  useEffect(() => {
    if (!getToken()) return undefined;
    const pollNotifications = async () => {
      try {
        const notificationsData = await api.notifications({ limit: 5 });
        setNotifications(notificationsData);
        const newNotifications = notificationsData.results.filter(
          (notification) => notification.is_read === false && !shownToastIdsRef.current.has(notification.id)
        );
        if (newNotifications.length > 0) {
          newNotifications.forEach((notification) => shownToastIdsRef.current.add(notification.id));
          setNotificationToasts((prev) => [...prev, ...newNotifications.slice(0, 3 - prev.length)]);
        }
      } catch {
        // polling failures should not break the page
      }
    };
    const intervalId = setInterval(pollNotifications, 30000);
    return () => clearInterval(intervalId);
  }, []);

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

  return {
    closeNotificationToast,
    notifications,
    openNotificationTask,
    openNotificationTaskWithToast,
    refreshNotifications,
  };
}
