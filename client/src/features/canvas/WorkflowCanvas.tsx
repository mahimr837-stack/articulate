import { Minus, MousePointer2, Plus, Power, Scan, Trash2 } from "lucide-react";
import { PointerEvent, WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkflowNode } from "../nodes/WorkflowNode";
import { ExecutionState } from "../execution/executionState";
import { SafeAgentStatus } from "@shared/execution";
import { createWorkflowEdge, getDerivedBypassEdges, getNodeDimensions, getWorkflowGroupForNode, GraphPosition, isWorkflowEdgeEnabled, isWorkflowNodeBypassed, NodeConfiguration, WorkflowEdge, WorkflowGroup, WorkflowNode as WorkflowNodeData, WorkflowSelection } from "../workflow/types";
import { getMinimapLayout, getViewportWorldRectangle, isWorldRectangleVisible, MINIMAP_HEIGHT, MINIMAP_WIDTH, minimapPointFromWorld, worldPointFromMinimap } from "./minimap";

type NodeAction = "delete" | "duplicate" | "configure" | "toggle-lock" | "toggle-bypass" | "toggle-disable" | "view-raw" | "tunnel";

type CanvasProps = {
  nodes: WorkflowNodeData[];
  edges: WorkflowEdge[];
  groups: WorkflowGroup[];
  selection: WorkflowSelection;
  onSelectionChange: (selection: WorkflowSelection) => void;
  onMoveNodes: (positions: Record<string, GraphPosition>) => void;
  onMoveStart: () => void;
  onMoveEnd: () => void;
  onAddEdge: (edge: WorkflowEdge) => void;
  onToggleEdge: (edgeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onNodeAction: (nodeId: string, action: NodeAction) => void;
  onConfigChange: (nodeId: string, config: Partial<NodeConfiguration>) => void;
  execution: ExecutionState;
  onExecutionAction: (nodeId: string, action: "run" | "pause" | "resume" | "retry") => void;
  onDocumentUpload: (nodeId: string, files: File[]) => void;
  uploadingDocumentId?: string;
  documentErrors: Record<string, string | undefined>;
  agentStatuses: Record<string, SafeAgentStatus | undefined>;
  requestingProposalNodeId?: string;
  onRequestNodeProposal: (nodeId: string) => void;
  focusRequest?: { nodeId: string; key: number };
};

type Viewport = { x: number; y: number; zoom: number };
type Interaction =
  | { kind: "pan"; start: GraphPosition; viewport: Viewport; moved: boolean }
  | { kind: "marquee"; start: GraphPosition; current: GraphPosition }
  | { kind: "node"; start: GraphPosition; positions: Record<string, GraphPosition> }
  | { kind: "connect"; source: string; current: GraphPosition }
  | null;

const GRID = 20;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));
const snap = (value: number) => Math.round(value / GRID) * GRID;
const getDefaultViewport = (): Viewport =>
  typeof window !== "undefined" && window.innerWidth <= 600
    ? { x: 235, y: 305, zoom: 0.52 }
    : { x: 760, y: 370, zoom: 1 };

function curve(from: GraphPosition, to: GraphPosition) {
  const bow = Math.max(70, Math.abs(to.x - from.x) * 0.42);
  return `M ${from.x} ${from.y} C ${from.x + bow} ${from.y}, ${to.x - bow} ${to.y}, ${to.x} ${to.y}`;
}

function curveMidpoint(from: GraphPosition, to: GraphPosition): GraphPosition {
  const bow = Math.max(70, Math.abs(to.x - from.x) * 0.42);
  const controlA = { x: from.x + bow, y: from.y };
  const controlB = { x: to.x - bow, y: to.y };
  const t = 0.5;
  const mt = 1 - t;
  return {
    x: mt ** 3 * from.x + 3 * mt ** 2 * t * controlA.x + 3 * mt * t ** 2 * controlB.x + t ** 3 * to.x,
    y: mt ** 3 * from.y + 3 * mt ** 2 * t * controlA.y + 3 * mt * t ** 2 * controlB.y + t ** 3 * to.y,
  };
}

function nodeCenter(node: WorkflowNodeData, direction: "in" | "out"): GraphPosition {
  const dimensions = getNodeDimensions(node);
  return { x: node.position.x + (direction === "out" ? dimensions.width : 0), y: node.position.y + dimensions.height / 2 };
}

