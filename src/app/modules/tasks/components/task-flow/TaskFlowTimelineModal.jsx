import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Clock3, PanelRightClose, PanelRightOpen, Radio, X } from 'lucide-react';
import TaskFlowCanvas from './TaskFlowCanvas.jsx';
import { buildTaskFlowGraph } from './taskFlowMapper.js';

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-2 text-[13px]">
      <div className="text-[var(--app-subtle)]">{label}</div>
      <div className="min-w-0 text-[var(--app-text)]">{children}</div>
    </div>
  );
}

function LegendItem({ icon: Icon, label, className }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--app-muted)]">
      <Icon size={12} strokeWidth={1.8} className={className} />
      {label}
    </span>
  );
}

function CandidateDetail({ node }) {
  const candidates = node?.data?.candidates || [];
  if (!candidates.length) {
    return <div className="rounded-[10px] border border-dashed border-[var(--app-border)] p-3 text-[13px] text-[var(--app-muted)]">暂无候选人</div>;
  }

  return (
    <div className="space-y-2">
      {candidates.map((candidate) => (
        <div key={`${candidate.id}-${candidate.name}`} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-[var(--app-text)]">{candidate.name}</div>
            <div className="truncate text-[12px] text-[var(--app-muted)]">{candidate.role || '候选人'}</div>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${candidate.isClaimed ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300' : 'bg-stone-100 text-stone-500 dark:bg-white/5 dark:text-stone-400'}`}>
            {candidate.isClaimed ? '已认领' : '无需处理'}
          </span>
        </div>
      ))}
    </div>
  );
}

function NodeDetailPanel({ node, graph }) {
  if (!node) {
    return (
      <aside className="task-flow-detail-panel min-h-0 w-[320px] shrink-0 p-5">
        <div className="text-[14px] text-[var(--app-muted)]">选择节点查看明细</div>
      </aside>
    );
  }

  const data = node.data || {};
  return (
    <aside className="task-flow-detail-panel min-h-0 w-[320px] shrink-0 overflow-y-auto p-5">
      <div className="mb-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--app-subtle)]">节点详情</div>
        <h3 className="mt-2 text-[18px] font-semibold text-[var(--app-text)]">{data.title}</h3>
        <div className="mt-2 inline-flex rounded-full border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--app-muted)]">
          {data.statusLabel}
        </div>
      </div>

      <div className="divide-y divide-[var(--app-border)] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
        <DetailRow label="步骤">#{String(data.step || 1).padStart(2, '0')}</DetailRow>
        <DetailRow label="处理人">{data.actorName || '未知用户'}</DetailRow>
        <DetailRow label="角色">{data.actorRole || '暂无角色'}</DetailRow>
        <DetailRow label="时间">{data.time || '暂无时间'}</DetailRow>
        <DetailRow label="耗时">{data.durationText || '少于1分钟'}</DetailRow>
        <DetailRow label="说明">{data.remark || '暂无备注'}</DetailRow>
      </div>

      {data.type === 'assign_candidates' && (
        <div className="mt-4">
          <div className="mb-2 text-[13px] font-semibold text-[var(--app-text)]">候选人</div>
          <CandidateDetail node={node} />
          <div className="mt-3 rounded-[10px] bg-blue-50 px-3 py-2 text-[12px] leading-5 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            {graph.claimedBy ? `${graph.claimedBy.name}已认领，其他候选人无需处理。` : '候选人可在待办中认领。'}
          </div>
        </div>
      )}
    </aside>
  );
}

export default function TaskFlowTimelineModal({
  open,
  onClose,
  task,
  records,
  displayUser,
  formatDateTime,
}) {
  const [showDetails, setShowDetails] = useState(false);
  const graph = useMemo(
    () => buildTaskFlowGraph({ task, records, displayUser, formatDateTime }),
    [task, records, displayUser, formatDateTime],
  );
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) || graph.currentNode || graph.nodes[0] || null;

  useEffect(() => {
    if (!open) return undefined;
    setSelectedNodeId(graph.currentNode?.id || graph.nodes[0]?.id || null);
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
  }, [open, onClose, graph.currentNode?.id, graph.nodes]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/35 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <section
        className="task-flow-modal-shell flex flex-col overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-[var(--app-border)] px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold text-[var(--app-text)]">任务流转轨迹</h2>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--app-muted)]">
              <span className="max-w-[460px] truncate">{task?.title || '未命名任务'}</span>
              <span className="text-[var(--app-subtle)]">任务编号：{task?.code || task?.id || '-'}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <LegendItem icon={CheckCircle2} label="已完成" className="text-emerald-500" />
              <LegendItem icon={Clock3} label="处理中" className="text-blue-500" />
              <LegendItem icon={Radio} label="当前节点" className="text-[var(--app-primary)]" />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 text-[13px] font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-panel-soft)]"
            >
              {showDetails ? <PanelRightClose size={15} strokeWidth={1.7} /> : <PanelRightOpen size={15} strokeWidth={1.7} />}
              {showDetails ? '收起详情' : '展开详情'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-[9px] text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label="关闭任务流转轨迹"
            >
              <X size={18} strokeWidth={1.7} />
            </button>
          </div>
        </header>

        <div className={`task-flow-modal-body min-h-0 flex-1 ${showDetails ? 'grid grid-cols-[minmax(0,1fr)_320px]' : 'flex'}`}>
          <div className="min-h-0 min-w-0 flex-1 p-4">
            <TaskFlowCanvas
              nodes={graph.nodes}
              edges={graph.edges}
              selectedNodeId={selectedNode?.id}
              showMiniMap="auto"
              onNodeSelect={(node) => {
                setSelectedNodeId(node.id);
                setShowDetails(true);
              }}
            />
          </div>
          {showDetails && <NodeDetailPanel node={selectedNode} graph={graph} />}
        </div>
      </section>
    </div>,
    document.body,
  );
}

