import { Minus, MousePointer2, Plus, Scan } from "lucide-react";
import { PointerEvent, WheelEvent, useMemo, useRef, useState } from "react";
import { WorkflowNode } from "../nodes/WorkflowNode";
import { GraphPosition, NodeConfiguration, WorkflowEdge, WorkflowNode as WorkflowNodeData, WorkflowSelection } from "../workflow/types";

type NodeAction = "delete" | "duplicate" | "configure" | "toggle-lock";

type CanvasProps = {
  nodes: WorkflowNodeData[];
  edges: WorkflowEdge[];
  selection: WorkflowSelection;
  onSelectionChange: (selection: WorkflowSelection) => void;
  onMoveNodes: (positions: Record<string, GraphPosition>) => void;
  onAddEdge: (edge: WorkflowEdge) => void;
  onNodeAction: (nodeId: string, action: NodeAction) => void;
  onConfigChange: (nodeId: string, config: Partial<NodeConfiguration>) => void;
};

type Viewport = { x: number; y: number; zoom: number };
type Interaction =
  | { kind: "pan"; start: { x: number; y: number }; viewport: Viewport; moved: boolean }
  | { kind: "marquee"; start: { x: number; y: number }; current: { x: number; y: number } }
  | { kind: "node"; start: { x: number; y: number }; positions: Record<string, GraphPosition> }
  | { kind: "connect"; source: string; current: { x: number; y: number } }
  | null;

const GRID = 20;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));
const snap = (value: number) => Math.round(value / GRID) * GRID;
const getDefaultViewport = (): Viewport =>
  typeof window !== "undefined" && window.innerWidth <= 600
    ? { x: 255, y: 330, zoom: 0.45 }
    : { x: 760, y: 370, zoom: 1 };

function curve(from: GraphPosition, to: GraphPosition) {
  const bow = Math.max(70, Math.abs(to.x - from.x) * 0.42);
  return `M ${from.x} ${from.y} C ${from.x + bow} ${from.y}, ${to.x - bow} ${to.y}, ${to.x} ${to.y}`;
}

function nodeCenter(node: WorkflowNodeData, direction: "in" | "out"): GraphPosition {
  const height = node.type === "input"
    ? 150 + Math.max(3, Math.min(9, Math.ceil(String(node.config.prompt ?? "").length / 37) + String(node.config.prompt ?? "").split("\n").length - 1)) * 18
    : node.type === "ai-agent" ? 188 : 142;
  const width = node.type === "input" ? 316 : node.type === "ai-agent" ? 302 : 272;
  return { x: node.position.x + (direction === "out" ? width : 0), y: node.position.y + height / 2 };
}

