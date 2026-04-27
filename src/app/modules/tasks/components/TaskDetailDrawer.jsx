import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from '../../../shared/components/Tooltip.jsx';
import {
  ArrowRightLeft,
  BellRing,
  Bold,
  Check,
  CheckCircle2,
  ChevronDown,
  ImagePlus,
  Italic,
  Link2,
  List,
  PlayCircle,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../../../../api.js';
import { RemindActionButton } from './TaskBoard.jsx';
import { DeadlineDisplay, DurationAnalysis, FlowSummary, TaskContentSection } from './TaskDetailViews.jsx';

function canPerformAction(task, action) {
  const permissionField = `can_${action}`;
  if (task?.[permissionField] !== undefined) {
    return task[permissionField];
  }
  return false;
}

function getUserRoles(task, user, sameUser) {
  const roles = [];
  if (!task || !user) return roles;
  if (sameUser(task.creator, user)) roles.push('creator');
  if (sameUser(task.owner, user)) roles.push('owner');
  if (sameUser(task.confirmer, user)) roles.push('confirmer');
  if (task.participants?.some((participant) => sameUser(participant, user))) roles.push('participant');
  if (task.user_roles?.includes('transferrer')) roles.push('transferrer');
  return roles;
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

function formatDurationHours(hours) {
  if (hours === null || hours === undefined || hours === '') return '-';
  const value = Number(hours);
  if (!Number.isFinite(value)) return '-';
  const minutes = Math.max(Math.round(value * 60), 0);
  return formatFlowDuration(minutes);
}

function primaryActionForTask(task, user, sameUser) {
  if (!task || ['done', 'cancelled'].includes(task.status)) return null;
  if (task.can_claim) {
    return { label: '开始处理', payload: { action: 'claim_task', note: '开始处理' } };
  }
  if (task.status === 'cancel_pending') {
    if (getUserRoles(task, user, sameUser).includes('creator')) {
      return { label: '确认取消', payload: { action: 'confirm_cancel', note: '确认取消任务' } };
    }
    return null;
  }
  if (task.status === 'todo') {
    if (!getUserRoles(task, user, sameUser).includes('owner')) return null;
    return { label: '开始处理', payload: { action: 'change_status', status: 'in_progress', note: '开始处理' } };
  }
  if (task.status === 'in_progress') {
    if (!canPerformAction(task, 'confirm_complete')) return null;
    return { label: '确认完成', payload: { action: 'confirm_complete', note: '提交确认' } };
  }
  if (task.status === 'confirming') {
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

export default function TaskDetailDrawer({
  task,
  open,
  meta,
  user,
  onClose,
  onRefresh,
  onRemind,
  statusLabels,
  statusTone,
  completedStatusTone,
  flowPendingStatusTone,
  getDeadlineUrgency,
  displayUser,
  sameUser,
  reminderTargetForTask,
  reminderButtonLabel,
  canRemindTask,
  isTaskOverdue,
  formatFullDateTime,
  formatDateTime,
  formatRelativeTime,
  formatActivityTime,
}) {
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
  const [showReworkDialog, setShowReworkDialog] = useState(false);
  const [reworkReason, setReworkReason] = useState('');
  const [selectedReworkUser, setSelectedReworkUser] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    info: false,
    timeline: true,
    comments: false,
  });

  useEffect(() => {
    setComment('');
    setShowCancelDialog(false);
    setShowTransferPicker(false);
    setCancelReason('');
    setShowCompletionDialog(false);
    setShowTransferDialog(false);
    setShowRemindDialog(false);
    setShowReworkDialog(false);
    setCompletionNote('');
    setTransferNote('');
    setRemindNote('请尽快处理该任务');
    setReworkReason('');
    setSelectedTransferUser(null);
    setSelectedReworkUser(null);
    setExpandedSections({ info: false, timeline: true, comments: false });
  }, [task?.id]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
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
        if (showReworkDialog) {
          setShowReworkDialog(false);
          setReworkReason('');
          setSelectedReworkUser(null);
          return;
        }
        if (showTransferPicker) {
          setShowTransferPicker(false);
          return;
        }
        onClose();
      }
    }
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
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

  const primaryAction = primaryActionForTask(task, user, sameUser);
  const isClosed = task ? ['done', 'cancelled'].includes(task.status) : false;
  const isCreator = sameUser(task?.creator, user);
  const isContentLocked = task?.is_limited_view;
  const taskIsOverdue = task ? isTaskOverdue(task) : false;
  const isCancelPending = task?.status === 'cancel_pending';
  const needsCompletionNote = primaryAction?.payload?.action === 'confirm_complete' && task?.status === 'in_progress';
  const remindTargets = reminderTargetForTask(task);
  const remindTargetList = Array.isArray(remindTargets) ? remindTargets : remindTargets ? [remindTargets] : [];
  const remindTargetText = remindTargetList.map((target) => displayUser(target)).join('、');
  const DetailRemindActionButton = (props) => (
    <RemindActionButton
      {...props}
      canRemindTask={canRemindTask}
      isTaskOverdue={isTaskOverdue}
      reminderButtonLabel={reminderButtonLabel}
    />
  );

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
      await runAction({ action: 'cancel', note: cancelReason });
      setShowCancelDialog(false);
      setCancelReason('');
    } finally {
      setSaving(false);
    }
  }

  async function handleRework() {
    const reasonText = reworkReason.replace(/<[^>]*>/g, '').trim();
    if (!reasonText) return;
    setSaving(true);
    try {
      await runAction({
        action: 'rework',
        rework_reason: reworkReason,
        rework_owner_id: selectedReworkUser?.id,
      });
      setShowReworkDialog(false);
      setReworkReason('');
      setSelectedReworkUser(null);
    } finally {
      setSaving(false);
    }
  }

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
      <div className="flex h-16 items-center justify-between border-b border-[var(--app-border)] px-6">
        <span className="text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--app-subtle)]">{task?.code}</span>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition-all duration-200 hover:bg-[var(--app-panel-soft)]" aria-label="关闭详情">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {task ? (
        <div className="h-[calc(100%-4rem)] overflow-y-auto">
          <div className="px-8 pt-6 pb-5">
            <h1 className="text-[22px] font-semibold leading-snug font-[var(--app-title-font)]">{task.title}</h1>

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

            {task.due_at && (
              <div className="mt-4">
                <DeadlineDisplay dueAt={task.due_at} isOverdue={task.is_overdue} getDeadlineUrgency={getDeadlineUrgency} />
              </div>
            )}

            <div className="mt-4 inline-flex items-center gap-2.5">
              <Badge className={badgeClass(statusTone, taskIsOverdue ? 'overdue' : task.status)}>
                {statusLabels[task.status]}
              </Badge>
              {task.reminder_count > 0 && !isClosed && (
                <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-orange-200 bg-orange-50 px-2.5 py-1 text-[13px] font-medium text-orange-600 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400">
                  <BellRing size={14} strokeWidth={1.5} />
                  催办 ({task.reminder_count}次)
                </span>
              )}
              {task.rework_count > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-orange-200 bg-orange-50 px-2.5 py-1 text-[13px] font-medium text-orange-600 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400">
                  <RotateCcw size={14} strokeWidth={1.5} />
                  重办 ({task.rework_count}次)
                </span>
              )}
              {task.priority === 'high' && !isClosed && (
                <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-red-50 px-2.5 py-1 text-[13px] font-medium text-red-500 dark:bg-red-500/10">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  高优先
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--app-border)]" />

          <div className="px-8 py-6">
            <h3 className="mb-3 text-[15px] font-medium text-[var(--app-muted)]">任务内容</h3>
            <TaskContentSection task={task} isLocked={isContentLocked} />
          </div>

          {(isCancelPending || task.status === 'cancelled') && task.cancel_reason && (
            <div className="px-8 pb-5">
              <div className="rounded-[12px] border border-yellow-200 bg-yellow-50 p-4 text-[15px] dark:border-yellow-900 dark:bg-yellow-950">
                <div className="text-[13px] font-medium text-yellow-600 dark:text-yellow-400">取消原因</div>
                <div className="mt-2 text-yellow-700 dark:text-yellow-300">{task.cancel_reason}</div>
              </div>
            </div>
          )}

          {!isClosed && !isContentLocked && (
            <div className="px-8 pb-6">
              {isCancelPending ? (
                <div className="flex gap-3">
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
                <div className="flex items-center gap-3">
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

                  <Tooltip content={!canPerformAction(task, 'transfer') ? '只有创建人或责任人可以转派' : null}>
                    <div className="relative">
                      <button
                        disabled={saving || !canPerformAction(task, 'transfer')}
                        type="button"
                        onClick={() => canPerformAction(task, 'transfer') && setShowTransferPicker((value) => !value)}
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
                          {meta.users?.filter((item) => item.id !== task?.owner?.id).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                setShowTransferPicker(false);
                                setSelectedTransferUser(item);
                                setShowTransferDialog(true);
                              }}
                              className="h-10 w-full rounded-lg px-3 text-left text-[15px] transition-colors hover:bg-[var(--app-panel-soft)]"
                            >
                              {displayUser(item)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </Tooltip>

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

                  {/* 重办按钮 - 只在 confirming 状态显示 */}
                  {task.status === 'confirming' && canPerformAction(task, 'rework') && (
                    <Tooltip content={!canPerformAction(task, 'rework') ? '只有确认人可以重办' : null}>
                      <button
                        disabled={saving}
                        type="button"
                        onClick={() => setShowReworkDialog(true)}
                        className={`h-11 shrink-0 rounded-xl border px-4 text-[15px] font-medium transition-all shadow-sm ${
                          canPerformAction(task, 'rework')
                            ? 'border-orange-300 bg-orange-100 text-orange-700 hover:border-orange-400 hover:bg-orange-200 dark:border-orange-500/40 dark:bg-orange-500/20 dark:text-orange-400'
                            : 'cursor-not-allowed border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
                        } ${saving ? 'opacity-50' : ''}`}
                      >
                        <span className="flex items-center gap-1.5">
                          <RotateCcw size={16} strokeWidth={1.5} />
                          重办
                        </span>
                      </button>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          )}

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

          <RichTextModal
            open={showCancelDialog}
            onClose={() => { setShowCancelDialog(false); setCancelReason(''); }}
            onSubmit={getUserRoles(task, user, sameUser).includes('creator') ? handleCancel : handleApplyCancel}
            value={cancelReason}
            onChange={setCancelReason}
            saving={saving}
            config={{
              icon: XCircle,
              title: getUserRoles(task, user, sameUser).includes('creator') ? '取消任务' : '申请取消',
              hint: '请填写取消原因（必填），支持富文本格式',
              placeholder: '例如：资源不足、需求变更...',
              submitLabel: getUserRoles(task, user, sameUser).includes('creator') ? '确认取消' : '提交申请',
              color: {
                text: 'text-red-500 dark:text-red-400',
                button: 'bg-red-500 hover:bg-red-600',
              },
            }}
          />

          {/* 重办对话框 */}
          <ReworkModal
            open={showReworkDialog}
            task={task}
            meta={meta}
            onClose={() => {
              setShowReworkDialog(false);
              setReworkReason('');
              setSelectedReworkUser(null);
            }}
            onSubmit={handleRework}
            reworkReason={reworkReason}
            setReworkReason={setReworkReason}
            selectedReworkUser={selectedReworkUser}
            setSelectedReworkUser={setSelectedReworkUser}
            saving={saving}
            displayUser={displayUser}
          />

          <div className="border-t border-[var(--app-border)]" />

          <div className="px-8 py-5">
            <CollapsibleSection key={`${task.id}-timeline`} title="流转记录" defaultOpen={expandedSections.timeline}>
              <FlowSummary
                task={task}
                records={task.events || []}
                onRemind={onRemind}
                user={user}
                Badge={Badge}
                badgeClass={badgeClass}
                displayUser={displayUser}
                formatActivityTime={formatActivityTime}
                formatDateTime={formatDateTime}
                statusLabels={statusLabels}
                completedStatusTone={completedStatusTone}
                flowPendingStatusTone={flowPendingStatusTone}
                RemindActionButton={DetailRemindActionButton}
              />
            </CollapsibleSection>

            <CollapsibleSection title="任务信息" defaultOpen={expandedSections.info}>
              <div className="grid grid-cols-2 gap-2.5 text-[15px]">
                {[
                  ['负责人', task.owner
                    ? displayUser(task.owner)
                    : task.candidate_owners?.length > 0
                      ? task.candidate_owners.map(displayUser).join(' / ')
                      : '-'],
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

            <CollapsibleSection title="耗时分析" defaultOpen={false}>
              <DurationAnalysis data={task.duration_analysis} />
            </CollapsibleSection>

            <CollapsibleSection title="评论" defaultOpen={expandedSections.comments}>
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

function RichTextModal({ open, onClose, onSubmit, value, onChange, saving, config }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const linkInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const initializedRef = useRef(false);

  // 只在打开时初始化内容，避免编辑过程中重置导致光标跳动
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      setLinkOpen(false);
      setLinkUrl('');
      return;
    }
    if (!editorRef.current || initializedRef.current) return;
    editorRef.current.innerHTML = value || '';
    initializedRef.current = true;
  }, [open]);

  // 同步编辑器内容到外部状态
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
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md animate-modalPop rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(15,23,42,0.24)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
          <div className={`flex items-center gap-2 text-base font-semibold ${color.text}`}>
            <Icon size={20} />
            {title}
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {config.targetInfo && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-700/50 dark:bg-amber-900/30">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-amber-700 dark:text-amber-400">催办对象：</span>
                <span className="font-medium text-amber-800 dark:text-amber-300">{config.targetInfo}</span>
              </div>
              {config.senderInfo && (
                <div className="mt-1.5 flex items-center gap-2 text-sm">
                  <span className="text-amber-700 dark:text-amber-400">催办人：</span>
                  <span className="font-medium text-amber-800 dark:text-amber-300">{config.senderInfo}</span>
                </div>
              )}
              {config.taskTitle && (
                <div className="mt-1.5 flex items-center gap-2 text-sm">
                  <span className="text-amber-700 dark:text-amber-400">任务标题：</span>
                  <span className="truncate font-medium text-amber-800 dark:text-amber-300">{config.taskTitle}</span>
                </div>
              )}
              {config.dueAt && (
                <div className="mt-1.5 flex items-center gap-2 text-sm">
                  <span className="text-amber-700 dark:text-amber-400">截止时间：</span>
                  <span className="font-medium text-amber-800 dark:text-amber-300">{config.dueAt}</span>
                </div>
              )}
            </div>
          )}
          <p className="mb-3 text-xs text-[var(--app-muted)]">{hint}</p>

          <div className="relative mb-2 flex items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-1">
            {[
              ['bold', Bold, '加粗'],
              ['italic', Italic, '斜体'],
              ['insertUnorderedList', List, '列表'],
            ].map(([command, CmdIcon, label]) => (
              <button
                key={command}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runCommand(command)}
                className="grid size-7 place-items-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
                title={label}
              >
                <CmdIcon size={14} />
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
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
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => insertImage(event.target.files?.[0])} />

            {linkOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[260px] rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-2 shadow-lg">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--app-text)]">
                  <span className="grid size-5 place-items-center rounded bg-[var(--app-primary)]/10 text-[var(--app-primary)]">
                    <Link2 size={12} />
                  </span>
                  链接地址
                </div>
                <div className="flex items-center gap-1.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 focus-within:border-[var(--app-primary)]">
                  <input
                    ref={linkInputRef}
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
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

        <div className="flex justify-end gap-2.5 border-t border-[var(--app-border)] px-5 py-4">
          <button onClick={onClose} className="h-9 rounded-lg border border-[var(--app-border)] px-4 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)]">
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

function ReworkModal({
  open,
  task,
  meta,
  onClose,
  onSubmit,
  reworkReason,
  setReworkReason,
  selectedReworkUser,
  setSelectedReworkUser,
  saving,
  displayUser,
}) {
  // 默认重办人：查找最后一次提交确认前的 owner（通过 FlowEvent）
  const defaultOwner = task?.events?.find(e => e.to_status === 'confirming')?.from_owner || task?.owner;

  // 打开对话框时初始化 selectedReworkUser 为默认重办人
  useEffect(() => {
    if (open && defaultOwner && !selectedReworkUser) {
      setSelectedReworkUser(meta.users?.find(u => u.id === defaultOwner.id));
    }
  }, [open, defaultOwner, selectedReworkUser, meta.users, setSelectedReworkUser]);

  if (!open || !task) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const reasonText = reworkReason.replace(/<[^>]*>/g, '').trim();
    if (!reasonText) return;
    onSubmit();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30 px-4 py-6 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md animate-modalPop rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(15,23,42,0.24)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
          <div className="flex items-center gap-2 text-base font-semibold text-orange-600 dark:text-orange-400">
            <RotateCcw size={20} />
            重办任务
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="mb-3 text-xs text-[var(--app-muted)]">
            任务将退回重新处理，请填写重办原因。
          </p>

          {/* 重办人选择 */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-[var(--app-text)]">重办人</label>
            <select
              value={selectedReworkUser?.id || defaultOwner?.id || ''}
              onChange={(e) => {
                const userId = parseInt(e.target.value);
                setSelectedReworkUser(meta.users?.find(u => u.id === userId));
              }}
              className="mt-2 h-10 w-full rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
            >
              {meta.users?.map(user => (
                <option key={user.id} value={user.id}>{displayUser(user)}</option>
              ))}
            </select>
          </div>

          {/* 重办原因 */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-[var(--app-text)]">重办原因（必填）</label>
            <textarea
              value={reworkReason}
              onChange={(e) => setReworkReason(e.target.value)}
              className="mt-2 min-h-[100px] w-full resize-none rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2.5 text-[15px] outline-none focus:border-[var(--app-primary)]"
              placeholder="请说明需要重办的具体原因..."
              required
            />
          </div>

          {/* 提示信息 */}
          <div className="rounded-[10px] border border-orange-200 bg-orange-50 px-3 py-2.5 text-[13px] text-orange-600 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400">
            重办后任务将退回"待处理"状态，重办人需要重新处理。
            当前已重办 {task.rework_count || 0} 次。
          </div>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-[var(--app-border)] px-5 py-4">
          <button onClick={onClose} disabled={saving} className="h-9 rounded-lg border border-[var(--app-border)] px-4 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)]">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !reworkReason.replace(/<[^>]*>/g, '').trim()}
            className="h-9 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? '提交中...' : '确认重办'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-2.5 text-[15px] font-medium text-[var(--app-muted)] transition-colors hover:text-[var(--app-text)]"
      >
        <span>{title}</span>
        <ChevronDown
          size={18}
          strokeWidth={1.5}
          className={`text-[var(--app-subtle)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && <div className="animate-slideDown">{children}</div>}
    </section>
  );
}
