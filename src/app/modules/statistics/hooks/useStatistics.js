import { useCallback, useEffect, useState } from 'react';

import { api } from '../../../../api.js';
import { dateKey, monthKey } from '../../../shared/utils/dateUtils.js';

export function useStatistics({ workspaceMode, setWorkspaceMode }) {
  const [dashboard, setDashboard] = useState({});
  const [meta, setMeta] = useState({ users: [], departments: [], statuses: [], priorities: [] });
  const [activityMonth, setActivityMonth] = useState(() => monthKey(new Date()));
  const [selectedActivityDate, setSelectedActivityDate] = useState(() => dateKey(new Date()));
  const [activityTimelineOpen, setActivityTimelineOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState('month');
  const [dailyActivity, setDailyActivity] = useState(() => ({ month: monthKey(new Date()), total_actions: 0, days: [] }));
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

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
    if (workspaceMode === 'overview') {
      loadDailyActivity();
    }
  }, [loadDailyActivity, workspaceMode]);

  const openOverview = useCallback(() => {
    setWorkspaceMode('overview');
    setActivityTimelineOpen(false);
  }, [setWorkspaceMode]);

  const selectActivityDate = useCallback((nextDate, options = {}) => {
    setSelectedActivityDate(nextDate);
    if (options.openTimeline !== false) {
      setActivityTimelineOpen(true);
    }
  }, []);

  const selectActivityMonth = useCallback((nextMonth) => {
    setActivityMonth(nextMonth);
    setSelectedActivityDate(nextMonth === monthKey(new Date()) ? dateKey(new Date()) : `${nextMonth}-01`);
    setActivityTimelineOpen(false);
  }, []);

  return {
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
  };
}