export function WorkflowCanvas({
  nodes,
  edges,
  selection,
  onSelectionChange,
  onMoveNodes,
  onAddEdge,
  onNodeAction,
  onConfigChange,
}: CanvasProps) {
  const [viewport, setViewport] = useState<Viewport>(getDefaultViewport);
  const [interaction, setInteraction] = useState<Interaction>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
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

  const onStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest("[data-node-id], [data-port-node-id], .canvas-controls")) return;
    if (event.button !== 0 && event.button !== 1) return;
    const point = getStagePoint(event);
    stageRef.current?.setPointerCapture(event.pointerId);
    if (event.shiftKey && event.button === 0) {
      setInteraction({ kind: "marquee", start: point, current: point });
    } else {
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
    const nodeIds = event.shiftKey
      ? wasSelected ? selection.nodeIds.filter(id => id !== nodeId) : [...selection.nodeIds, nodeId]
      : wasSelected ? selection.nodeIds : [nodeId];
    onSelectionChange({ nodeIds, edgeIds: [] });
    if (node.locked) return;
    const positions = Object.fromEntries(
      nodes.filter(candidate => nodeIds.includes(candidate.id)).map(candidate => [candidate.id, { ...candidate.position }]),
    );
    stageRef.current?.setPointerCapture(event.pointerId);
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
      const delta = { x: point.x - interaction.start.x, y: point.y - interaction.start.y };
      setViewport({ ...interaction.viewport, x: interaction.viewport.x + delta.x, y: interaction.viewport.y + delta.y });
      setInteraction({ ...interaction, moved: interaction.moved || Math.hypot(delta.x, delta.y) > 3 });
    }
    if (interaction.kind === "marquee") setInteraction({ ...interaction, current: point });
    if (interaction.kind === "node") {
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
    if (interaction.kind === "connect") {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-port-node-id]") as HTMLElement | null;
      const targetId = target?.dataset.portNodeId;
      const targetDirection = target?.dataset.portDirection;
      if (targetId && targetDirection === "in" && targetId !== interaction.source) {
        onAddEdge({
          id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `edge-${Date.now()}`,
          source: interaction.source,
          target: targetId,
          sourcePort: "out",
          targetPort: "in",
        });
      }
    }
    setInteraction(null);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const point = getStagePoint(event);
    const nextZoom = clamp(viewport.zoom * Math.exp(-event.deltaY * 0.0015), 0.3, 2.3);
    const ratio = nextZoom / viewport.zoom;
    setViewport({ x: point.x - (point.x - viewport.x) * ratio, y: point.y - (point.y - viewport.y) * ratio, zoom: nextZoom });
  };

  const marquee = interaction?.kind === "marquee"
    ? { left: Math.min(interaction.start.x, interaction.current.x), top: Math.min(interaction.start.y, interaction.current.y), width: Math.abs(interaction.current.x - interaction.start.x), height: Math.abs(interaction.current.y - interaction.start.y) }
    : null;
  const draggingRope = interaction?.kind === "connect" ? { from: byId.get(interaction.source), to: interaction.current } : null;

  return (
    <main
      className={`workflow-stage ${interaction?.kind === "pan" ? "is-panning" : ""}`}
      ref={stageRef}
      onPointerDown={onStagePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setInteraction(null)}
      onWheel={onWheel}
      style={{ backgroundSize: `${GRID * viewport.zoom}px ${GRID * viewport.zoom}px`, backgroundPosition: `${viewport.x}px ${viewport.y}px` }}
    >
      <div className="canvas-world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
        <svg className="rope-layer" viewBox="-5000 -5000 10000 10000" aria-hidden="true">
          {edges.map(edge => {
            const source = byId.get(edge.source);
            const target = byId.get(edge.target);
            if (!source || !target) return null;
            return <path key={edge.id} className="workflow-rope" d={curve(nodeCenter(source, "out"), nodeCenter(target, "in"))} />;
          })}
          {draggingRope?.from && <path className="workflow-rope is-drawing" d={curve(nodeCenter(draggingRope.from, "out"), draggingRope.to)} />}
        </svg>
        {nodes.map(node => (
          <WorkflowNode
            key={node.id}
            node={node}
            selected={selection.nodeIds.includes(node.id)}
            onNodePointerDown={onNodePointerDown}
            onPortPointerDown={onPortPointerDown}
            onAction={onNodeAction}
            onConfigChange={onConfigChange}
          />
        ))}
      </div>

      {marquee && <div className="marquee" style={marquee} />}
      <div className="canvas-axis axis-x"><span>X</span><i /></div>
      <div className="canvas-axis axis-y"><span>Y</span><i /></div>
      <div className="canvas-hud"><MousePointer2 size={13} /><span>{selection.nodeIds.length ? `${selection.nodeIds.length} SELECTED` : "CANVAS READY"}</span></div>
      <div className="canvas-controls" onPointerDown={event => event.stopPropagation()}>
        <button onClick={() => setViewport(current => ({ ...current, zoom: clamp(current.zoom - 0.1, 0.3, 2.3) }))} aria-label="Zoom out"><Minus size={15} /></button>
        <button className="zoom-readout" onClick={() => setViewport(current => ({ ...current, zoom: 1 }))}>{Math.round(viewport.zoom * 100)}%</button>
        <button onClick={() => setViewport(current => ({ ...current, zoom: clamp(current.zoom + 0.1, 0.3, 2.3) }))} aria-label="Zoom in"><Plus size={15} /></button>
        <span />
        <button onClick={() => setViewport(getDefaultViewport())} aria-label="Reset canvas"><Scan size={15} /></button>
      </div>
    </main>
  );
}
