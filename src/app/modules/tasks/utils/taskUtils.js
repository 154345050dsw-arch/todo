import { dateKey, formatDate } from '../../../shared/utils/dateUtils.js';
import { searchStatusGroups } from './taskConstants.js';

export function displayUser(user) {
  return user?.display_name || user?.first_name || user?.username || '-';
}

export function sameUser(left, right) {
  return Boolean(left?.id && right?.id && Number(left.id) === Number(right.id));
}

export function confirmationUser(task) {
  return task?.confirmer || task?.creator;
}

export function isConfirmationUser(task, user) {
  return sameUser(confirmationUser(task), user);
}

export function isTaskClosed(task) {
  return ['done', 'cancelled'].includes(task?.status);
}

export function taskDisplayStatus(task) {
  return task?.user_effective_status || task?.status;
}

export function reminderTargetForTask(task) {
  if (!task || isTaskClosed(task)) return null;
  if (task.status === 'confirming') return confirmationUser(task);
  if (task.status === 'cancel_pending') return confirmationUser(task);
  const activeAssignments = (task.assignments || [])
    .filter((assignment) => ['todo', 'in_progress'].includes(assignment.status))
    .map((assignment) => assignment.assignee)
    .filter(Boolean);
  if (activeAssignments.length > 0) return activeAssignments;
  if (task.owner) return task.owner;
  if (task.candidate_owners?.length > 0) return task.candidate_owners;
  return null;
}

export function reminderButtonLabel(task) {
  return ['confirming', 'cancel_pending'].includes(task?.status) ? '催确认' : '催办';
}

export function canRemindTask(task, user) {
  if (!task || isTaskClosed(task) || task.is_limited_view) return { can: false, reason: '任务不存在或已关闭' };

  const targets = reminderTargetForTask(task);
  if (!targets) return { can: false, reason: '无明确责任人' };

  const targetList = Array.isArray(targets) ? targets : [targets];
  const validTargets = targetList.filter((target) => target?.id !== user?.id);
  if (validTargets.length === 0) return { can: false, reason: '不能催办自己' };

  if (task.latest_reminder_at) {
    const lastTime = new Date(task.latest_reminder_at);
    const now = new Date();
    const minutesDiff = (now - lastTime) / (1000 * 60);
    if (minutesDiff < 30) return { can: false, reason: `已在 ${Math.ceil(minutesDiff)} 分钟前催办过`, blockedMinutes: 30 - Math.floor(minutesDiff) };
  }

  return { can: true };
}

export function taskDueDateKey(task) {
  return task?.due_at ? dateKey(new Date(task.due_at)) : '';
}

export function isTaskDueToday(task) {
  return taskDueDateKey(task) === dateKey(new Date());
}

export function isTaskDueAfterToday(task) {
  const dueKey = taskDueDateKey(task);
  return Boolean(dueKey && dueKey > dateKey(new Date()));
}

export function isTaskDueBeforeToday(task) {
  const dueKey = taskDueDateKey(task);
  return Boolean(dueKey && dueKey < dateKey(new Date()));
}

export function isTaskOverdue(task) {
  return !isTaskClosed(task) && (task?.status === 'overdue' || isTaskDueBeforeToday(task));
}

export function searchGroupKey(task) {
  if (isTaskOverdue(task)) return 'overdue';
  return taskDisplayStatus(task) || 'todo';
}

export function groupSearchTasks(tasks) {
  return searchStatusGroups
    .map((group) => ({
      ...group,
      tasks: tasks.filter((task) => searchGroupKey(task) === group.key),
    }))
    .filter((group) => group.tasks.length > 0);
}

export function scopeForTask(task, user, currentScope) {
  const effectiveStatus = taskDisplayStatus(task);
  if (effectiveStatus === 'done') return 'done';
  if (effectiveStatus === 'cancelled') return 'cancelled';
  if (task?.status === 'cancel_pending' && sameUser(task.creator, user)) return 'cancel_pending';
  if (task?.status === 'confirming') return isConfirmationUser(task, user) ? 'confirming' : currentScope;
  if (isTaskOverdue(task)) return 'overdue';
  const needsHandling = task?.can_claim || sameUser(task.owner, user) || ['todo', 'in_progress'].includes(task?.user_assignment?.status);
  if (!isTaskClosed(task) && needsHandling && isTaskDueToday(task)) return 'my_todo';
  if (!isTaskClosed(task) && (isTaskDueAfterToday(task) || !task?.due_at)) return 'future';
  if (!isTaskClosed(task) && sameUser(task.creator, user)) return 'created';
  if (!isTaskClosed(task) && task?.participants?.some((participant) => sameUser(participant, user))) return 'participated';
  return currentScope;
}

function calculateHoursRemaining(dueAt) {
  if (!dueAt) return null;
  const now = new Date();
  const due = new Date(dueAt);
  return (due - now) / (1000 * 60 * 60);
}

export function getDeadlineUrgency(dueAt, isOverdue) {
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

export function dueMeta(task) {
  if (!task?.due_at) {
    return { label: '未设置', className: 'text-[var(--app-subtle)]' };
  }
  if (isTaskOverdue(task)) {
    return { label: formatDate(task.due_at), className: 'text-[#c24141] dark:text-[#fca5a5]' };
  }
  return { label: formatDate(task.due_at), className: 'text-[var(--app-muted)]' };
}
