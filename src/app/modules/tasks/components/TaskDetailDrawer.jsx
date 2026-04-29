import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from '../../../shared/components/Tooltip.jsx';
import {
  ArrowRightLeft,
  BellRing,
  Bold,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  FileText,
  Flag,
  Hash,
  ImagePlus,
  Italic,
  Link2,
  List,
  Maximize2,
  Minimize2,
  PlayCircle,
  RotateCcw,
  Save,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { ReminderModal } from './TaskModals.jsx';
import { api } from '../../../../api.js';
import { DeadlineDisplay, DurationAnalysis, FlowSummary, TaskContentSection } from './TaskDetailViews.jsx';
import { taskDisplayStatus } from '../utils/taskUtils.js';

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
    if (getUserRoles(task, user, sameUser).includes('creator') || sameUser(task.confirmer, user)) {
      return { label: '确认取消', payload: { action: 'confirm_cancel', note: '确认取消任务' } };
    }
    return null;
  }
  if (task.status === 'todo') {
    if (!getUserRoles(task, user, sameUser).includes('owner')) return null;
    return { label: '开始处理', payload: { action: 'change_status', status: 'in_progress', note: '开始处理' } };
  }
  if (task.status === 'in_progress' || task.status === 'overdue') {
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

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function dateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function timeInputValue(value) {
  if (!value) return '23:59';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '23:59';
  return date.toTimeString().slice(0, 5);
}

function DetailPropertyRow({ Icon, label, children }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-4 py-2.5 text-[15px]">
      <div className="flex items-center gap-2 text-[var(--app-muted)]">
        <Icon size={16} strokeWidth={1.5} className="text-[var(--app-subtle)]" />
        <span>{label}</span>
      </div>
      <div className="min-w-0 text-[var(--app-text)]">{children}</div>
    </div>
  );
}

