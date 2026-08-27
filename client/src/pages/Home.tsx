import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { AgentRunResult } from "@shared/execution";
import { WorkflowCanvas } from "../features/canvas/WorkflowCanvas";
import { TunnelTargetPicker } from "../features/documents/TunnelTargetPicker";
import { executionReducer, ExecutionState } from "../features/execution/executionState";
import { LocalExecutionStorageAdapter } from "../features/execution/storage";
import { RawDataView } from "../features/inspection/RawDataView";
import { LeftPanel } from "../features/panels/LeftPanel";
import { Appearance, TopPanel } from "../features/panels/TopPanel";
import { RightPanel } from "../features/panels/RightPanel";
import { LocalWorkflowStorageAdapter } from "../features/workflow/storage";
import { createDocumentTunnel, createInitialWorkflow, createNode, createWorkflowEdge, DocumentFile, NodeConfiguration, NodeType, WorkflowNode } from "../features/workflow/types";
import { workflowReducer } from "../features/workflow/workflowReducer";

const storage = new LocalWorkflowStorageAdapter();
const executionStorage = new LocalExecutionStorageAdapter();
const nextNodeIndex = (nodes: WorkflowNode[]) => Math.max(0, ...nodes.map(node => node.index)) + 1;
const createRunId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function Home() {
  const [workflow, dispatch] = useReducer(workflowReducer, undefined, () => createInitialWorkflow());
  const [execution, dispatchExecution] = useReducer(executionReducer, {} as ExecutionState);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [topOpen, setTopOpen] = useState(true);
  const [rawNodeId, setRawNodeId] = useState<string>();
  const [tunnelSourceNodeId, setTunnelSourceNodeId] = useState<string>();
  const [uploadingDocumentId, setUploadingDocumentId] = useState<string>();
  const [documentErrors, setDocumentErrors] = useState<Record<string, string | undefined>>({});
  const [appearance, setAppearance] = useState<Appearance>(() => (localStorage.getItem("articulate:appearance") as Appearance) || "system");
  const clipboard = useRef<WorkflowNode[]>([]);
  const pasteCount = useRef(0);
  const runMutation = trpc.execution.run.useMutation();
  const pauseMutation = trpc.execution.pause.useMutation();
  const resumeMutation = trpc.execution.resume.useMutation();

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
    let mounted = true;
    executionStorage.load().then(records => {
      if (mounted) dispatchExecution({ type: "hydrate", records });
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const saveTimer = window.setTimeout(() => { storage.save(workflow); }, 250);
    return () => window.clearTimeout(saveTimer);
  }, [workflow]);

  useEffect(() => {
    const saveTimer = window.setTimeout(() => { executionStorage.save(execution); }, 250);
    return () => window.clearTimeout(saveTimer);
  }, [execution]);

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

  const onNodeAction = (nodeId: string, action: "delete" | "duplicate" | "configure" | "toggle-lock" | "toggle-bypass" | "toggle-disable" | "view-raw" | "tunnel") => {
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
    if (action === "view-raw") {
      dispatch({ type: "set-selection", selection: { nodeIds: [nodeId], edgeIds: [] } });
      setRawNodeId(nodeId);
    }
    if (action === "tunnel" && node.type === "document") setTunnelSourceNodeId(nodeId);
  };

  const rawNode = rawNodeId ? workflow.nodes.find(node => node.id === rawNodeId) : undefined;
  const tunnelSourceNode = tunnelSourceNodeId ? workflow.nodes.find(node => node.id === tunnelSourceNodeId && node.type === "document") : undefined;

  const onConfigChange = (nodeId: string, config: Partial<NodeConfiguration>) => {
    dispatch({ type: "update-node", nodeId, patch: { config } });
  };

  const onDocumentUpload = async (nodeId: string, files: File[]) => {
    const node = workflow.nodes.find(candidate => candidate.id === nodeId);
    if (!node || node.type !== "document") return;
    setUploadingDocumentId(nodeId);
    setDocumentErrors(errors => ({ ...errors, [nodeId]: undefined }));
    try {
      const uploaded: DocumentFile[] = [];
      for (const file of files) {
        const response = await fetch("/api/documents/upload", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": file.type || "application/octet-stream", "X-Document-Name": encodeURIComponent(file.name) },
          body: file,
        });
        const payload = await response.json() as { file?: DocumentFile; error?: string };
        if (!response.ok || !payload.file) throw new Error(payload.error ?? `Unable to upload ${file.name}.`);
        uploaded.push(payload.file);
      }
      const existing = (node.config.files as DocumentFile[] | undefined) ?? [];
      dispatch({ type: "update-node", nodeId, patch: { config: { files: [...existing, ...uploaded] } } });
    } catch (error) {
      setDocumentErrors(errors => ({ ...errors, [nodeId]: error instanceof Error ? error.message : "Unable to upload this document." }));
    } finally {
      setUploadingDocumentId(undefined);
    }
  };

  const onTunnelDocuments = (targetNodeId: string, fileIds: string[]) => {
    if (!tunnelSourceNode) return;
    const existing = tunnelSourceNode.config.tunnels ?? [];
    const tunnels = fileIds.map(fileId => createDocumentTunnel(tunnelSourceNode.id, fileId, targetNodeId));
    dispatch({ type: "update-node", nodeId: tunnelSourceNode.id, patch: { config: { tunnels: [...existing, ...tunnels] } } });
    tunnels.forEach(tunnel => dispatch({ type: "add-edge", edge: createWorkflowEdge({ id: tunnel.id, source: tunnel.sourceNodeId, target: tunnel.targetNodeId, sourcePort: "out", targetPort: "in", metadata: { tunnel: true, documentId: tunnel.documentId, label: "Document tunnel" } }) }));
    setTunnelSourceNodeId(undefined);
  };

  const findConnectedAgent = (inputNodeId: string) => {
    const visited = new Set<string>();
    const queue = [inputNodeId];
    while (queue.length) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const nextEdges = workflow.edges.filter(edge => edge.enabled !== false && edge.source === nodeId);
      for (const edge of nextEdges) {
        const node = workflow.nodes.find(candidate => candidate.id === edge.target);
        if (!node) continue;
        if (node.type === "ai-agent" && !node.bypassed) return node;
        queue.push(node.id);
      }
    }
    return undefined;
  };

  const findConnectedOutput = (agentNodeId: string) => {
    const visited = new Set<string>();
    const queue = [agentNodeId];
    while (queue.length) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const nextEdges = workflow.edges.filter(edge => edge.enabled !== false && edge.source === nodeId);
      for (const edge of nextEdges) {
        const node = workflow.nodes.find(candidate => candidate.id === edge.target);
        if (!node) continue;
        if (node.type === "output") return node;
        queue.push(node.id);
      }
    }
    return undefined;
  };

  const showExecutionOutput = (agentNodeId: string, output: string) => {
    const existingOutput = findConnectedOutput(agentNodeId);
    if (existingOutput) {
      dispatch({ type: "update-node", nodeId: existingOutput.id, patch: { config: { summary: output } } });
      return;
    }
    const agent = workflow.nodes.find(node => node.id === agentNodeId);
    if (!agent) return;
    const newOutput = createNode(
      "output",
      { x: agent.position.x + 410, y: agent.position.y },
      nextNodeIndex(workflow.nodes),
      { config: { summary: output } },
    );
    dispatch({ type: "add-nodes", nodes: [newOutput], select: false });
    dispatch({
      type: "add-edge",
      edge: createWorkflowEdge({
        id: `execution-output-${Date.now()}-${newOutput.id}`,
        source: agentNodeId,
        target: newOutput.id,
        sourcePort: "out",
        targetPort: "in",
      }),
    });
  };

  const settleExecution = (inputNodeId: string, agentNodeId: string, result: AgentRunResult) => {
    dispatchExecution({
      type: "settle",
      inputNodeId,
      result: { runId: result.runId, agentNodeId, status: result.status, error: result.error },
    });
    if (result.status === "completed" && result.output) showExecutionOutput(agentNodeId, result.output);
  };

  const onExecutionAction = async (inputNodeId: string, action: "run" | "pause" | "resume" | "retry") => {
    const input = workflow.nodes.find(node => node.id === inputNodeId);
    if (!input) return;
    const active = execution[inputNodeId];

    if (action === "pause") {
      if (!active?.runId) return;
      try {
        settleExecution(inputNodeId, active.agentNodeId ?? "", await pauseMutation.mutateAsync({ runId: active.runId }));
      } catch (error) {
        dispatchExecution({ type: "fail", inputNodeId, error: error instanceof Error ? error.message : "Unable to pause the AI Agent." });
      }
      return;
    }
    if (action === "resume") {
      if (!active?.runId || !active.agentNodeId) return;
      dispatchExecution({ type: "start", inputNodeId, agentNodeId: active.agentNodeId, runId: active.runId, status: "running" });
      try {
        settleExecution(inputNodeId, active.agentNodeId, await resumeMutation.mutateAsync({ runId: active.runId }));
      } catch (error) {
        dispatchExecution({ type: "fail", inputNodeId, error: error instanceof Error ? error.message : "Unable to resume the AI Agent." });
      }
      return;
    }

    const agent = findConnectedAgent(inputNodeId);
    if (!agent) {
      dispatchExecution({ type: "fail", inputNodeId, error: "Connect this Input to an active AI Agent before running." });
      return;
    }
    if (agent.disabled) {
      dispatchExecution({ type: "fail", inputNodeId, error: "The connected AI Agent is disabled." });
      return;
    }
    const runId = createRunId();
    dispatchExecution({ type: "start", inputNodeId, agentNodeId: agent.id, runId, status: action === "retry" ? "retrying" : "running" });
    try {
      const result = await runMutation.mutateAsync({
        runId,
        inputNodeId,
        agentNodeId: agent.id,
        prompt: String(input.config.prompt ?? ""),
        model: String(agent.config.model ?? "Manus 1.6"),
        provider: String(agent.config.provider ?? "Manus"),
        retry: action === "retry",
      });
      settleExecution(inputNodeId, agent.id, result);
    } catch (error) {
      dispatchExecution({ type: "fail", inputNodeId, error: error instanceof Error ? error.message : "Unable to start the AI Agent." });
    }
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
        execution={execution}
        onExecutionAction={onExecutionAction}
        onDocumentUpload={onDocumentUpload}
        uploadingDocumentId={uploadingDocumentId}
        documentErrors={documentErrors}
      />
      <LeftPanel open={leftOpen} onToggle={() => setLeftOpen(open => !open)} onAddNode={addNode} onCopy={copySelection} canCopy={selectedNodes.length > 0} />
      <RightPanel open={rightOpen} node={selectedNode} execution={execution} nodes={workflow.nodes} onToggle={() => setRightOpen(open => !open)} onConfigChange={onConfigChange} />
      <TopPanel open={topOpen} appearance={appearance} onToggle={() => setTopOpen(open => !open)} onAppearanceChange={setAppearance} onPaste={pasteSelection} canPaste={clipboard.current.length > 0} />
      <div className="shortcut-strip"><span><kbd>SPACE + DRAG</kbd> PAN</span><span><kbd>SHIFT + DRAG</kbd> SELECT</span><span><kbd>⌘/CTRL C/V</kbd> COPY / PASTE</span></div>
      {rawNode && <RawDataView workflow={workflow} node={rawNode} onClose={() => setRawNodeId(undefined)} />}
      {tunnelSourceNode && <TunnelTargetPicker source={tunnelSourceNode} nodes={workflow.nodes} onConfirm={onTunnelDocuments} onClose={() => setTunnelSourceNodeId(undefined)} />}
    </div>
  );
}
