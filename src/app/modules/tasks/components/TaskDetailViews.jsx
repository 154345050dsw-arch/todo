import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Clock, Lock, X } from 'lucide-react';

export function FlowSummary({
  task,
  records,
  onRemind,
  user,
  Badge,
  badgeClass,
  displayUser,
  formatActivityTime,
  formatDateTime,
  statusLabels,
  completedStatusTone,
  flowPendingStatusTone,
  RemindActionButton,
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const flow = useMemo(
    () => buildFlowModel(records, task, { displayUser, statusLabels }),
    [records, task, displayUser, statusLabels]
  );
  const flowStatusTone = useMemo(
    () => ({
      created: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
      todo: flowPendingStatusTone,
      in_progress: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
      confirming: flowPendingStatusTone,
      done: completedStatusTone,
      cancel_pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
      cancelled: 'border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-500/20 dark:bg-stone-500/10 dark:text-stone-300',
      overdue: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
    }),
    [completedStatusTone, flowPendingStatusTone]
  );

  if (!flow.items.length) {
    return <div className="rounded-[14px] border border-dashed border-[var(--app-border)] bg-white p-4 text-[15px] text-[var(--app-muted)] shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:bg-[var(--app-bg)]">暂无流转记录。</div>;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge className={badgeClass(flowStatusTone, flow.currentStatus)}>{flow.currentStatusLabel}</Badge>
            <span className="truncate text-[13px] text-[var(--app-muted)]">
              {flow.currentPerson.label}：<span className="font-medium text-[var(--app-text)]">{displayUser(flow.currentPerson.user) || '-'}</span>
            </span>
            <span className="text-[13px] text-[var(--app-muted)]">
              总耗时：<span className="font-medium text-[var(--app-text)]">{flow.totalText}</span>
            </span>
            {task?.reminder_count > 0 && (
              <span className="text-[13px] text-[var(--app-muted)]">
                已催办 <span className="font-medium text-[var(--app-text)]">{task.reminder_count}</span> 次
                {task.latest_reminder_at ? ` · 最近 ${formatActivityTime(task.latest_reminder_at)}` : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 text-[13px] font-medium text-[var(--app-text)] transition-all hover:border-[var(--app-primary)]/30 hover:text-[var(--app-primary)] hover:shadow-[var(--shadow-sm)]"
          >
            查看轨迹
            <ChevronRight size={14} strokeWidth={1.7} />
          </button>
        </div>
        <FlowTimeline flow={flow} Badge={Badge} badgeClass={badgeClass} displayUser={displayUser} formatDateTime={formatDateTime} flowStatusTone={flowStatusTone} />
      </div>

      <FlowDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        task={task}
        flow={flow}
        onRemind={onRemind}
        user={user}
        displayUser={displayUser}
        formatActivityTime={formatActivityTime}
        formatDateTime={formatDateTime}
        RemindActionButton={RemindActionButton}
      />
    </>
  );
}

export function DurationAnalysis({ data }) {
  const rows = [
    ['负责人', data?.owner || []],
    ['部门', data?.department || []],
    ['状态', data?.status || []],
  ];

  return (
    <div className="space-y-3 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-3">
      {rows.map(([label, items]) => (
        <div key={label} className="space-y-1.5">
          <div className="text-xs font-medium text-[var(--app-muted)]">{label}停留</div>
          {(items.length ? items : [{ label: '-', hours: 0, percent: 0 }]).slice(0, 3).map((item) => {
            const minutes = Math.round(item.hours * 60);
            return (
              <div key={`${label}-${item.label}`}>
                <div className="mb-0.5 flex justify-between text-xs text-[var(--app-muted)]">
                  <span>{item.label}</span>
                  <span className="font-medium">{minutes}分钟</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--app-border)]">
                  <div className="h-1.5 rounded-full bg-[var(--app-primary)]" style={{ width: `${item.percent || 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function DeadlineDisplay({ dueAt, isOverdue, getDeadlineUrgency }) {
  const urgency = getDeadlineUrgency(dueAt, isOverdue);

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 ${urgency.className}`}>
      <Clock size={16} strokeWidth={1.5} />
      <span className="text-[15px] font-medium">{urgency.text}</span>
    </div>
  );
}

export function TaskContentSection({ task, isLocked }) {
  if (isLocked) {
    return (
      <div className="rounded-xl border border-[var(--app-border)] bg-gradient-to-b from-[var(--app-panel-soft)] to-[var(--app-bg)] p-10 text-center">
        <div className="mb-5 flex justify-center">
          <div className="relative">
            <div className="grid size-14 place-items-center rounded-full bg-[var(--app-panel-soft)]">
              <Lock size={26} strokeWidth={1.5} className="text-[var(--app-subtle)]" />
            </div>
          </div>
        </div>
        <p className="mb-2 text-[15px] text-[var(--app-muted)]">
          任务详细内容在开始处理后可见
        </p>
        <p className="text-[13px] text-[var(--app-subtle)]">
          点击下方「开始处理」按钮解锁内容
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-5">
      {task.description ? (
        <div className="task-rich-content task-detail-content text-[15px] leading-7 text-[var(--app-text)]" dangerouslySetInnerHTML={{ __html: task.description }} />
      ) : (
        <p className="text-[15px] text-[var(--app-muted)]">暂无详细内容。</p>
      )}
    </div>
  );
}

const flowRoleLabels = {
  created: '创建人',
  todo: '责任人',
  in_progress: '责任人',
  confirming: '责任人',
  done: '责任人',
  cancel_pending: '责任人',
  cancelled: '责任人',
  overdue: '责任人',
};

function sameFlowUser(left, right, displayUser) {
  if (!left || !right) return false;
  if (left.id && right.id) return left.id === right.id;
  return displayUser(left) && displayUser(left) === displayUser(right);
}

function flowUser(record, key) {
  if (!record) return null;
  if (key === 'from') return record.from_user || record.from_owner || null;
  if (key === 'to') return record.to_user || record.to_owner || null;
  return record.actor || record.user || record.to_user || record.to_owner || record.from_user || record.from_owner || null;
}

function flowDurationMinutes(record) {
  const minutes = record?.duration_minutes ?? Math.round((record?.duration_until_next_hours || 0) * 60);
  return Number.isFinite(minutes) ? Math.max(minutes, 0) : 0;
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

function flowActionMeta(record, status, fromUser, toUser, { displayUser, statusLabels }) {
  const raw = String(record?.action_text || record?.action || record?.note || record?.label || record?.event_type || '').trim();
  const lower = raw.toLowerCase();
  const transfer = fromUser && toUser && !sameFlowUser(fromUser, toUser, displayUser);

  if (record?.event_type === 'remind' || raw.includes('催办')) {
    const confirm = raw.includes('确认');
    return { label: confirm ? '催确认' : '催办处理', edgeLabel: confirm ? '催确认' : '催办', known: true, raw };
  }
  if (record?.event_type === 'created' || lower.includes('create') || raw.includes('创建')) {
    return { label: '创建任务', edgeLabel: '创建任务', known: true };
  }
  if (transfer || lower.includes('transfer') || raw.includes('转派')) {
    return { label: '转派任务', edgeLabel: '转派', known: true };
  }
  if (status === 'confirming' || lower.includes('confirm_complete') || raw.includes('提交确认') || raw.includes('发起完成')) {
    return { label: status === 'done' ? '确认完成' : '发起完成确认', edgeLabel: status === 'done' ? '确认完成' : '发起完成确认', known: true };
  }
  if (status === 'done' || lower.includes('complete') || raw.includes('确认完成') || raw.includes('已完成')) {
    return { label: '确认完成', edgeLabel: '确认完成', known: true };
  }
  if (status === 'cancel_pending' || lower.includes('apply_cancel') || raw.includes('申请取消') || raw.includes('发起取消')) {
    return { label: '发起取消', edgeLabel: '发起取消', known: true };
  }
  if (status === 'cancelled' || lower.includes('confirm_cancel') || raw.includes('确认取消') || raw.includes('取消')) {
    return { label: '确认取消', edgeLabel: '确认取消', known: true };
  }
  if (status === 'in_progress' || lower.includes('start') || lower.includes('claim_task') || raw.includes('开始处理')) {
    return { label: '开始处理', edgeLabel: '开始处理', known: true };
  }

  return { label: statusLabels[status] || raw || '状态更新', edgeLabel: raw || statusLabels[status] || '状态更新', known: false, raw };
}

function currentFlowPerson(task, lastItem) {
  const status = task?.status || lastItem?.status;
  if (status === 'confirming' || status === 'cancel_pending') {
    return { label: status === 'confirming' ? '待确认人' : '确认人', user: task?.confirmer || task?.creator || task?.owner || lastItem?.person };
  }
  if (status === 'done') {
    return { label: '完成人', user: lastItem?.record?.actor || task?.owner || lastItem?.person };
  }
  if (status === 'cancelled') {
    return { label: '取消人', user: lastItem?.record?.actor || lastItem?.person };
  }
  return { label: '当前责任人', user: task?.owner || lastItem?.person || task?.creator };
}

function buildFlowModel(records = [], task, helpers) {
  const { displayUser, statusLabels } = helpers;
  const items = records.map((record, index) => {
    const fromUser = flowUser(record, 'from');
    const toUser = flowUser(record, 'to');
    const status = record.event_type === 'created' && index === 0
      ? 'created'
      : record.status || record.to_status || task?.status || 'todo';
    const statusLabel = record.title || (status === 'created' ? '创建' : statusLabels[status]) || status;
    const person = flowUser(record) || task?.owner || task?.creator;
    const durationMinutes = flowDurationMinutes(record);
    const action = flowActionMeta(record, status, fromUser, toUser, { displayUser, statusLabels });
    const isTransfer = record.event_type === 'owner' || Boolean(fromUser && toUser && !sameFlowUser(fromUser, toUser, displayUser));

    return {
      id: record.id || `${record.created_at || 'record'}-${index}`,
      index,
      record,
      status,
      statusLabel,
      person,
      fromUser,
      toUser,
      isTransfer,
      roleLabel: flowRoleLabels[status] || '责任人',
      actionLabel: action.label,
      edgeLabel: action.edgeLabel,
      actionKnown: action.known,
      rawAction: action.raw || record.action || record.action_text || record.note || record.label || record.event_type || '',
      note: record.note,
      createdAt: record.created_at,
      durationMinutes,
      durationText: formatFlowDuration(durationMinutes),
    };
  });

  const lastItem = items[items.length - 1];
  const currentStatus = task?.status || lastItem?.status || 'todo';
  const currentStatusLabel = statusLabels[currentStatus] || lastItem?.statusLabel || '-';
  const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const longest = items.reduce((winner, item) => item.durationMinutes > (winner?.durationMinutes || 0) ? item : winner, null);

  return {
    items,
    currentStatus,
    currentStatusLabel,
    totalText: formatFlowDuration(totalMinutes),
    longestText: longest?.durationMinutes > 0 ? `${longest.statusLabel} ${formatFlowDuration(longest.durationMinutes)}` : '暂无明显停留',
    longest,
    closed: ['done', 'cancelled'].includes(currentStatus),
    currentPerson: currentFlowPerson(task, lastItem),
  };
}

function flowPersonKey(user, displayUser) {
  if (!user) return 'unknown';
  return user.id ? `id:${user.id}` : `name:${displayUser(user) || 'unknown'}`;
}

function compactStatusTrail(items) {
  const labels = [];
  items.forEach((item) => {
    if (item.statusLabel && labels[labels.length - 1] !== item.statusLabel) {
      labels.push(item.statusLabel);
    }
  });
  return labels;
}

function compactNodeStatusEntries(items, formatDateTime) {
  const entries = [];
  items.forEach((item) => {
    const label = item.roleLabel && item.statusLabel ? `${item.roleLabel} · ${item.statusLabel}` : item.statusLabel;
    const previous = entries[entries.length - 1];

    if (previous?.label === label) {
      previous.time = formatDateTime(item.createdAt);
      previous.item = item;
      return;
    }

    entries.push({
      id: `${item.id}-status-${entries.length}`,
      label,
      time: formatDateTime(item.createdAt),
      item,
    });
  });
  return entries;
}

function buildFlowActorGraph(flow, { displayUser, formatDateTime }) {
  const nodes = [];
  const nodeByPerson = new Map();
  const edgeByRoute = new Map();
  let previousNode = null;
  let lastRealNodeId = null;

  const addNodeForItem = (item) => {
    const key = flowPersonKey(item.person, displayUser);
    const existing = nodeByPerson.get(key);

    if (existing) {
      existing.items.push(item);
      existing.lastItem = item;
      existing.statusTrail = compactStatusTrail(existing.items);
      existing.statusEntries = compactNodeStatusEntries(existing.items, formatDateTime);
      existing.durationMinutes += item.durationMinutes;
      existing.durationText = formatFlowDuration(existing.durationMinutes);
      return existing;
    }

    const node = {
      id: `actor-${item.id}`,
      person: item.person,
      personKey: key,
      items: [item],
      entryItem: item,
      lastItem: item,
      statusTrail: [item.statusLabel],
      statusEntries: compactNodeStatusEntries([item], formatDateTime),
      durationMinutes: item.durationMinutes,
      durationText: item.durationText,
      isPlaceholder: false,
    };

    nodes.push(node);
    nodeByPerson.set(key, node);
    return node;
  };

  const addEdge = (fromNode, toNode, item, isPlaceholder = false) => {
    if (!fromNode || !toNode || fromNode.id === toNode.id) return;

    const label = isPlaceholder ? '待完成' : item?.edgeLabel || item?.actionLabel || '流转';
    const routeKey = `${fromNode.id}->${toNode.id}->${label}`;
    const durationMinutes = isPlaceholder ? 0 : item?.durationMinutes || 0;
    const existing = edgeByRoute.get(routeKey);

    if (existing) {
      existing.count += 1;
      existing.durationMinutes += durationMinutes;
      existing.durationText = formatFlowDuration(existing.durationMinutes);
      existing.long = existing.durationMinutes >= 120;
      existing.item = item || existing.item;
      return;
    }

    edgeByRoute.set(routeKey, {
      id: `edge-${fromNode.id}-${toNode.id}-${edgeByRoute.size}`,
      fromId: fromNode.id,
      toId: toNode.id,
      label,
      durationMinutes,
      durationText: formatFlowDuration(durationMinutes),
      long: durationMinutes >= 120,
      dashed: isPlaceholder,
      count: 1,
      item,
    });
  };

  flow.items.forEach((item) => {
    if (item.isTransfer && item.record?.to_owner) {
      const actorPerson = item.record.actor || item.person;
      const actorKey = flowPersonKey(actorPerson, displayUser);
      const actorExists = nodeByPerson.has(actorKey);
      let actorNode = nodeByPerson.get(actorKey);

      if (!actorNode) {
        actorNode = {
          id: `actor-${item.id}-from`,
          person: actorPerson,
          personKey: actorKey,
          items: [],
          entryItem: item,
          lastItem: item,
          statusTrail: [],
          statusEntries: [],
          durationMinutes: 0,
          durationText: '少于1分钟',
          isPlaceholder: false,
        };
        nodes.push(actorNode);
        nodeByPerson.set(actorKey, actorNode);
      }

      if (previousNode && !actorExists) {
        addEdge(previousNode, actorNode, item);
      }

      const toPerson = item.record.to_owner;
      const toKey = flowPersonKey(toPerson, displayUser);
      let toNode = nodeByPerson.get(toKey);

      if (!toNode) {
        toNode = {
          id: `actor-${item.id}-to`,
          person: toPerson,
          personKey: toKey,
          items: [item],
          entryItem: item,
          lastItem: item,
          statusTrail: [item.statusLabel],
          statusEntries: compactNodeStatusEntries([item], formatDateTime),
          durationMinutes: item.durationMinutes,
          durationText: item.durationText,
          isPlaceholder: false,
        };
        nodes.push(toNode);
        nodeByPerson.set(toKey, toNode);
      } else {
        toNode.items.push(item);
        toNode.lastItem = item;
        toNode.statusTrail = compactStatusTrail(toNode.items);
        toNode.statusEntries = compactNodeStatusEntries(toNode.items, formatDateTime);
        toNode.durationMinutes += item.durationMinutes;
        toNode.durationText = formatFlowDuration(toNode.durationMinutes);
      }

      addEdge(actorNode, toNode, item);
      previousNode = toNode;
      lastRealNodeId = toNode.id;
    } else {
      const node = addNodeForItem(item);
      addEdge(previousNode, node, item);
      previousNode = node;
      lastRealNodeId = node.id;
    }
  });

  if (!flow.closed && nodes.length) {
    const placeholder = {
      id: 'pending-end',
      person: null,
      personKey: 'pending-end',
      items: [],
      entryItem: null,
      lastItem: null,
      statusTrail: ['待完成'],
      statusEntries: [{ id: 'pending-end-status', label: '待完成', time: '未完成' }],
      durationMinutes: 0,
      durationText: '少于1分钟',
      isPlaceholder: true,
    };
    nodes.push(placeholder);
    addEdge(previousNode, placeholder, null, true);
  }

  return { nodes, edges: Array.from(edgeByRoute.values()), lastRealNodeId };
}

function flowTrackMeta(flow, displayUser) {
  const peopleCount = new Set(buildFlowActorGraph(flow, {
    displayUser,
    formatDateTime: () => '',
  }).nodes.filter((node) => !node.isPlaceholder).map((node) => node.personKey)).size;
  const transferCount = flow.items.filter((item) => item.isTransfer).length;
  const creator = flow.items.find((item) => item.status === 'created')?.person || flow.items[0]?.person;
  const creatorName = displayUser(creator) || '-';
  const currentPersonName = displayUser(flow.currentPerson.user) || '-';

  return {
    summary: `共 ${peopleCount} 位责任人 · 创建人：${creatorName} · ${transferCount} 次转派 · 总耗时 ${flow.totalText} · ${flow.currentStatusLabel} · ${flow.currentPerson.label}：${currentPersonName}`,
    longestText: flow.longestText,
  };
}

function FlowDetailModal({
  open,
  onClose,
  task,
  flow,
  onRemind,
  user,
  displayUser,
  formatActivityTime,
  formatDateTime,
  RemindActionButton,
}) {
  const trackMeta = useMemo(() => flowTrackMeta(flow, displayUser), [flow, displayUser]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/35 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[86vh] w-[min(1180px,calc(100vw-32px))] flex-col overflow-hidden rounded-[18px] border border-[var(--app-border)] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)] dark:bg-[var(--app-panel)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-5 border-b border-[var(--app-border)] px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold text-[var(--app-text)]">处理轨迹</h2>
            <p className="mt-1 text-[14px] text-[var(--app-muted)]">任务从创建到当前状态的完整流转路径</p>
            <p className="mt-2 text-[13px] text-[var(--app-muted)]">{trackMeta.summary}</p>
          </div>
          <div className="flex shrink-0 items-start gap-3">
            <div className="mt-0.5 rounded-full border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1.5 text-[12px] text-[var(--app-muted)]">
              最长停留：{trackMeta.longestText}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-[10px] text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label="关闭处理轨迹"
            >
              <X size={18} strokeWidth={1.7} />
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <FlowCanvas flow={flow} task={task} onRemind={onRemind} user={user} displayUser={displayUser} formatActivityTime={formatActivityTime} formatDateTime={formatDateTime} RemindActionButton={RemindActionButton} />
          <ReminderDetailList reminders={task?.reminders || []} displayUser={displayUser} formatDateTime={formatDateTime} />
        </div>
      </div>
    </div>,
    document.body
  );
}

function ReminderDetailList({ reminders, displayUser, formatDateTime }) {
  if (!reminders.length) return null;

  return (
    <div className="mt-5 rounded-[14px] border border-[var(--app-border)] bg-[var(--app-bg)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[var(--app-text)]">催办明细</h3>
        <span className="rounded-full bg-[var(--app-panel-soft)] px-2 py-0.5 text-[12px] font-medium text-[var(--app-muted)]">{reminders.length}</span>
      </div>
      <div className="mt-3 divide-y divide-[var(--app-border)]">
        {reminders.map((reminder) => (
          <div key={reminder.id} className="grid grid-cols-[1fr_auto] gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[14px] text-[var(--app-text)]">
                <span className="font-medium">{displayUser(reminder.from_user)}</span>
                <span className="text-[var(--app-muted)]">催办</span>
                <span className="font-medium">{displayUser(reminder.to_user)}</span>
                <span className="text-[var(--app-muted)]">{reminder.remind_type_label}</span>
              </div>
              {reminder.remark && <div className="mt-1 text-[13px] text-[var(--app-muted)]">{reminder.remark}</div>}
            </div>
            <span className="shrink-0 text-[12px] text-[var(--app-subtle)]">{formatDateTime(reminder.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowCanvas({ flow, task, onRemind, user, displayUser, formatActivityTime, formatDateTime, RemindActionButton }) {
  const actorGraph = buildFlowActorGraph(flow, { displayUser, formatDateTime });
  const actorNodes = actorGraph.nodes;
  const actorEdges = actorGraph.edges;

  if (!flow.items.length) {
    return <div className="rounded-[14px] border border-dashed border-[var(--app-border)] p-6 text-[15px] text-[var(--app-muted)]">暂无处理轨迹。</div>;
  }

  const edgeOffsetMap = new Map();
  const edgesByNodePair = new Map();
  actorEdges.forEach((edge) => {
    const key = `${edge.fromId}-${edge.toId}`;
    const list = edgesByNodePair.get(key) || [];
    list.push(edge);
    edgesByNodePair.set(key, list);
  });
  edgesByNodePair.forEach((edges) => {
    edges.forEach((edge, index) => {
      edgeOffsetMap.set(edge.id, index);
    });
  });

  const nodeIndexById = new Map(actorNodes.map((node, index) => [node.id, index]));
  const viewportWidth = 1060;
  const padding = 34;
  const availableWidth = viewportWidth - padding * 2;
  const nodeWidth = 136;
  const gap = 112;
  const nodeHeight = 154;
  const rowGap = 152;
  const rowCapacity = Math.max(1, Math.min(actorNodes.length, Math.floor((availableWidth + gap) / (nodeWidth + gap))));
  const rowCount = Math.max(1, Math.ceil(actorNodes.length / rowCapacity));
  const contentHeight = rowCount * nodeHeight + Math.max(rowCount - 1, 0) * rowGap;
  const canvasHeight = Math.max(360, contentHeight + 128);
  const canvasWidth = viewportWidth;
  const nodeTop = Math.floor((canvasHeight - contentHeight) / 2);
  const avatarSize = 42;
  const offsetStep = 18;
  const positionFor = (index) => {
    const row = Math.floor(index / rowCapacity);
    const indexInRow = index % rowCapacity;
    const rowStart = row * rowCapacity;
    const nodesInRow = Math.min(rowCapacity, actorNodes.length - rowStart);
    const rowWidth = nodesInRow * nodeWidth + Math.max(nodesInRow - 1, 0) * gap;
    const rowLeft = padding + Math.max(0, (availableWidth - rowWidth) / 2);
    const direction = row % 2 === 0 ? 1 : -1;
    const visualColumn = direction === 1 ? indexInRow : nodesInRow - 1 - indexInRow;
    return {
      x: rowLeft + visualColumn * (nodeWidth + gap),
      y: nodeTop + row * (nodeHeight + rowGap),
      row,
    };
  };
  const initialFor = (node) => {
    const name = displayUser(node.person);
    return node.isPlaceholder ? '终' : (name || node.statusTrail[0] || '?').trim().slice(0, 1);
  };

  return (
    <div className="overflow-x-auto rounded-[14px] border border-[var(--app-border)] bg-white dark:bg-[var(--app-panel)]">
      <div className="relative mx-auto" style={{ width: canvasWidth, height: canvasHeight }}>
        <svg className="absolute inset-0 pointer-events-none" width={canvasWidth} height={canvasHeight} aria-hidden="true">
          <defs>
            <marker id="flow-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#9aa7b8" />
            </marker>
          </defs>
          {actorEdges.map((edge) => {
            const fromIndex = nodeIndexById.get(edge.fromId);
            const toIndex = nodeIndexById.get(edge.toId);
            if (fromIndex == null || toIndex == null) return null;

            const from = positionFor(fromIndex);
            const to = positionFor(toIndex);
            const fromCenterX = from.x + nodeWidth / 2;
            const toCenterX = to.x + nodeWidth / 2;
            const edgeTarget = actorNodes[toIndex];
            const longestLabel = Math.max(edge.label.length, edge.durationText.length);
            const labelGap = Math.max(longestLabel * 5.8 + 14, 44);
            const dashed = edge.dashed || edgeTarget?.isPlaceholder;
            const edgeOffset = edgeOffsetMap.get(edge.id) || 0;
            const useDashed = dashed || edgeOffset > 0;
            const yOffset = edgeOffset * offsetStep;

            if (from.row !== to.row) {
              const startX = fromCenterX;
              const startY = from.y + nodeHeight + 4 + yOffset;
              const endX = toCenterX;
              const endY = to.y - 10;
              const midY = (startY + endY) / 2;
              const labelGapY = 20;
              return (
                <g key={edge.id}>
                  <path d={`M ${startX} ${startY} L ${startX} ${midY - labelGapY}`} fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray={useDashed ? '6 5' : undefined} />
                  <path d={`M ${startX} ${midY + labelGapY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`} fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray={useDashed ? '6 5' : undefined} markerEnd="url(#flow-arrow)" />
                  <text x={startX + (edgeOffset > 0 ? edgeOffset * 12 : 0)} y={midY - 5 + yOffset} textAnchor="middle" className="fill-slate-500 text-[11px] font-medium dark:fill-slate-400">
                    <tspan x={startX + (edgeOffset > 0 ? edgeOffset * 12 : 0)}>{edge.label}</tspan>
                    <tspan x={startX + (edgeOffset > 0 ? edgeOffset * 12 : 0)} dy="13" className="fill-slate-400 text-[10px] font-normal dark:fill-slate-500">
                      {edge.durationText}
                    </tspan>
                  </text>
                </g>
              );
            }

            const direction = toCenterX > fromCenterX ? 1 : -1;
            const nonAdjacentReturn = Math.abs(toCenterX - fromCenterX) > nodeWidth + gap + 16;

            if (nonAdjacentReturn) {
              const startX = fromCenterX;
              const endX = toCenterX;
              const startY = from.y + nodeHeight + 4 + yOffset;
              const endY = to.y + nodeHeight + 4;
              const routeY = from.y + nodeHeight + 44 + yOffset;
              const midX = (startX + endX) / 2;
              const safeLabelGap = Math.min(labelGap, Math.max(36, (Math.abs(endX - startX) - 18) / 2));
              return (
                <g key={edge.id}>
                  <path d={`M ${startX} ${startY} L ${startX} ${routeY} L ${midX - direction * safeLabelGap} ${routeY}`} fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray={useDashed ? '6 5' : undefined} />
                  <path d={`M ${midX + direction * safeLabelGap} ${routeY} L ${endX} ${routeY} L ${endX} ${endY}`} fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray={useDashed ? '6 5' : undefined} markerEnd="url(#flow-arrow)" />
                  <text x={midX} y={routeY - 5} textAnchor="middle" className="fill-slate-500 text-[11px] font-medium dark:fill-slate-400">
                    <tspan x={midX}>{edge.label}</tspan>
                    <tspan x={midX} dy="13" className="fill-slate-400 text-[10px] font-normal dark:fill-slate-500">
                      {edge.durationText}
                    </tspan>
                  </text>
                </g>
              );
            }

            const startX = fromCenterX + direction * (avatarSize / 2 + 10);
            const endX = toCenterX - direction * (avatarSize / 2 + 10);
            const lineStartX = startX + direction * 8;
            const lineEndX = endX - direction * 8;
            const midX = (lineStartX + lineEndX) / 2;
            const lineY = from.y + avatarSize / 2 + yOffset;
            const safeLabelGap = Math.min(labelGap, Math.max(36, (Math.abs(lineEndX - lineStartX) - 18) / 2));
            if (edgeOffset > 0) {
              const curveY = lineY + edgeOffset * 14;
              return (
                <g key={edge.id}>
                  <path d={`M ${lineStartX} ${lineY} L ${lineStartX} ${curveY} L ${lineEndX} ${curveY} L ${lineEndX} ${lineY}`} fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="6 5" markerEnd="url(#flow-arrow)" />
                  <text x={midX} y={curveY - 5} textAnchor="middle" className="fill-slate-500 text-[11px] font-medium dark:fill-slate-400">
                    <tspan x={midX}>{edge.label}</tspan>
                    <tspan x={midX} dy="13" className="fill-slate-400 text-[10px] font-normal dark:fill-slate-500">
                      {edge.durationText}
                    </tspan>
                  </text>
                </g>
              );
            }
            return (
              <g key={edge.id}>
                <path d={`M ${lineStartX} ${lineY} L ${midX - direction * safeLabelGap} ${lineY}`} fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray={useDashed ? '6 5' : undefined} />
                <path d={`M ${midX + direction * safeLabelGap} ${lineY} L ${lineEndX} ${lineY}`} fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray={useDashed ? '6 5' : undefined} markerEnd="url(#flow-arrow)" />
                <text x={midX} y={lineY - 5} textAnchor="middle" className="fill-slate-500 text-[11px] font-medium dark:fill-slate-400">
                  <tspan x={midX}>{edge.label}</tspan>
                  <tspan x={midX} dy="13" className="fill-slate-400 text-[10px] font-normal dark:fill-slate-500">
                    {edge.durationText}
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>

        {actorNodes.map((node, index) => {
          const pos = positionFor(index);
          const active = !node.isPlaceholder && node.id === actorGraph.lastRealNodeId;
          const done = flow.closed && active;
          const lastItem = node.lastItem;
          const timeText = node.isPlaceholder ? '未完成' : formatDateTime(lastItem?.createdAt);
          const visibleStatuses = (node.statusEntries || []).slice(-3);
          const hiddenStatusCount = Math.max((node.statusEntries || []).length - visibleStatuses.length, 0);
          const reminderCount = task?.reminder_count || 0;
          return (
            <div
              key={node.id}
              className={`absolute flex flex-col items-center text-center ${
                active
                  ? done
                    ? 'rounded-[14px] bg-emerald-50/70 px-2 py-2 ring-1 ring-emerald-200/80 dark:bg-emerald-500/10 dark:ring-emerald-500/25'
                    : 'rounded-[14px] bg-blue-50/70 px-2 py-2 ring-1 ring-blue-200/80 dark:bg-blue-500/10 dark:ring-blue-500/25'
                  : node.isPlaceholder
                    ? 'opacity-75'
                    : ''
              }`}
              style={{ left: pos.x, top: pos.y, width: nodeWidth, minHeight: nodeHeight }}
            >
              <div
                className={`grid shrink-0 place-items-center rounded-full border font-semibold shadow-[0_4px_12px_rgba(15,23,42,0.04)] ${
                  node.isPlaceholder
                    ? 'border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-white/20 dark:bg-white/5'
                    : done
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : active
                        ? 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300'
                        : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                }`}
                style={{ width: avatarSize, height: avatarSize, fontSize: Math.max(15, Math.floor(avatarSize * 0.38)) }}
              >
                {initialFor(node)}
              </div>
              <div className="mt-2 w-full min-w-0">
                <div className="truncate text-[13px] font-semibold leading-tight text-[var(--app-text)]">{node.isPlaceholder ? '任务结束' : displayUser(node.person) || '-'}</div>
                <div className="mt-1 space-y-0.5">
                  {visibleStatuses.map((entry) => (
                    <div key={entry.id} className="truncate text-[11px] leading-tight text-[var(--app-muted)]">
                      {entry.label}
                    </div>
                  ))}
                  {hiddenStatusCount > 0 && (
                    <div className="text-[10.5px] leading-tight text-[var(--app-subtle)]">+{hiddenStatusCount} 个状态</div>
                  )}
                </div>
              </div>
              <div className="mt-1.5 whitespace-nowrap text-[11px] leading-tight text-[var(--app-subtle)] tabular-nums">
                {timeText}
              </div>
              {active && !node.isPlaceholder && !flow.closed && (
                <div className="mt-2 w-full space-y-1 text-[11px] leading-tight text-[var(--app-muted)]">
                  <div>已停留 {node.durationText}</div>
                  {reminderCount > 0 && (
                    <div>
                      催办 {reminderCount} 次{task?.latest_reminder_at ? ` · 最近 ${formatActivityTime(task.latest_reminder_at)}` : ''}
                    </div>
                  )}
                  <RemindActionButton task={task} onRemind={onRemind} user={user} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowTimeline({ flow, Badge, badgeClass, displayUser, formatDateTime, flowStatusTone }) {
  if (!flow.items.length) {
    return <div className="rounded-[12px] border border-dashed border-[var(--app-border)] p-4 text-[15px] text-[var(--app-muted)]">暂无流转记录。</div>;
  }

  return (
    <div className="rounded-[14px] border border-[var(--app-border)] bg-white p-4 dark:bg-[var(--app-bg)]">
      {flow.items.map((item, index) => {
        const transferText = item.isTransfer ? `由 ${displayUser(item.record?.actor)} 转派给 ${displayUser(item.toUser)}` : '';
        const remindText = item.record?.event_type === 'remind' ? item.rawAction || item.note : '';
        const personText = remindText || transferText || `${item.roleLabel}：${displayUser(item.person) || '-'}`;
        const quick = item.durationMinutes <= 0;
        const noteText = item.note && item.note !== item.actionLabel && item.note !== item.rawAction ? item.note : '';

        return (
          <div key={item.id} className="relative grid grid-cols-[20px_1fr_auto] gap-3 pb-5 last:pb-0">
            <span className={`mt-1.5 size-2.5 rounded-full ring-4 ring-white dark:ring-[var(--app-bg)] ${index === flow.items.length - 1 ? 'bg-[var(--app-primary)]' : 'bg-slate-300 dark:bg-slate-600'}`} />
            {index < flow.items.length - 1 && <span className="absolute left-[8px] top-6 h-[calc(100%-0.9rem)] w-px bg-[var(--app-border)]" />}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-[var(--app-text)]">{item.actionKnown ? item.actionLabel : item.statusLabel}</span>
                <Badge className={badgeClass(flowStatusTone, item.status)}>{item.statusLabel}</Badge>
                {item.isTransfer && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">真实转派</span>}
              </div>
              <div className="mt-1.5 text-[13px] text-[var(--app-muted)]">{personText}</div>
              {!item.actionKnown && item.rawAction && <div className="mt-1 text-[12px] text-[var(--app-subtle)]">{item.rawAction}</div>}
              {noteText && <div className="mt-1 text-[12px] text-[var(--app-subtle)]">{noteText}</div>}
            </div>
            <div className="shrink-0 text-right text-[13px]">
              <div className="font-medium tabular-nums text-[var(--app-text)]">{formatDateTime(item.createdAt)}</div>
              <div className="mt-1 text-[var(--app-muted)]">{item.durationText}</div>
              {quick && <div className="mt-1 text-[11px] text-[var(--app-subtle)]">快速流转</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