function DetailSurfaceButton({ active, icon: Icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-medium transition-colors ${
        active
          ? 'bg-[var(--app-panel-soft)] text-[var(--app-text)]'
          : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'
      }`}
    >
      <Icon size={14} strokeWidth={1.6} />
      {children}
    </button>
  );
}

function InlineRichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const linkInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    if (!editorRef.current) return;
    if (document.activeElement === editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

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

  function handlePaste(event) {
    const imageFile = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type.startsWith('image/'))
      ?.getAsFile();
    if (!imageFile) return;
    event.preventDefault();
    insertImage(imageFile);
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

  return (
    <div>
      <div className="sticky top-0 z-10 mb-2 flex items-center gap-1 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] p-1 shadow-[var(--shadow-sm)]">
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
            className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
            title={label}
            aria-label={label}
          >
            <Icon size={15} />
          </button>
        ))}
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openLinkEditor}
          className={`grid size-8 place-items-center rounded-[8px] transition ${
            linkOpen ? 'bg-[var(--app-primary-soft)] text-[var(--app-primary)]' : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'
          }`}
          title="插入链接"
          aria-label="插入链接"
        >
          <Link2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
          title="插入图片"
          aria-label="插入图片"
        >
          <ImagePlus size={15} />
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => insertImage(event.target.files?.[0])} />

        {linkOpen && (
          <div className="absolute left-1 top-[calc(100%+8px)] z-50 w-[320px] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] p-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.16)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--app-text)]">
                <span className="grid size-6 place-items-center rounded-[7px] bg-[var(--app-primary-soft)] text-[var(--app-primary)]">
                  <Link2 size={13} />
                </span>
                链接地址
              </div>
              <button type="button" onClick={closeLinkEditor} className="grid size-6 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]" aria-label="关闭链接输入">
                <X size={13} />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-2 transition focus-within:border-[var(--app-primary)]">
              <input
                ref={linkInputRef}
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyLink();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeLinkEditor();
                    editorRef.current?.focus();
                  }
                }}
                placeholder="https://example.com"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--app-subtle)] focus-visible:outline-none"
                autoComplete="off"
              />
              <button type="button" disabled={!linkUrl.trim()} onClick={applyLink} className="grid size-7 place-items-center rounded-[7px] bg-[var(--app-primary)] text-white transition disabled:bg-[var(--app-panel-soft)] disabled:text-[var(--app-subtle)]" aria-label="应用链接">
                <Check size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
      <div
        ref={editorRef}
        className="task-rich-text min-h-[360px] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3 text-[15px] leading-7 outline-none focus:border-[var(--app-primary)]"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="任务内容"
        data-placeholder={placeholder}
        onInput={syncValue}
        onPaste={handlePaste}
      />
    </div>
  );
}

export default function TaskDetailDrawer({
  task,
  open,
  surfaceMode = 'side',
  onSurfaceModeChange,
  meta,
  user,
  onClose,
  onRefresh,
  statusLabels,
  statusTone,
  completedStatusTone,
  flowPendingStatusTone,
  getDeadlineUrgency,
  displayUser,
  sameUser,
  reminderTargetForTask,
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
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showTransferPicker, setShowTransferPicker] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [selectedTransferUser, setSelectedTransferUser] = useState(null);
  const [showReworkDialog, setShowReworkDialog] = useState(false);
  const [reworkReason, setReworkReason] = useState('');
  const [selectedReworkUser, setSelectedReworkUser] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    info: false,
    timeline: true,
    comments: false,
  });
  const [editingDetails, setEditingDetails] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDueTime, setEditDueTime] = useState('23:59');

  useEffect(() => {
    setComment('');
    setShowCancelDialog(false);
    setShowTransferPicker(false);
    setCancelReason('');
    setShowCompletionDialog(false);
    setShowTransferDialog(false);
    setShowReworkDialog(false);
    setCompletionNote('');
    setTransferNote('');
    setReworkReason('');
    setSelectedTransferUser(null);
    setSelectedReworkUser(null);
    setExpandedSections({ info: false, timeline: true, comments: false });
    setEditingDetails(false);
    setEditTitle(task?.title || '');
    setEditDescription(task?.description || '');
    setEditDueDate(dateInputValue(task?.due_at));
    setEditDueTime(timeInputValue(task?.due_at));
  }, [task?.id, task?.due_at, task?.title, task?.description]);

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
        if (editingDetails) {
          cancelEditDetails();
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
  }, [open, showCompletionDialog, showTransferDialog, showCancelDialog, showTransferPicker, editingDetails, onClose]);

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
  const canHandleCancelDecision = isCreator || sameUser(task?.confirmer, user);
  const isContentLocked = task?.is_limited_view;
  const taskIsOverdue = task ? isTaskOverdue(task) : false;
  const isCancelPending = task?.status === 'cancel_pending';
  const needsCompletionNote = primaryAction?.payload?.action === 'confirm_complete' && task?.status === 'in_progress';

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

  async function handleRemind(_, remark) {
    if (!remark?.trim()) return;
    setSaving(true);
    try {
      await api.remindTask(task.id, { remark });
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

  function startEditDetails() {
    setEditTitle(task?.title || '');
    setEditDescription(task?.description || '');
    setEditDueDate(dateInputValue(task?.due_at));
    setEditDueTime(timeInputValue(task?.due_at));
    setEditingDetails(true);
  }

  function cancelEditDetails() {
    setEditTitle(task?.title || '');
    setEditDescription(task?.description || '');
    setEditDueDate(dateInputValue(task?.due_at));
    setEditDueTime(timeInputValue(task?.due_at));
    setEditingDetails(false);
  }

  async function saveTaskDetails() {
    const title = editTitle.trim();
    if (!task || !title) return;
    const dueAt = editDueDate ? new Date(`${editDueDate}T${editDueTime || '23:59'}:00`).toISOString() : null;
    setSaving(true);
    try {
      await api.patchTask(task.id, {
        title,
        description: editDescription,
        due_at: dueAt,
        note: '更新任务详情',
      });
      setEditingDetails(false);
      await onRefresh(task.id);
    } finally {
      setSaving(false);
    }
  }

  const canEditDetails = isCreator && !isClosed && !isContentLocked;
  const displayStatus = taskDisplayStatus(task);
  const ownerText = task?.assignments?.length > 1
    ? task.assignments.map((assignment) => `${displayUser(assignment.assignee)} ${statusLabels[assignment.status] || assignment.status}`).join(' / ')
    : task?.owner
    ? displayUser(task.owner)
    : task?.candidate_owners?.length > 0
      ? task.candidate_owners.map(displayUser).join(' / ')
      : '空白';
  const statusBadge = task ? (
    <Badge className={badgeClass(statusTone, taskIsOverdue ? 'overdue' : displayStatus)}>
      {statusLabels[displayStatus] || statusLabels[task.status]}
    </Badge>
  ) : null;
  const priorityText = task?.priority === 'high' ? '高优先' : task?.priority_label || '普通';

  const actionBar = task && !isClosed && !isContentLocked ? (
    <div className="mt-8 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-3">
      {isCancelPending ? (
        <div className="flex flex-wrap gap-2">
          <Tooltip content={!canHandleCancelDecision ? '只有创建人或确认人可以确认取消' : null}>
            <button
              disabled={saving || !canHandleCancelDecision}
              type="button"
              onClick={() => runAction({ action: 'confirm_cancel', note: '确认取消' })}
              className={`inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                canHandleCancelDecision ? 'bg-red-500 text-white hover:bg-red-600' : 'border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
              }`}
            >
              <XCircle size={15} strokeWidth={1.6} />
              {saving ? '处理中...' : '确认取消'}
            </button>
          </Tooltip>
          <Tooltip content={!canHandleCancelDecision ? '只有创建人或确认人可以拒绝取消' : null}>
            <button
              disabled={saving || !canHandleCancelDecision}
              type="button"
              onClick={() => runAction({ action: 'reject_cancel', note: '拒绝取消，继续执行' })}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-emerald-200 bg-emerald-50 px-3 text-[13px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
              <PlayCircle size={15} strokeWidth={1.6} />
              拒绝取消
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content={!primaryAction ? (task.status === 'confirming' ? '只有确认人可以操作' : '只有责任人可以操作') : null}>
            <button
              disabled={saving || !primaryAction}
              type="button"
              onClick={handlePrimaryAction}
              className={`inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                primaryAction ? 'bg-[var(--app-primary)] text-white hover:bg-[var(--app-primary-strong)]' : 'bg-[#E5E7EB] text-[var(--app-muted)] dark:bg-[#3A3A3A]'
              }`}
            >
              {primaryAction?.label === '开始处理' ? <PlayCircle size={15} strokeWidth={1.6} /> : <CheckCircle2 size={15} strokeWidth={1.6} />}
              {saving ? '处理中...' : primaryAction?.label || (task.status === 'confirming' ? '确认' : '确认完成')}
            </button>
          </Tooltip>

          <Tooltip content={!canPerformAction(task, 'transfer') ? '只有创建人或责任人可以转派' : null}>
            <div className="relative">
              <button
                disabled={saving || !canPerformAction(task, 'transfer')}
                type="button"
                onClick={() => canPerformAction(task, 'transfer') && setShowTransferPicker((value) => !value)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  canPerformAction(task, 'transfer')
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
                }`}
              >
                <ArrowRightLeft size={15} strokeWidth={1.6} />
                转派
              </button>
              {showTransferPicker && canPerformAction(task, 'transfer') && (
                <div className="absolute left-0 top-11 z-20 min-w-[200px] rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-2 shadow-[var(--app-shadow)] animate-slideDown">
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
                setShowReminderModal(true);
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                canRemindTask(task, user).can
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
              }`}
            >
              <BellRing size={15} strokeWidth={1.6} />
              催办
            </button>
          </Tooltip>

          <Tooltip content={!canPerformAction(task, 'cancel') ? '只有创建人或责任人可以取消' : null}>
            <button
              disabled={saving || !canPerformAction(task, 'cancel')}
              type="button"
              onClick={() => setShowCancelDialog(true)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                canPerformAction(task, 'cancel')
                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
                  : 'border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
              }`}
            >
              <XCircle size={15} strokeWidth={1.6} />
              取消
            </button>
          </Tooltip>

          {task.status === 'confirming' && canPerformAction(task, 'rework') && (
            <Tooltip content={!canPerformAction(task, 'rework') ? '只有确认人可以重办' : null}>
              <button
                disabled={saving}
                type="button"
                onClick={() => setShowReworkDialog(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-orange-200 bg-orange-50 px-3 text-[13px] font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300"
              >
                <RotateCcw size={15} strokeWidth={1.6} />
                重办
              </button>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  ) : isContentLocked && primaryAction ? (
    <div className="mt-8">
      <button
        disabled={saving}
        type="button"
        onClick={() => runAction(primaryAction.payload)}
        className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[var(--app-primary)] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--app-primary-strong)] disabled:opacity-60"
      >
        <PlayCircle size={15} strokeWidth={1.6} />
        {saving ? '处理中...' : primaryAction.label}
      </button>
    </div>
  ) : null;

  const detailBody = task ? (
    <div className="mx-auto w-full max-w-[760px] px-10 py-8">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.03em] text-[var(--app-subtle)]">
        <span>{task.code}</span>
        <span className="size-1 rounded-full bg-[var(--app-subtle)]" />
        <span>{formatRelativeTime(task.updated_at)}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        {editingDetails ? (
          <input
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            className="min-h-[56px] min-w-0 flex-1 bg-transparent text-[34px] font-semibold leading-tight text-[var(--app-text)] outline-none placeholder:text-[var(--app-subtle)] focus-visible:outline-none"
            placeholder="任务标题"
            autoComplete="off"
          />
        ) : (
          <h1 className="min-w-0 flex-1 text-[34px] font-semibold leading-tight text-[var(--app-text)]">{task.title}</h1>
        )}

        {canEditDetails && !editingDetails && (
          <button
            type="button"
            onClick={startEditDetails}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] bg-[var(--app-panel-soft)] px-3 text-[13px] font-semibold text-[var(--app-muted)] transition-colors hover:text-[var(--app-text)]"
          >
            <Edit3 size={15} strokeWidth={1.6} />
            编辑
          </button>
        )}
      </div>

      {editingDetails && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveTaskDetails}
            disabled={saving || !editTitle.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[var(--app-primary)] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--app-primary-strong)] disabled:opacity-50"
          >
            <Save size={15} strokeWidth={1.6} />
            {saving ? '保存中...' : '保存详情'}
          </button>
          <button
            type="button"
            onClick={cancelEditDetails}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 text-[13px] font-semibold text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)] disabled:opacity-50"
          >
            <X size={15} strokeWidth={1.6} />
            取消
          </button>
        </div>
      )}

      <div className="mt-7 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3">
        <DetailPropertyRow Icon={User} label="创建人">
          <span className="font-medium">{displayUser(task.creator)}</span>
        </DetailPropertyRow>
        <DetailPropertyRow Icon={User} label="负责人">
          <span>{ownerText}</span>
        </DetailPropertyRow>
        <DetailPropertyRow Icon={CheckCircle2} label="状态">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge}
            {task.reminder_count > 0 && !isClosed && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[13px] font-medium text-orange-600 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400">
                <BellRing size={14} strokeWidth={1.5} />
                催办 {task.reminder_count} 次
              </span>
            )}
            {task.rework_count > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[13px] font-medium text-orange-600 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400">
                <RotateCcw size={14} strokeWidth={1.5} />
                重办 {task.rework_count} 次
              </span>
            )}
          </div>
        </DetailPropertyRow>
        <DetailPropertyRow Icon={Clock} label="创建时间">
          <span>{formatFullDateTime(task.created_at)}</span>
        </DetailPropertyRow>
        <DetailPropertyRow Icon={Calendar} label="截止时间">
          {editingDetails ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={editDueDate}
                onChange={(event) => setEditDueDate(event.target.value)}
                className="h-9 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[14px] outline-none focus:border-[var(--app-primary)]"
              />
              <input
                type="time"
                value={editDueTime}
                onChange={(event) => setEditDueTime(event.target.value)}
                disabled={!editDueDate}
                className="h-9 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[14px] outline-none focus:border-[var(--app-primary)] disabled:opacity-50"
              />
              <button type="button" onClick={() => setEditDueDate('')} className="h-9 rounded-[8px] px-2.5 text-[13px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]">
                清除
              </button>
            </div>
          ) : task.due_at ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>{formatFullDateTime(task.due_at)}</span>
              {taskIsOverdue && <DeadlineDisplay dueAt={task.due_at} isOverdue={task.is_overdue} getDeadlineUrgency={getDeadlineUrgency} />}
            </div>
          ) : (
            <span className="text-[var(--app-subtle)]">空白</span>
          )}
        </DetailPropertyRow>
        <DetailPropertyRow Icon={Flag} label="优先级">
          <span className={task.priority === 'high' && !isClosed ? 'text-red-500' : ''}>{priorityText}</span>
        </DetailPropertyRow>
        <DetailPropertyRow Icon={Hash} label="部门">
          <span>{task.department?.name || '空白'}</span>
        </DetailPropertyRow>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-[var(--app-muted)]">
          <FileText size={16} strokeWidth={1.5} />
          任务内容
        </div>
        {editingDetails ? (
          <InlineRichTextEditor value={editDescription} onChange={setEditDescription} placeholder="输入任务内容，支持富文本和图片。" />
        ) : isContentLocked ? (
          <TaskContentSection task={task} isLocked={isContentLocked} />
        ) : task.description ? (
          <div className="task-rich-content task-detail-content min-h-[360px] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-bg)] px-5 py-4 text-[15px] leading-7 text-[var(--app-text)]" dangerouslySetInnerHTML={{ __html: task.description }} />
        ) : (
          <div className="min-h-[220px] rounded-[12px] border border-dashed border-[var(--app-border)] bg-[var(--app-bg)] px-5 py-4 text-[15px] text-[var(--app-muted)]">暂无详细内容。</div>
        )}
      </section>

      {actionBar}

      {(isCancelPending || task.status === 'cancelled') && task.cancel_reason && (
        <div className="mt-5 rounded-[12px] border border-yellow-200 bg-yellow-50 p-4 text-[15px] dark:border-yellow-900 dark:bg-yellow-950">
          <div className="text-[13px] font-medium text-yellow-600 dark:text-yellow-400">取消原因</div>
          <div className="mt-2 text-yellow-700 dark:text-yellow-300">{task.cancel_reason}</div>
        </div>
      )}

      <div className="mt-8 border-t border-[var(--app-border)] pt-4">
        <CollapsibleSection key={`${task.id}-timeline`} title="流转记录" defaultOpen={expandedSections.timeline}>
          <FlowSummary
            task={task}
            records={task.events || []}
            Badge={Badge}
            badgeClass={badgeClass}
            displayUser={displayUser}
            formatActivityTime={formatActivityTime}
            formatDateTime={formatDateTime}
            statusLabels={statusLabels}
            completedStatusTone={completedStatusTone}
            flowPendingStatusTone={flowPendingStatusTone}
          />
        </CollapsibleSection>

        <CollapsibleSection title="任务信息" defaultOpen={expandedSections.info}>
          <div className="grid grid-cols-2 gap-2.5 text-[15px]">
            {[
              ['当前耗时', formatDurationHours(task.current_duration_hours)],
              ['处理时间', formatDurationHours(task.processing_duration_hours)],
              ['创建时间', formatFullDateTime(task.created_at)],
              ['更新时间', formatFullDateTime(task.updated_at)],
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
  );

  const modalContent = task ? (
    <>
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

      <ReminderModal
        open={showReminderModal}
        task={task}
        onClose={() => setShowReminderModal(false)}
        onSubmit={handleRemind}
        reminderTargetForTask={reminderTargetForTask}
        displayUser={displayUser}
        formatFullDateTime={formatFullDateTime}
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
    </>
  ) : null;

  const shell = (
    <section
      className={`flex max-h-full flex-col overflow-hidden bg-[var(--app-panel)] ${
        surfaceMode === 'modal'
          ? 'relative h-[min(92vh,920px)] w-[min(980px,calc(100vw-48px))] rounded-[18px] border border-[var(--app-border)] shadow-[0_24px_80px_rgba(0,0,0,0.26)]'
          : `fixed inset-y-0 right-0 z-20 w-[min(clamp(640px,58vw,860px),calc(100vw-300px))] shadow-[-18px_0_38px_rgba(17,24,39,0.10)] transition-transform duration-300 dark:shadow-[-18px_0_38px_rgba(0,0,0,0.35)] ${open ? 'translate-x-0' : 'translate-x-full'}`
      }`}
      onMouseDown={(event) => event.stopPropagation()}
      aria-hidden={!open}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--app-border)] px-4">
        <div className="flex items-center gap-1 rounded-[9px] bg-[var(--app-bg)] p-1">
          <DetailSurfaceButton active={surfaceMode === 'side'} icon={Minimize2} onClick={() => onSurfaceModeChange?.('side')}>
            侧页
          </DetailSurfaceButton>
          <DetailSurfaceButton active={surfaceMode === 'modal'} icon={Maximize2} onClick={() => onSurfaceModeChange?.('modal')}>
            弹窗
          </DetailSurfaceButton>
        </div>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition-all duration-200 hover:bg-[var(--app-panel-soft)]" aria-label="关闭详情">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{detailBody}</div>
      {modalContent}
    </section>
  );

  if (surfaceMode === 'modal') {
    return createPortal(
      <div className="fixed inset-0 z-30 grid place-items-center bg-black/25 px-6 py-6 backdrop-blur-[1px]" onMouseDown={onClose}>
        {shell}
      </div>,
      document.body
    );
  }

  return shell;
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
