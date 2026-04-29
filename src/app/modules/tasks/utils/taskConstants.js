import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ListChecks,
  X,
} from 'lucide-react';

export const statusLabels = {
  todo: '待处理',
  in_progress: '处理中',
  confirming: '待完成确认',
  overdue: '已超时',
  done: '已完成',
  cancel_pending: '待取消确认',
  cancelled: '已取消',
};

export const completedStatusTone = 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
export const pendingStatusTone = 'border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-500/20 dark:bg-stone-500/10 dark:text-stone-400';
export const flowPendingStatusTone = 'border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-500/20 dark:bg-stone-500/10 dark:text-stone-300';

export const statusTone = {
  todo: pendingStatusTone,
  in_progress: 'border-indigo-200/60 bg-indigo-50/50 text-indigo-600 dark:border-indigo-500/15 dark:bg-indigo-500/8 dark:text-indigo-400',
  confirming: pendingStatusTone,
  overdue: 'border-red-200/60 bg-red-50/50 text-red-600 dark:border-red-500/15 dark:bg-red-500/8 dark:text-red-400',
  done: completedStatusTone,
  cancel_pending: 'border-amber-200/60 bg-amber-50/50 text-amber-600 dark:border-amber-500/15 dark:bg-amber-500/8 dark:text-amber-400',
  cancelled: 'border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-500/20 dark:bg-stone-500/10 dark:text-stone-400',
};

export const statusTextClass = (status) => {
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

export const searchStatusGroups = [
  { key: 'overdue', label: '已超时', Icon: AlertTriangle, className: 'text-red-500' },
  { key: 'todo', label: '待处理', Icon: ListChecks, className: 'text-[var(--app-muted)]' },
  { key: 'in_progress', label: '处理中', Icon: Clock3, className: 'text-[var(--app-muted)]' },
  { key: 'confirming', label: '待确认', Icon: ClipboardCheck, className: 'text-purple-500' },
  { key: 'cancel_pending', label: '待取消确认', Icon: AlertTriangle, className: 'text-yellow-500' },
  { key: 'done', label: '已完成', Icon: CheckCircle2, className: 'text-green-500' },
  { key: 'cancelled', label: '已取消', Icon: X, className: 'text-[var(--app-muted)]' },
];

export const eventBarStyles = {
  todo: 'bg-zinc-200/70 text-zinc-700 dark:bg-zinc-700/40 dark:text-zinc-300',
  in_progress: 'bg-indigo-200/70 text-indigo-800 dark:bg-indigo-700/40 dark:text-indigo-300',
  confirming: 'bg-blue-200/70 text-blue-800 dark:bg-blue-700/40 dark:text-blue-300',
  done: 'bg-emerald-200/70 text-emerald-800 dark:bg-emerald-700/40 dark:text-emerald-300',
  cancel_pending: 'bg-amber-200/70 text-amber-800 dark:bg-amber-700/40 dark:text-amber-300',
  cancelled: 'bg-zinc-200/50 text-zinc-500 dark:bg-zinc-700/30 dark:text-zinc-400',
  overdue: 'bg-red-200/70 text-red-800 dark:bg-red-700/40 dark:text-red-300',
  created: 'bg-blue-200/70 text-blue-800 dark:bg-blue-700/40 dark:text-blue-300',
};
