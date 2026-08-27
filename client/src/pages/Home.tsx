import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { WorkflowCanvas } from "../features/canvas/WorkflowCanvas";
import { LeftPanel } from "../features/panels/LeftPanel";
import { Appearance, TopPanel } from "../features/panels/TopPanel";
import { RightPanel } from "../features/panels/RightPanel";
import { LocalWorkflowStorageAdapter } from "../features/workflow/storage";
import { createInitialWorkflow, createNode, NodeConfiguration, NodeType, WorkflowNode } from "../features/workflow/types";
import { workflowReducer } from "../features/workflow/workflowReducer";

const storage = new LocalWorkflowStorageAdapter();
const nextNodeIndex = (nodes: WorkflowNode[]) => Math.max(0, ...nodes.map(node => node.index)) + 1;

export default function Home() {
  const [workflow, dispatch] = useReducer(workflowReducer, undefined, () => createInitialWorkflow());
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [topOpen, setTopOpen] = useState(true);
  const [appearance, setAppearance] = useState<Appearance>(() => (localStorage.getItem("articulate:appearance") as Appearance) || "system");
  const clipboard = useRef<WorkflowNode[]>([]);
  const pasteCount = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    localStorage.setItem("articulate:appearance", appearance);
  }, [appearance]);

  useEffect(() => {
    let mounted = true;
    storage.load("local-articulate-workflow").then(saved => {
      if (mounted && saved) dispatch({ type: "replace", workflow: saved });
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const saveTimer = window.setTimeout(() => { storage.save(workflow); }, 250);
    return () => window.clearTimeout(saveTimer);
  }, [workflow]);

  const selectedNodes = useMemo(
    () => workflow.nodes.filter(node => workflow.selection.nodeIds.includes(node.id)),
    [workflow.nodes, workflow.selection.nodeIds],
  );
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined;

  const addNode = useCallback((type: NodeType) => {
    const count = workflow.nodes.length;
    const node = createNode(type, { x: -30 + (count % 3) * 60, y: 180 + (count % 2) * 80 }, nextNodeIndex(workflow.nodes));
    dispatch({ type: "add-nodes", nodes: [node], select: true });
    setRightOpen(true);
  }, [workflow.nodes]);

  const duplicateNodes = useCallback((nodes: WorkflowNode[]) => {
    if (!nodes.length) return;
    pasteCount.current += 1;
    const offset = 36 + pasteCount.current * 8;
    const copies = nodes.map((node, index) => createNode(node.type, { x: node.position.x + offset, y: node.position.y + offset }, nextNodeIndex(workflow.nodes) + index, {
      title: node.title,
      config: { ...node.config },
      locked: false,
    }));
    dispatch({ type: "add-nodes", nodes: copies, select: true });
  }, [workflow.nodes]);

  const copySelection = useCallback(() => {
    if (!selectedNodes.length) return;
    clipboard.current = selectedNodes.map(node => ({ ...node, position: { ...node.position }, config: { ...node.config } }));
    navigator.clipboard?.writeText(JSON.stringify({ kind: "articulate-nodes", nodes: clipboard.current })).catch(() => undefined);
  }, [selectedNodes]);

  const pasteSelection = useCallback(() => duplicateNodes(clipboard.current), [duplicateNodes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const shortcut = event.metaKey || event.ctrlKey;
      if (shortcut && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelection();
      }
      if (shortcut && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteSelection();
      }
      if ((event.key === "Backspace" || event.key === "Delete") && workflow.selection.nodeIds.length) {
        event.preventDefault();
        dispatch({ type: "delete-nodes", nodeIds: workflow.selection.nodeIds });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copySelection, pasteSelection, workflow.selection.nodeIds]);

  const onNodeAction = (nodeId: string, action: "delete" | "duplicate" | "configure" | "toggle-lock" | "toggle-bypass" | "toggle-disable") => {
    const node = workflow.nodes.find(candidate => candidate.id === nodeId);
    if (!node) return;
    if (action === "delete") dispatch({ type: "delete-nodes", nodeIds: [nodeId] });
    if (action === "duplicate") duplicateNodes([node]);
    if (action === "configure") {
      dispatch({ type: "set-selection", selection: { nodeIds: [nodeId], edgeIds: [] } });
      setRightOpen(true);
    }
    if (action === "toggle-lock") dispatch({ type: "toggle-lock", nodeId });
    if (action === "toggle-bypass") dispatch({ type: "toggle-bypass", nodeId });
    if (action === "toggle-disable") dispatch({ type: "toggle-disable", nodeId });
  };

  const onConfigChange = (nodeId: string, config: Partial<NodeConfiguration>) => {
    dispatch({ type: "update-node", nodeId, patch: { config } });
  };

  return (
    <div className="articulate-shell" data-appearance={appearance}>
      <WorkflowCanvas
        nodes={workflow.nodes}
        edges={workflow.edges}
        selection={workflow.selection}
        onSelectionChange={selection => dispatch({ type: "set-selection", selection })}
        onMoveNodes={positions => dispatch({ type: "move-nodes", positions })}
        onAddEdge={edge => dispatch({ type: "add-edge", edge })}
        onToggleEdge={edgeId => dispatch({ type: "toggle-edge", edgeId })}
        onDeleteEdge={edgeId => dispatch({ type: "delete-edge", edgeId })}
        onNodeAction={onNodeAction}
        onConfigChange={onConfigChange}
      />
      <LeftPanel open={leftOpen} onToggle={() => setLeftOpen(open => !open)} onAddNode={addNode} onCopy={copySelection} canCopy={selectedNodes.length > 0} />
      <RightPanel open={rightOpen} node={selectedNode} onToggle={() => setRightOpen(open => !open)} onConfigChange={onConfigChange} />
      <TopPanel open={topOpen} appearance={appearance} onToggle={() => setTopOpen(open => !open)} onAppearanceChange={setAppearance} onPaste={pasteSelection} canPaste={clipboard.current.length > 0} />
      <div className="shortcut-strip"><span><kbd>SPACE + DRAG</kbd> PAN</span><span><kbd>SHIFT + DRAG</kbd> SELECT</span><span><kbd>⌘/CTRL C/V</kbd> COPY / PASTE</span></div>
    </div>
  );
}
