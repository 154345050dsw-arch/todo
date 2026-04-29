import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { Lock, Maximize2, Minus, Plus } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import './taskFlowStyles.css';
import TaskFlowNode from './TaskFlowNode.jsx';

const nodeTypes = {
  taskFlowNode: TaskFlowNode,
};

function nodeColor(node) {
  const type = node?.data?.type;
  if (type === 'claim' || type === 'processing' || type === 'waiting_claim') return '#dbeafe';
  if (type === 'complete' || type === 'archive' || type === 'create') return '#dcfce7';
  if (type === 'transfer') return '#ffedd5';
  if (type === 'cancelled') return '#fee2e2';
  return '#f3f4f6';
}

function TaskFlowCanvasInner({
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
  showMiniMap,
}) {
  const reactFlow = useReactFlow();
  const [zoom, setZoom] = useState(100);
  const renderedNodes = useMemo(
    () => nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isSelected: node.id === selectedNodeId,
      },
    })),
    [nodes, selectedNodeId],
  );
  const displayMiniMap = showMiniMap === true || (showMiniMap === 'auto' && renderedNodes.length > 5);

  useEffect(() => {
    if (!renderedNodes.length) return undefined;
    const frame = window.requestAnimationFrame(() => {
      reactFlow.fitView({ padding: 0.18, duration: 260, minZoom: 0.24, maxZoom: 1.08 });
      setZoom(Math.round(reactFlow.getZoom() * 100));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reactFlow, renderedNodes.length]);

  function syncZoom() {
    window.requestAnimationFrame(() => setZoom(Math.round(reactFlow.getZoom() * 100)));
  }

  return (
    <div className="task-flow-canvas">
      <ReactFlow
        nodes={renderedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, minZoom: 0.24, maxZoom: 1.08 }}
        minZoom={0.18}
        maxZoom={1.45}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(event, node) => {
          event.stopPropagation();
          onNodeSelect?.(node);
        }}
        onMove={(_, viewport) => setZoom(Math.round(viewport.zoom * 100))}
      >
        <Background variant="dots" gap={24} size={1} color="rgba(168, 162, 158, 0.32)" />
        {displayMiniMap && (
          <MiniMap
            className="task-flow-minimap"
            pannable
            zoomable
            nodeColor={nodeColor}
            nodeStrokeColor={(node) => (node?.data?.isCurrent ? '#5b7fc7' : '#d6d3d1')}
            nodeStrokeWidth={2}
            maskColor="rgba(250, 250, 249, 0.64)"
            position="bottom-right"
          />
        )}
      </ReactFlow>

      <div className="task-flow-controls" aria-label="画布控制">
        <button
          type="button"
          className="task-flow-control-button"
          onClick={() => {
            reactFlow.zoomOut({ duration: 180 });
            syncZoom();
          }}
          aria-label="缩小"
          title="缩小"
        >
          <Minus size={15} strokeWidth={1.8} />
        </button>
        <span className="task-flow-control-value">{zoom}%</span>
        <button
          type="button"
          className="task-flow-control-button"
          onClick={() => {
            reactFlow.zoomIn({ duration: 180 });
            syncZoom();
          }}
          aria-label="放大"
          title="放大"
        >
          <Plus size={15} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="task-flow-control-button"
          onClick={() => {
            reactFlow.fitView({ padding: 0.18, duration: 220, minZoom: 0.24, maxZoom: 1.08 });
            syncZoom();
          }}
          aria-label="适配视图"
          title="适配视图"
        >
          <Maximize2 size={15} strokeWidth={1.8} />
        </button>
        <span className="task-flow-control-button" aria-label="锁定只读" title="锁定只读">
          <Lock size={14} strokeWidth={1.8} />
        </span>
      </div>
    </div>
  );
}

export default function TaskFlowCanvas(props) {
  if (!props.nodes?.length) {
    return <div className="task-flow-empty">暂无处理轨迹</div>;
  }

  return (
    <ReactFlowProvider>
      <TaskFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

