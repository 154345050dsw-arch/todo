import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Archive,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  ClipboardList,
  Clock3,
  Send,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';

const TYPE_ICON = {
  create: ClipboardList,
  assign_candidates: Users,
  claim: UserCheck,
  processing: Clock3,
  transfer: Send,
  complete: CheckCircle2,
  archive: Archive,
  waiting_claim: CircleDashed,
  cancelled: XCircle,
};

function initials(name) {
  const text = String(name || '').trim();
  if (!text) return '?';
  if (/^[a-zA-Z]/.test(text)) return text.slice(0, 2).toUpperCase();
  return text.slice(0, 1);
}

function visibleCandidates(candidates = []) {
  const visible = candidates.slice(0, 3);
  const overflow = Math.max(candidates.length - visible.length, 0);
  return { visible, overflow };
}

function TaskFlowNode({ data }) {
  const Icon = TYPE_ICON[data.type] || CircleDot;
  const isCandidateNode = data.type === 'assign_candidates';
  const { visible, overflow } = visibleCandidates(data.candidates || []);
  const actorName = data.actorName || '未知用户';
  const actorRole = data.actorRole || '暂无角色';

  return (
    <article
      className={[
        'task-flow-node',
        `task-flow-node--${data.type}`,
        data.isCurrent ? 'is-current' : '',
        data.isCompleted ? 'is-completed' : '',
      ].filter(Boolean).join(' ')}
      style={{ width: data.width || 220 }}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="task-flow-handle" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="task-flow-handle" />

      <div className="task-flow-node__topline">
        <span className="task-flow-node__icon" aria-hidden="true">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <span className="task-flow-node__step">#{String(data.step || 1).padStart(2, '0')}</span>
      </div>

      <div className="task-flow-node__title-row">
        <h3 className="task-flow-node__title">{data.title}</h3>
        <span className="task-flow-node__status">{data.statusLabel}</span>
      </div>

      <div className="task-flow-node__person">
        <span className="task-flow-node__avatar">
          {data.actorAvatar ? <img src={data.actorAvatar} alt="" /> : initials(actorName)}
        </span>
        <span className="task-flow-node__person-text">
          <span className="task-flow-node__person-name">{actorName}</span>
          <span className="task-flow-node__person-role">{actorRole}</span>
        </span>
      </div>

      {isCandidateNode && (
        <div className="task-flow-node__candidates">
          <div className="task-flow-node__candidate-count">
            {data.candidates?.length ? `${data.candidates.length} 位候选人` : '暂无候选人'}
          </div>
          <div className="task-flow-node__candidate-list">
            {visible.map((candidate) => (
              <span key={`${candidate.id}-${candidate.name}`} className={`task-flow-node__candidate ${candidate.isClaimed ? 'is-claimed' : ''}`}>
                {candidate.name}
              </span>
            ))}
            {overflow > 0 && <span className="task-flow-node__candidate">等 {overflow} 人</span>}
          </div>
          <div className="task-flow-node__candidate-note">
            {data.claimedBy ? `${data.claimedBy}已认领，其他候选人无需处理` : '等待候选人认领'}
          </div>
        </div>
      )}

      {!isCandidateNode && (
        <p className="task-flow-node__remark">{data.remark || '暂无备注'}</p>
      )}

      <div className="task-flow-node__meta">
        <span>{data.time || '暂无时间'}</span>
        <span>{data.durationText || '少于1分钟'}</span>
      </div>
    </article>
  );
}

export default memo(TaskFlowNode);

