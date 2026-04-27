export function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatFullDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function dateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function monthKey(date = new Date()) {
  return dateKey(date).slice(0, 7);
}

export function dateFromKey(key) {
  const [year, month, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function shiftMonthKey(key, offset) {
  const date = dateFromKey(key);
  return monthKey(new Date(date.getFullYear(), date.getMonth() + offset, 1));
}

export function formatMonthTitle(key) {
  const date = dateFromKey(key);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function formatFullDate(key) {
  const date = dateFromKey(key);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

export function formatActivityTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function buildCalendarCells(month) {
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

export function activityDayMap(data) {
  return new Map((data?.days || []).map((day) => [day.date, day]));
}

export function formatRelativeTime(value) {
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