export function WorkflowCanvas({
  nodes,
  edges,
  groups,
  selection,
  onSelectionChange,
  onMoveNodes,
  onMoveStart,
  onMoveEnd,
  onAddEdge,
  onToggleEdge,
  onDeleteEdge,
  onNodeAction,
  onConfigChange,
  execution,
  onExecutionAction,
  onDocumentUpload,
  uploadingDocumentId,
  documentErrors,
  agentStatuses,
  requestingProposalNodeId,
  onRequestNodeProposal,
  focusRequest,
}: CanvasProps) {
  const [viewport, setViewport] = useState<Viewport>(getDefaultViewport);
  const [interaction, setInteraction] = useState<Interaction>(null);
  const [edgeActionsOpen, setEdgeActionsOpen] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [minimapActive, setMinimapActive] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const minimapIdleTimer = useRef<number | undefined>(undefined);
  const minimapPointerId = useRef<number | undefined>(undefined);

  const byId = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const wakeMinimap = useCallback(() => {
    setMinimapActive(true);
    window.clearTimeout(minimapIdleTimer.current);
    minimapIdleTimer.current = window.setTimeout(() => setMinimapActive(false), 1400);
  }, []);

  useEffect(() => () => window.clearTimeout(minimapIdleTimer.current), []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateSize = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!focusRequest) return;
    const node = byId.get(focusRequest.nodeId);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!node || !rect) return;
    const dimensions = getNodeDimensions(node);
    setViewport(current => ({ ...current, x: rect.width / 2 - (node.position.x + dimensions.width / 2) * current.zoom, y: rect.height / 2 - (node.position.y + dimensions.height / 2) * current.zoom }));
  }, [focusRequest, byId]);
  const bypassedNodeIds = useMemo(
    () => new Set(nodes.filter(isWorkflowNodeBypassed).map(node => node.id)),
    [nodes],
  );
  const derivedBypassEdges = useMemo(
    () => getDerivedBypassEdges({ id: "canvas", name: "", nodes, edges, groups, selection, updatedAt: 0 }),
    [nodes, edges, groups],
  );
  const getStagePoint = (event: { clientX: number; clientY: number }) => {
    const rect = stageRef.current?.getBoundingClientRect();
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : { x: 0, y: 0 };
  };
  const toWorld = (point: GraphPosition) => ({ x: (point.x - viewport.x) / viewport.zoom, y: (point.y - viewport.y) / viewport.zoom });

  const selectNodesWithin = (start: GraphPosition, end: GraphPosition) => {
    const a = toWorld({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) });
    const b = toWorld({ x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) });
    const nodeIds = nodes
      .filter(node => node.position.x >= a.x && node.position.x <= b.x && node.position.y >= a.y && node.position.y <= b.y)
      .map(node => node.id);
    onSelectionChange({ nodeIds, edgeIds: [] });
  };

  const onEdgePointerDown = (event: PointerEvent<SVGPathElement>, edgeId: string) => {
    event.stopPropagation();
    setEdgeActionsOpen(false);
    onSelectionChange({ nodeIds: [], edgeIds: [edgeId] });
  };

  const onStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest("[data-node-id], [data-port-node-id], .canvas-controls, .rope-selection")) return;
    if (event.button !== 0 && event.button !== 1) return;
    const point = getStagePoint(event);
    stageRef.current?.setPointerCapture(event.pointerId);
    if (event.shiftKey && event.button === 0) {
      setInteraction({ kind: "marquee", start: point, current: point });
    } else {
      wakeMinimap();
      setInteraction({ kind: "pan", start: point, viewport, moved: false });
    }
  };

  const onNodePointerDown = (event: PointerEvent<HTMLDivElement>, nodeId: string) => {
    const target = event.target as Element;
    if (target.closest("button, textarea, input, select")) return;
    event.stopPropagation();
    const node = byId.get(nodeId);
    if (!node) return;
    const wasSelected = selection.nodeIds.includes(nodeId);
    const group = getWorkflowGroupForNode({ id: "canvas", name: "", nodes, edges, groups, selection, updatedAt: 0 }, nodeId);
    const nodeIds = group && !event.shiftKey
      ? group.nodeIds
      : event.shiftKey
      ? wasSelected ? selection.nodeIds.filter(id => id !== nodeId) : [...selection.nodeIds, nodeId]
      : wasSelected ? selection.nodeIds : [nodeId];
    onSelectionChange({ nodeIds, edgeIds: [] });
    if (node.locked || group?.locked) return;
    const positions = Object.fromEntries(
      nodes.filter(candidate => nodeIds.includes(candidate.id)).map(candidate => [candidate.id, { ...candidate.position }]),
    );
    stageRef.current?.setPointerCapture(event.pointerId);
    onMoveStart();
    setInteraction({ kind: "node", start: getStagePoint(event), positions });
  };

  const onPortPointerDown = (event: PointerEvent<HTMLButtonElement>, nodeId: string) => {
    event.stopPropagation();
    stageRef.current?.setPointerCapture(event.pointerId);
    setInteraction({ kind: "connect", source: nodeId, current: toWorld(getStagePoint(event)) });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!interaction) return;
    const point = getStagePoint(event);
    if (interaction.kind === "pan") {
      wakeMinimap();
      const delta = { x: point.x - interaction.start.x, y: point.y - interaction.start.y };
      setViewport({ ...interaction.viewport, x: interaction.viewport.x + delta.x, y: interaction.viewport.y + delta.y });
      setInteraction({ ...interaction, moved: interaction.moved || Math.hypot(delta.x, delta.y) > 3 });
    }
    if (interaction.kind === "marquee") setInteraction({ ...interaction, current: point });
    if (interaction.kind === "node") {
      wakeMinimap();
      const delta = { x: (point.x - interaction.start.x) / viewport.zoom, y: (point.y - interaction.start.y) / viewport.zoom };
      const positions = Object.fromEntries(
        Object.entries(interaction.positions).map(([id, position]) => [id, { x: snap(position.x + delta.x), y: snap(position.y + delta.y) }]),
      );
      onMoveNodes(positions);
    }
    if (interaction.kind === "connect") setInteraction({ ...interaction, current: toWorld(point) });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!interaction) return;
    if (interaction.kind === "pan" && !interaction.moved) onSelectionChange({ nodeIds: [], edgeIds: [] });
    if (interaction.kind === "marquee") selectNodesWithin(interaction.start, interaction.current);
    if (interaction.kind === "node") onMoveEnd();
    if (interaction.kind === "connect") {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-port-node-id]") as HTMLElement | null;
      const targetId = target?.dataset.portNodeId;
      const targetDirection = target?.dataset.portDirection;
      if (targetId && targetDirection === "in" && targetId !== interaction.source) {
        onAddEdge(createWorkflowEdge({
          id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `edge-${Date.now()}`,
          source: interaction.source,
          target: targetId,
          sourcePort: "out",
          targetPort: "in",
        }));
      }
    }
    setInteraction(null);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    wakeMinimap();
    const point = getStagePoint(event);
    const nextZoom = clamp(viewport.zoom * Math.exp(-event.deltaY * 0.0015), 0.3, 2.3);
    const ratio = nextZoom / viewport.zoom;
    setViewport({ x: point.x - (point.x - viewport.x) * ratio, y: point.y - (point.y - viewport.y) * ratio, zoom: nextZoom });
  };

  const marquee = interaction?.kind === "marquee"
    ? { left: Math.min(interaction.start.x, interaction.current.x), top: Math.min(interaction.start.y, interaction.current.y), width: Math.abs(interaction.current.x - interaction.start.x), height: Math.abs(interaction.current.y - interaction.start.y) }
    : null;
  const draggingRope = interaction?.kind === "connect" ? { from: byId.get(interaction.source), to: interaction.current } : null;
  const selectedEdge = selection.edgeIds.length === 1 ? edges.find(edge => edge.id === selection.edgeIds[0]) : undefined;
  const selectedEdgeSource = selectedEdge ? byId.get(selectedEdge.source) : undefined;
  const selectedEdgeTarget = selectedEdge ? byId.get(selectedEdge.target) : undefined;
  const selectedEdgeMidpoint = selectedEdgeSource && selectedEdgeTarget
    ? curveMidpoint(nodeCenter(selectedEdgeSource, "out"), nodeCenter(selectedEdgeTarget, "in"))
    : undefined;
  const minimapLayout = useMemo(
    () => getMinimapLayout(nodes, viewport, stageSize),
    [nodes, viewport, stageSize],
  );
  const minimapViewport = getViewportWorldRectangle(viewport, stageSize);
  const visibleNodes = useMemo(() => {
    const padding = 420 / Math.max(viewport.zoom, 0.3);
    return nodes.filter(node => {
      const dimensions = getNodeDimensions(node);
      return selection.nodeIds.includes(node.id) || isWorldRectangleVisible(
        { left: node.position.x, top: node.position.y, width: dimensions.width, height: dimensions.height },
        minimapViewport,
        padding,
      );
    });
  }, [nodes, selection.nodeIds, minimapViewport, viewport.zoom]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes]);
  const minimapViewportOrigin = minimapPointFromWorld(minimapLayout, { x: minimapViewport.left, y: minimapViewport.top });
  const moveViewportFromMinimapPointer = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height || !stageSize.width || !stageSize.height) return;
    const mapPoint = {
      x: (event.clientX - rect.left) / rect.width * MINIMAP_WIDTH,
      y: (event.clientY - rect.top) / rect.height * MINIMAP_HEIGHT,
    };
    const worldPoint = worldPointFromMinimap(minimapLayout, mapPoint);
    wakeMinimap();
    setViewport(current => ({
      ...current,
      x: stageSize.width / 2 - worldPoint.x * current.zoom,
      y: stageSize.height / 2 - worldPoint.y * current.zoom,
    }));
  };

  return (
    <main
      className={`workflow-stage ${interaction?.kind === "pan" ? "is-panning" : ""}`}
      ref={stageRef}
      onPointerDown={onStagePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { if (interaction?.kind === "node") onMoveEnd(); setInteraction(null); }}
      onWheel={onWheel}
      style={{ backgroundSize: `${GRID * viewport.zoom}px ${GRID * viewport.zoom}px`, backgroundPosition: `${viewport.x}px ${viewport.y}px` }}
    >
      <div className="canvas-world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
        <svg className="rope-layer" viewBox="-5000 -5000 10000 10000" aria-hidden="true">
          {edges.map(edge => {
            const source = byId.get(edge.source);
            const target = byId.get(edge.target);
            if (!source || !target || (!visibleNodeIds.has(source.id) && !visibleNodeIds.has(target.id))) return null;
            const enabled = isWorkflowEdgeEnabled(edge);
            return (
              <path
                key={edge.id}
                className={`workflow-rope ${selection.edgeIds.includes(edge.id) ? "is-selected" : ""} ${enabled ? "" : "is-disabled"} ${bypassedNodeIds.has(edge.source) || bypassedNodeIds.has(edge.target) ? "is-bypassed" : ""}`}
                d={curve(nodeCenter(source, "out"), nodeCenter(target, "in"))}
                onPointerDown={event => onEdgePointerDown(event, edge.id)}
              />
            );
          })}
          {derivedBypassEdges.map(edge => {
            const source = byId.get(edge.source);
            const target = byId.get(edge.target);
            if (!source || !target || (!visibleNodeIds.has(source.id) && !visibleNodeIds.has(target.id))) return null;
            return <path key={edge.id} className="workflow-rope is-bypass-route" d={curve(nodeCenter(source, "out"), nodeCenter(target, "in"))} />;
          })}
          {draggingRope?.from && <path className="workflow-rope is-drawing" d={curve(nodeCenter(draggingRope.from, "out"), draggingRope.to)} />}
        </svg>
        {selectedEdge && selectedEdgeMidpoint && (
          <div className="rope-selection" style={{ left: selectedEdgeMidpoint.x, top: selectedEdgeMidpoint.y }}>
            <button
              className="rope-control"
              type="button"
              aria-label="Connection actions"
              aria-expanded={edgeActionsOpen}
              onPointerDown={event => event.stopPropagation()}
              onClick={() => setEdgeActionsOpen(open => !open)}
            >
              [•]
            </button>
            {edgeActionsOpen && (
              <div className="rope-actions" onPointerDown={event => event.stopPropagation()}>
                <button type="button" onClick={() => { onToggleEdge(selectedEdge.id); setEdgeActionsOpen(false); }}>
                  <Power size={13} /> {isWorkflowEdgeEnabled(selectedEdge) ? "Disable" : "Enable"}
                </button>
                <button type="button" className="danger" onClick={() => { onDeleteEdge(selectedEdge.id); setEdgeActionsOpen(false); }}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
        {visibleNodes.map(node => (
          (() => {
            const nodeExecution = execution[node.id] ?? Object.values(execution).find(record => record.agentNodeId === node.id);
            return (
          <WorkflowNode
            key={node.id}
            node={node}
            selected={selection.nodeIds.includes(node.id)}
            onNodePointerDown={onNodePointerDown}
            onPortPointerDown={onPortPointerDown}
            onAction={onNodeAction}
            onConfigChange={onConfigChange}
            execution={nodeExecution}
            onExecutionAction={onExecutionAction}
            onDocumentUpload={onDocumentUpload}
            isDocumentUploading={uploadingDocumentId === node.id}
            documentError={documentErrors[node.id]}
            safeStatus={agentStatuses[node.id]}
            onRequestNodeProposal={onRequestNodeProposal}
            isRequestingProposal={requestingProposalNodeId === node.id}
          />
            );
          })()
        ))}
      </div>

      {marquee && <div className="marquee" style={marquee} />}
      <div
        className={`workflow-minimap ${minimapActive ? "is-active" : ""}`}
        aria-label="Workflow overview. Click or drag to navigate the canvas."
        role="navigation"
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.stopPropagation();
          minimapPointerId.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveViewportFromMinimapPointer(event);
        }}
        onPointerMove={event => {
          if (minimapPointerId.current === event.pointerId) moveViewportFromMinimapPointer(event);
        }}
        onPointerUp={event => {
          if (minimapPointerId.current === event.pointerId) minimapPointerId.current = undefined;
        }}
        onPointerCancel={() => { minimapPointerId.current = undefined; }}
      >
        <svg viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`} aria-hidden="true">
          {edges.map(edge => {
            const source = byId.get(edge.source);
            const target = byId.get(edge.target);
            if (!source || !target) return null;
            const from = minimapPointFromWorld(minimapLayout, nodeCenter(source, "out"));
            const to = minimapPointFromWorld(minimapLayout, nodeCenter(target, "in"));
            return <line key={edge.id} className={`minimap-rope ${isWorkflowEdgeEnabled(edge) ? "" : "is-disabled"}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
          })}
          {nodes.map(node => {
            const position = minimapPointFromWorld(minimapLayout, node.position);
            const dimensions = getNodeDimensions(node);
            return <rect key={node.id} className={`minimap-node ${selection.nodeIds.includes(node.id) ? "is-selected" : ""}`} x={position.x} y={position.y} width={Math.max(3, dimensions.width * minimapLayout.scale)} height={Math.max(3, dimensions.height * minimapLayout.scale)} rx="1.5" />;
          })}
          <rect className="minimap-viewport" x={minimapViewportOrigin.x} y={minimapViewportOrigin.y} width={Math.max(5, minimapViewport.width * minimapLayout.scale)} height={Math.max(5, minimapViewport.height * minimapLayout.scale)} rx="1.5" />
        </svg>
      </div>
      <div className="canvas-axis axis-x"><span>X</span><i /></div>
      <div className="canvas-axis axis-y"><span>Y</span><i /></div>
      <div className="canvas-hud"><MousePointer2 size={13} /><span>{selection.nodeIds.length ? `${selection.nodeIds.length} SELECTED` : selection.edgeIds.length ? "CONNECTION SELECTED" : "CANVAS READY"}</span></div>
      <div className="canvas-controls" onPointerDown={event => event.stopPropagation()}>
        <button onClick={() => { wakeMinimap(); setViewport(current => ({ ...current, zoom: clamp(current.zoom - 0.1, 0.3, 2.3) })); }} aria-label="Zoom out"><Minus size={15} /></button>
        <button className="zoom-readout" onClick={() => { wakeMinimap(); setViewport(current => ({ ...current, zoom: 1 })); }}>{Math.round(viewport.zoom * 100)}%</button>
        <button onClick={() => { wakeMinimap(); setViewport(current => ({ ...current, zoom: clamp(current.zoom + 0.1, 0.3, 2.3) })); }} aria-label="Zoom in"><Plus size={15} /></button>
        <span />
        <button onClick={() => { wakeMinimap(); setViewport(getDefaultViewport()); }} aria-label="Reset canvas"><Scan size={15} /></button>
      </div>
    </main>
  );
}
