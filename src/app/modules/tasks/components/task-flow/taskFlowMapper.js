import { MarkerType } from '@xyflow/react';

const NODE_WIDTH = 220;
const NODE_HORIZONTAL_GAP = 304;
const NODE_Y = 52;

const STATUS_LABELS = {
  todo: '待处理',
  in_progress: '处理中',
  confirming: '待完成确认',
  overdue: '已超时',
  done: '已完成',
  cancel_pending: '待取消确认',
  cancelled: '已取消',
  created: '已创建',
};

const DEFAULT_USER = {
  id: null,
  name: '未知用户',
  role: '暂无角色',
  avatar: '',
};

function valueText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function normalizeTime(value, formatDateTime) {
  if (!value) return '暂无时间';
  if (typeof formatDateTime === 'function') {
    const formatted = formatDateTime(value);
    if (formatted) return formatted;
  }
  return valueText(value, '暂无时间');
}

function localDisplayUser(user, displayUser) {
  if (!user) return '';
  if (typeof user === 'string') return user;
  if (typeof displayUser === 'function') {
    const text = displayUser(user);
    if (text && text !== '-') return text;
  }
  return user.display_name || user.first_name || user.username || user.name || '';
}

function normalizeUser(user, displayUser, fallback = DEFAULT_USER) {
  if (!user) return { ...fallback };
  const name = localDisplayUser(user, displayUser) || fallback.name || DEFAULT_USER.name;
  const department = user.default_department || user.department || user.profile?.default_department;
  return {
    id: user.id ?? name,
    name,
    role: department?.name || user.role || user.title || fallback.role || DEFAULT_USER.role,
    avatar: user.avatar || user.avatar_url || '',
    raw: user,
  };
}

function userKey(user, displayUser) {
  if (!user) return '';
  if (user.id !== undefined && user.id !== null) return `id:${user.id}`;
  return `name:${localDisplayUser(user, displayUser) || String(user)}`;
}

function sameUser(left, right, displayUser) {
  const leftKey = userKey(left, displayUser);
  const rightKey = userKey(right, displayUser);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function dedupeUsers(users, displayUser) {
  const seen = new Set();
  return (users || []).filter(Boolean).filter((user) => {
    const key = userKey(user, displayUser);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function candidateUsers(task, displayUser) {
  const assignmentUsers = (task?.assignments || []).map((assignment) => assignment?.assignee).filter(Boolean);
  return dedupeUsers([...(task?.candidate_owners || []), ...assignmentUsers], displayUser);
}

function includesUser(users, user, displayUser) {
  return Boolean(user && (users || []).some((item) => sameUser(item, user, displayUser)));
}

function flowUser(record, key) {
  if (!record) return null;
  if (key === 'from') return record.from_user || record.from_owner || null;
  if (key === 'to') return record.to_user || record.to_owner || null;
  return record.actor || record.user || record.to_user || record.to_owner || record.from_user || record.from_owner || null;
}

function recordStatus(record, task) {
  if (!record) return task?.status || 'todo';
  return record.status || record.to_status || task?.status || 'todo';
}

function rawRecordText(record) {
  return valueText(record?.action_text || record?.action || record?.note || record?.label || record?.event_type, '');
}

function durationMinutes(record) {
  const direct = Number(record?.duration_minutes);
  if (Number.isFinite(direct)) return Math.max(direct, 0);
  const hours = Number(record?.duration_until_next_hours);
  if (!Number.isFinite(hours)) return 0;
  return Math.max(Math.round(hours * 60), 0);
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '少于1分钟';
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours}小时${rest}分钟` : `${hours}小时`;
  const days = Math.floor(hours / 24);
  const dayHours = hours % 24;
  return dayHours ? `${days}天${dayHours}小时` : `${days}天`;
}

function isCreatedRecord(record) {
  const raw = rawRecordText(record).toLowerCase();
  return record?.event_type === 'created' || raw.includes('create') || raw.includes('创建');
}

function isSystemOwnerChange(record) {
  const status = recordStatus(record);
  const raw = rawRecordText(record).toLowerCase();
  return (
    status === 'cancel_pending'
    || status === 'confirming'
    || raw.includes('reject_cancel')
    || raw.includes('拒绝取消')
  );
}

function isTransferRecord(record, displayUser) {
  const fromUser = flowUser(record, 'from');
  const toUser = flowUser(record, 'to');
  const ownerEvent = record?.event_type === 'owner' || record?.event_type === 'rework';
  return Boolean(ownerEvent && fromUser && toUser && !sameUser(fromUser, toUser, displayUser) && !isSystemOwnerChange(record));
}

function isClaimRecord(record, candidates, displayUser) {
  if (!record || isTransferRecord(record, displayUser)) return false;
  const toUser = flowUser(record, 'to') || record.actor;
  const fromUser = flowUser(record, 'from');
  const status = recordStatus(record);
  const raw = rawRecordText(record).toLowerCase();
  const claimCopy = raw.includes('claim_task') || raw.includes('认领') || raw.includes('开始处理');
  const ownerClaim = record.event_type === 'owner' && toUser && (!fromUser || sameUser(fromUser, toUser, displayUser));
  const candidateClaim = includesUser(candidates, toUser, displayUser) && ['in_progress', 'overdue'].includes(status);
  return Boolean((ownerClaim && ['in_progress', 'todo', 'overdue'].includes(status)) || claimCopy || candidateClaim);
}

function sortRecords(records) {
  return (records || []).map((record, index) => ({ record, index })).sort((left, right) => {
    const leftTime = new Date(left.record?.created_at || 0).getTime();
    const rightTime = new Date(right.record?.created_at || 0).getTime();
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime) || leftTime === rightTime) {
      return left.index - right.index;
    }
    return leftTime - rightTime;
  }).map((item) => item.record);
}

function findClaimedUser(records, task, candidates, displayUser) {
  for (const record of records) {
    if (isClaimRecord(record, candidates, displayUser)) {
      return flowUser(record, 'to') || record.actor;
    }
    const actor = flowUser(record) || task?.owner;
    if (['in_progress', 'overdue', 'confirming', 'done'].includes(recordStatus(record, task)) && includesUser(candidates, actor, displayUser)) {
      return actor;
    }
  }
  if (task?.owner && task.status && task.status !== 'todo' && includesUser(candidates, task.owner, displayUser)) {
    return task.owner;
  }
  return null;
}

function normalizeCandidates(candidates, claimedBy, displayUser) {
  return candidates.map((candidate) => {
    const normalized = normalizeUser(candidate, displayUser, { ...DEFAULT_USER, role: '候选人' });
    return {
      ...normalized,
      isClaimed: Boolean(claimedBy && sameUser(candidate, claimedBy, displayUser)),
    };
  });
}

function createStepFactory({ displayUser, formatDateTime }) {
  let sequence = 0;

  return function createStep(partial) {
    sequence += 1;
    const actor = normalizeUser(partial.actor, displayUser, partial.actorFallback);
    const rawTime = partial.time || partial.record?.created_at;
    const minutes = partial.durationMinutes ?? durationMinutes(partial.record);
    return {
      id: `${partial.type || 'step'}-${partial.record?.id || partial.id || sequence}`,
      step: sequence,
      type: partial.type || 'processing',
      title: partial.title || '任务流转',
      actorName: partial.actorName || actor.name,
      actorRole: partial.actorRole || actor.role,
      actorAvatar: partial.actorAvatar || actor.avatar,
      candidates: partial.candidates || [],
      claimedBy: partial.claimedBy || '',
      status: partial.status || '',
      statusLabel: partial.statusLabel || STATUS_LABELS[partial.status] || partial.status || '状态更新',
      time: normalizeTime(rawTime, formatDateTime),
      durationText: partial.durationText || formatDuration(minutes),
      remark: valueText(partial.remark ?? partial.record?.note, '暂无备注'),
      isCurrent: Boolean(partial.isCurrent),
      isCompleted: Boolean(partial.isCompleted),
      summaryLabel: partial.summaryLabel,
      transferText: partial.transferText || '',
      rawRecord: partial.record || null,
    };
  };
}

function pushProcessingStep(steps, createStep, record, actor, displayUser, seenProcessing) {
  const key = userKey(actor, displayUser) || `unknown-${steps.length}`;
  if (seenProcessing.has(key)) return;
  const normalized = normalizeUser(actor, displayUser, { ...DEFAULT_USER, role: '责任人' });
  seenProcessing.add(key);
  steps.push(createStep({
    type: 'processing',
    title: `${normalized.name}处理中`,
    actor,
    actorRole: normalized.role,
    status: recordStatus(record),
    statusLabel: '进行中',
    remark: valueText(record?.note, '任务正在处理中'),
    record,
    summaryLabel: `${normalized.name}处理中`,
  }));
}

function pushCompleteStep(steps, createStep, record, actor, displayUser) {
  const normalized = normalizeUser(actor, displayUser, { ...DEFAULT_USER, role: '责任人' });
  steps.push(createStep({
    type: 'complete',
    title: `${normalized.name}完成`,
    actor,
    actorRole: normalized.role,
    status: recordStatus(record),
    statusLabel: '已完成',
    remark: valueText(record?.note, '任务处理已完成'),
    record,
    summaryLabel: `${normalized.name}完成`,
  }));
}

function buildEdges(nodes, currentIndex) {
  return nodes.slice(0, -1).map((node, index) => {
    const active = index < currentIndex;
    const color = active ? '#aab4c3' : '#d9dee7';
    return {
      id: `edge-${node.id}-${nodes[index + 1].id}`,
      source: node.id,
      target: nodes[index + 1].id,
      type: 'smoothstep',
      focusable: false,
      selectable: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color,
      },
      style: {
        stroke: color,
        strokeWidth: active ? 1.45 : 1.2,
      },
    };
  });
}

function flowSummaryLabel(step) {
  if (step.summaryLabel) return step.summaryLabel;
  if (step.type === 'assign_candidates' && step.candidates?.length) return `指派候选人 ${step.candidates.length} 人`;
  if (step.type === 'archive') return '已归档';
  return step.title;
}

export function buildTaskFlowGraph({ task, records = [], displayUser, formatDateTime } = {}) {
  const orderedRecords = sortRecords(records);
  if (!orderedRecords.length) {
    return {
      nodes: [],
      edges: [],
      summary: '暂无处理轨迹',
      currentNode: null,
      candidates: [],
      claimedBy: null,
      longestText: '暂无明显停留',
    };
  }

  const createStep = createStepFactory({ displayUser, formatDateTime });
  const candidates = candidateUsers(task, displayUser);
  const claimedUser = findClaimedUser(orderedRecords, task, candidates, displayUser);
  const normalizedClaimedUser = claimedUser ? normalizeUser(claimedUser, displayUser) : null;
  const steps = [];
  const seenProcessing = new Set();
  let hasClaim = false;
  let hasComplete = false;
  let hasArchive = false;
  let hasCancelled = false;
  let lastCompleteActor = null;

  const createdRecord = orderedRecords.find(isCreatedRecord) || orderedRecords[0];
  steps.push(createStep({
    type: 'create',
    title: '创建任务',
    actor: createdRecord?.actor || task?.creator,
    actorFallback: { ...DEFAULT_USER, role: '创建人' },
    actorRole: normalizeUser(createdRecord?.actor || task?.creator, displayUser, { ...DEFAULT_USER, role: '创建人' }).role || '创建人',
    status: 'created',
    statusLabel: '已创建',
    remark: valueText(createdRecord?.note, '任务已创建'),
    record: createdRecord,
    time: createdRecord?.created_at || task?.created_at,
    summaryLabel: `${normalizeUser(createdRecord?.actor || task?.creator, displayUser).name}创建`,
  }));

  const candidateData = normalizeCandidates(candidates, claimedUser, displayUser);
  if (candidateData.length || !task?.owner) {
    const assignTitle = candidateData.length ? '指派候选人' : '等待指派';
    steps.push(createStep({
      type: 'assign_candidates',
      title: assignTitle,
      actorName: candidateData.length ? `${candidateData.length} 位候选人` : '尚未指派',
      actorRole: candidateData.length ? '候选人池' : '任务池',
      candidates: candidateData,
      claimedBy: normalizedClaimedUser?.name || '',
      status: task?.status || 'todo',
      statusLabel: candidateData.length
        ? (normalizedClaimedUser ? `${normalizedClaimedUser.name}已认领` : '等待认领')
        : '待指派',
      remark: candidateData.length
        ? (normalizedClaimedUser ? '其他候选人无需处理' : '候选人可在待办中认领')
        : '等待选择候选人',
      time: createdRecord?.created_at || task?.created_at,
      isCurrent: !candidateData.length && !task?.owner,
      summaryLabel: candidateData.length ? `指派候选人 ${candidateData.length} 人` : '等待指派',
    }));
  }

  orderedRecords.forEach((record) => {
    if (isCreatedRecord(record) || record?.event_type === 'remind') return;

    const status = recordStatus(record, task);
    const fromUser = flowUser(record, 'from');
    const toUser = flowUser(record, 'to');
    const actor = flowUser(record) || task?.owner || task?.creator;
    const actorForProcessing = toUser || actor;
    const raw = rawRecordText(record).toLowerCase();

    if (isClaimRecord(record, candidates, displayUser) && !hasClaim) {
      const claimedActor = toUser || record.actor || task?.owner;
      const normalized = normalizeUser(claimedActor, displayUser, { ...DEFAULT_USER, role: '责任人' });
      steps.push(createStep({
        type: 'claim',
        title: `${normalized.name}认领`,
        actor: claimedActor,
        actorRole: normalized.role,
        status,
        statusLabel: '已认领',
        remark: '其他候选人无需处理',
        record,
        summaryLabel: `${normalized.name}认领`,
      }));
      hasClaim = true;
      if (['in_progress', 'overdue'].includes(status)) {
        pushProcessingStep(steps, createStep, record, claimedActor, displayUser, seenProcessing);
      }
      return;
    }

    if (isTransferRecord(record, displayUser)) {
      const fromName = normalizeUser(fromUser || actor, displayUser).name;
      const toName = normalizeUser(toUser, displayUser).name;
      steps.push(createStep({
        type: 'transfer',
        title: '转派任务',
        actor: fromUser || actor,
        actorName: `${fromName} → ${toName}`,
        actorRole: '转派链路',
        status,
        statusLabel: record?.event_type === 'rework' ? '重办转派' : '已转派',
        remark: valueText(record?.note, '任务已转派给新的处理人'),
        transferText: `${fromName} → ${toName}`,
        record,
        summaryLabel: `${fromName}转派${toName}`,
      }));
      if (['in_progress', 'overdue'].includes(status)) {
        pushProcessingStep(steps, createStep, record, toUser, displayUser, seenProcessing);
      }
      return;
    }

    if (['in_progress', 'overdue'].includes(status) || raw.includes('开始处理')) {
      if (!hasClaim && includesUser(candidates, actorForProcessing, displayUser)) {
        const normalized = normalizeUser(actorForProcessing, displayUser, { ...DEFAULT_USER, role: '责任人' });
        steps.push(createStep({
          type: 'claim',
          title: `${normalized.name}认领`,
          actor: actorForProcessing,
          actorRole: normalized.role,
          status,
          statusLabel: '已认领',
          remark: '其他候选人无需处理',
          record,
          summaryLabel: `${normalized.name}认领`,
        }));
        hasClaim = true;
      }
      pushProcessingStep(steps, createStep, record, actorForProcessing, displayUser, seenProcessing);
      return;
    }

    if (status === 'confirming') {
      const completeActor = fromUser || record.actor || task?.owner;
      pushCompleteStep(steps, createStep, record, completeActor, displayUser);
      lastCompleteActor = completeActor;
      hasComplete = true;
      return;
    }

    if (status === 'done') {
      if (!hasComplete) {
        const completeActor = fromUser || task?.owner || record.actor;
        pushCompleteStep(steps, createStep, record, completeActor, displayUser);
        lastCompleteActor = completeActor;
        hasComplete = true;
      }
      steps.push(createStep({
        type: 'archive',
        title: '归档',
        actor: record.actor || lastCompleteActor || task?.owner,
        actorFallback: { ...DEFAULT_USER, name: '系统', role: '系统归档' },
        actorRole: record.actor ? normalizeUser(record.actor, displayUser).role : '系统归档',
        status,
        statusLabel: '已归档',
        remark: valueText(record?.note, '任务已完成归档'),
        record,
        time: task?.completed_at || record?.created_at,
        summaryLabel: '已归档',
      }));
      hasArchive = true;
      return;
    }

    if (status === 'cancelled') {
      steps.push(createStep({
        type: 'cancelled',
        title: '任务取消',
        actor: record.actor || task?.owner || task?.creator,
        status,
        statusLabel: '已取消',
        remark: valueText(record?.note || task?.cancel_reason, '任务已取消，无需继续处理'),
        record,
        time: task?.cancelled_at || record?.created_at,
        summaryLabel: '已取消',
      }));
      hasCancelled = true;
    }
  });

  const closed = ['done', 'cancelled'].includes(task?.status);
  if (!closed && candidates.length && !hasClaim && task?.status === 'todo') {
    steps.push(createStep({
      type: 'waiting_claim',
      title: '等待认领',
      actorName: '候选人尚未认领',
      actorRole: '当前仍在待办池中',
      status: 'todo',
      statusLabel: '等待认领',
      remark: '候选人可在待办中认领',
      time: task?.updated_at || task?.created_at,
      isCurrent: true,
      summaryLabel: '等待认领',
    }));
  }

  if (!closed && task?.status === 'todo' && steps[steps.length - 1]?.type === 'transfer') {
    steps.push(createStep({
      type: 'waiting_claim',
      title: '等待认领',
      actorName: '新负责人尚未开始',
      actorRole: '等待处理',
      status: 'todo',
      statusLabel: '等待认领',
      remark: '转派后等待新的处理人开始处理',
      time: task?.updated_at,
      isCurrent: true,
      summaryLabel: '等待认领',
    }));
  }

  if (!closed && ['in_progress', 'overdue'].includes(task?.status) && task?.owner) {
    pushProcessingStep(steps, createStep, null, task.owner, displayUser, seenProcessing);
  }

  if (task?.status === 'done' && !hasArchive) {
    if (!hasComplete) {
      pushCompleteStep(steps, createStep, null, task?.owner || lastCompleteActor || task?.creator, displayUser);
    }
    steps.push(createStep({
      type: 'archive',
      title: '归档',
      actorName: '系统',
      actorRole: '系统归档',
      status: 'done',
      statusLabel: '已归档',
      remark: '任务已完成归档',
      time: task?.completed_at || task?.updated_at,
      summaryLabel: '已归档',
    }));
  }

  if (task?.status === 'cancelled' && !hasCancelled) {
    steps.push(createStep({
      type: 'cancelled',
      title: '任务取消',
      actor: task?.owner || task?.creator,
      status: 'cancelled',
      statusLabel: '已取消',
      remark: valueText(task?.cancel_reason, '任务已取消，无需继续处理'),
      time: task?.cancelled_at || task?.updated_at,
      summaryLabel: '已取消',
    }));
  }

  let currentIndex = steps.findIndex((step) => step.isCurrent);
  if (currentIndex < 0) currentIndex = Math.max(steps.length - 1, 0);

  const normalizedSteps = steps.map((step, index) => ({
    ...step,
    isCurrent: index === currentIndex,
    isCompleted: index < currentIndex || step.type === 'complete' || step.type === 'archive' || (closed && index === currentIndex),
  }));

  const nodes = normalizedSteps.map((step, index) => ({
    id: step.id,
    type: 'taskFlowNode',
    position: { x: index * NODE_HORIZONTAL_GAP, y: NODE_Y },
    sourcePosition: 'right',
    targetPosition: 'left',
    draggable: false,
    selectable: false,
    data: {
      ...step,
      width: NODE_WIDTH,
    },
  }));

  const longest = normalizedSteps.reduce((winner, step) => {
    const minutes = durationMinutes(step.rawRecord);
    return minutes > (winner.minutes || 0) ? { step, minutes } : winner;
  }, { step: null, minutes: 0 });

  return {
    nodes,
    edges: buildEdges(nodes, currentIndex),
    summary: normalizedSteps.map(flowSummaryLabel).filter(Boolean).join(' → '),
    currentNode: nodes[currentIndex] || null,
    candidates: candidateData,
    claimedBy: normalizedClaimedUser,
    longestText: longest.step ? `${longest.step.title} ${formatDuration(longest.minutes)}` : '暂无明显停留',
  };
}

