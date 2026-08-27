export type NodeType =
  | "ai-agent"
  | "input"
  | "context"
  | "output"
  | "memory"
  | "document"
  | "format"
  | "split"
  | "blank";

export type DocumentFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  storageUrl: string;
  uploadedAt: number;
};

export type DocumentTunnel = {
  id: string;
  documentId: string;
  sourceNodeId: string;
  targetNodeId: string;
  createdAt: number;
};

export type NodeConfiguration = {
  prompt?: string;
  model?: string;
  provider?: string;
  apiKeyAvailable?: boolean;
  files?: DocumentFile[];
  tunnels?: DocumentTunnel[];
  formatInstruction?: string;
  splitOutputs?: string[];
  blankContent?: string;
  [key: string]: string | boolean | string[] | DocumentFile[] | DocumentTunnel[] | undefined;
};

export type GraphPosition = { x: number; y: number };

export type WorkflowNode = {
  id: string;
  index: number;
  type: NodeType;
  title: string;
  position: GraphPosition;
  locked: boolean;
  /** Bypassed nodes remain in the graph while effective workflow routing flows around them. */
  bypassed: boolean;
  /** Disabled nodes remain in the graph but block execution when execution is introduced. */
  disabled: boolean;
  config: NodeConfiguration;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourcePort: "out";
  targetPort: "in";
  /** A disabled edge stays in the workflow but does not contribute downstream information. */
  enabled: boolean;
  /** Reserved for execution routing without changing the core connection shape. */
  mode: "standard" | "conditional" | "temporary";
  metadata?: {
    condition?: string;
    label?: string;
    expiresAt?: number;
    viaNodeId?: string;
    derived?: boolean;
    documentId?: string;
    tunnel?: boolean;
    selectedExecution?: boolean;
    groupId?: string;
  };
};

export type WorkflowSelection = {
  nodeIds: string[];
  edgeIds: string[];
};

export type WorkflowGroup = {
  id: string;
  nodeIds: string[];
  locked: boolean;
  createdAt: number;
};

export type WorkflowState = {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups: WorkflowGroup[];
  selection: WorkflowSelection;
  updatedAt: number;
};

/**
 * Brings local, imported, and older workflow snapshots to the current graph contract.
 * It preserves valid graph data while removing references that cannot resolve inside
 * the snapshot, so later editor operations never need to trust unvalidated storage.
 */
export function normalizeWorkflow(workflow: WorkflowState | Partial<WorkflowState>): WorkflowState {
  const rawNodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const nodeIds = new Set<string>();
  const usedIndexes = new Set<number>();
  let nextIndex = 1;
  const nodes = rawNodes.filter((node): node is WorkflowNode => {
    const valid = Boolean(node?.id && node?.type && Object.prototype.hasOwnProperty.call(nodeCatalog, node.type) && !nodeIds.has(node.id));
    if (valid) nodeIds.add(node.id);
    return valid;
  }).map(node => {
    const originalIndex = Number(node.index);
    while (usedIndexes.has(nextIndex)) nextIndex += 1;
    const index = Number.isInteger(originalIndex) && originalIndex > 0 && !usedIndexes.has(originalIndex)
      ? originalIndex
      : nextIndex;
    usedIndexes.add(index);
    return {
      ...node,
      index,
      position: node.position && Number.isFinite(node.position.x) && Number.isFinite(node.position.y) ? node.position : { x: 0, y: 0 },
      config: node.config ?? {},
      locked: node.locked ?? false,
      bypassed: node.bypassed ?? false,
      disabled: node.disabled ?? false,
    };
  });
  const edges = (Array.isArray(workflow.edges) ? workflow.edges : [])
    .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map(edge => createWorkflowEdge(edge));
  const edgeIds = new Set(edges.map(edge => edge.id));
  const groupedNodeIds = new Set<string>();
  const groups = (Array.isArray(workflow.groups) ? workflow.groups : []).flatMap(group => {
    const nodeIdsInGroup = Array.from(new Set(group.nodeIds ?? [])).filter(nodeId => nodeIds.has(nodeId) && !groupedNodeIds.has(nodeId));
    nodeIdsInGroup.forEach(nodeId => groupedNodeIds.add(nodeId));
    return nodeIdsInGroup.length > 1
      ? [{ ...group, nodeIds: nodeIdsInGroup, locked: group.locked ?? false, createdAt: group.createdAt ?? Date.now() }]
      : [];
  });
  return {
    id: workflow.id || "local-articulate-workflow",
    name: workflow.name?.trim() || "Untitled workflow",
    nodes,
    edges,
    groups,
    selection: {
      nodeIds: Array.from(new Set(workflow.selection?.nodeIds ?? [])).filter(nodeId => nodeIds.has(nodeId)),
      edgeIds: Array.from(new Set(workflow.selection?.edgeIds ?? [])).filter(edgeId => edgeIds.has(edgeId)),
    },
    updatedAt: Number.isFinite(workflow.updatedAt) ? workflow.updatedAt! : Date.now(),
  };
}

export type NodeCatalogItem = {
  label: string;
  eyebrow: string;
  description: string;
};

export const nodeCatalog: Record<NodeType, NodeCatalogItem> = {
  "ai-agent": {
    label: "AI Agent",
    eyebrow: "INTELLIGENCE",
    description: "Configure a model-backed reasoning step.",
  },
  input: {
    label: "Input",
    eyebrow: "SOURCE",
    description: "Capture a prompt or workflow instruction.",
  },
  context: {
    label: "Context",
    eyebrow: "REFERENCE",
    description: "Provide supporting material to later nodes.",
  },
  output: {
    label: "Output",
    eyebrow: "DESTINATION",
    description: "Present a workflow result.",
  },
  memory: {
    label: "Memory",
    eyebrow: "STATE",
    description: "Retain structured context between steps.",
  },
  document: {
    label: "Document",
    eyebrow: "ASSET",
    description: "Attach a source document in a later phase.",
  },
  format: {
    label: "Format",
    eyebrow: "TRANSFORM",
    description: "Specify the shape of a downstream response.",
  },
  split: {
    label: "Split",
    eyebrow: "ROUTE",
    description: "Branch information into multiple paths.",
  },
  blank: {
    label: "Blank",
    eyebrow: "NOTE",
    description: "Write freeform information for the workflow.",
  },
};

const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function createWorkflowEdge(
  edge: Pick<WorkflowEdge, "id" | "source" | "target" | "sourcePort" | "targetPort"> & Partial<Pick<WorkflowEdge, "enabled" | "mode" | "metadata">>,
): WorkflowEdge {
  return {
    ...edge,
    enabled: edge.enabled ?? true,
    mode: edge.mode ?? "standard",
  };
}

export function createNodeGroup(id: string, nodeIds: string[]): WorkflowGroup {
  return { id, nodeIds: Array.from(new Set(nodeIds)), locked: false, createdAt: Date.now() };
}

export function getWorkflowGroupForNode(workflow: WorkflowState, nodeId: string) {
  return (workflow.groups ?? []).find(group => group.nodeIds.includes(nodeId));
}

export function createSelectedExecutionEdges(workflow: WorkflowState, nodeIds: string[], executionId: string) {
  const selected = workflow.nodes
    .filter(node => nodeIds.includes(node.id))
    .sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y);
  return selected.slice(0, -1).map((node, index) => createWorkflowEdge({
    id: `selected-execution:${executionId}:${index}`,
    source: node.id,
    target: selected[index + 1]!.id,
    sourcePort: "out",
    targetPort: "in",
    mode: "temporary",
    metadata: { label: "Selected execution", selectedExecution: true, groupId: executionId },
  }));
}

export function createDocumentTunnel(
  sourceNodeId: string,
  documentId: string,
  targetNodeId: string,
): DocumentTunnel {
  return {
    id: `tunnel-${id()}`,
    documentId,
    sourceNodeId,
    targetNodeId,
    createdAt: Date.now(),
  };
}

export function getTunneledDocuments(workflow: WorkflowState, targetNodeId: string): DocumentFile[] {
  return workflow.nodes
    .filter(node => node.type === "document")
    .flatMap(node => {
      const files = (node.config.files as DocumentFile[] | undefined) ?? [];
      const tunnels = (node.config.tunnels as DocumentTunnel[] | undefined) ?? [];
      const sentIds = new Set(tunnels.filter(tunnel => tunnel.targetNodeId === targetNodeId).map(tunnel => tunnel.documentId));
      return files.filter(file => sentIds.has(file.id));
    });
}

export function isWorkflowEdgeEnabled(edge: Pick<WorkflowEdge, "enabled"> | { enabled?: boolean }) {
  return edge.enabled !== false;
}

export function isWorkflowNodeBypassed(node: Pick<WorkflowNode, "bypassed"> | { bypassed?: boolean }) {
  return node.bypassed === true;
}

export function isWorkflowNodeDisabled(node: Pick<WorkflowNode, "disabled"> | { disabled?: boolean }) {
  return node.disabled === true;
}

export function getDerivedBypassEdges(workflow: WorkflowState): WorkflowEdge[] {
  const routableEdges = workflow.edges.filter(isWorkflowEdgeEnabled);
  const bypassedNodeIds = new Set(
    workflow.nodes.filter(isWorkflowNodeBypassed).map(node => node.id),
  );
  const originalPairs = new Set(routableEdges.map(edge => `${edge.source}:${edge.target}`));
  const derivedPairs = new Set<string>();

  const outbound = new Map<string, WorkflowEdge[]>();
  routableEdges.forEach(edge => outbound.set(edge.source, [...(outbound.get(edge.source) ?? []), edge]));

  return workflow.nodes
    .filter(node => !bypassedNodeIds.has(node.id))
    .flatMap(sourceNode => {
      const routes: WorkflowEdge[] = [];
      const queue = (outbound.get(sourceNode.id) ?? [])
        .filter(edge => bypassedNodeIds.has(edge.target))
        .map(edge => ({ edge, firstBypassId: edge.target }));
      const visited = new Set<string>();
      while (queue.length) {
        const current = queue.shift()!;
        const bypassId = current.edge.target;
        if (visited.has(bypassId)) continue;
        visited.add(bypassId);
        for (const nextEdge of outbound.get(bypassId) ?? []) {
          if (bypassedNodeIds.has(nextEdge.target)) {
            queue.push({ edge: nextEdge, firstBypassId: current.firstBypassId });
            continue;
          }
          const pair = `${sourceNode.id}:${nextEdge.target}`;
          if (sourceNode.id === nextEdge.target || originalPairs.has(pair) || derivedPairs.has(pair)) continue;
          derivedPairs.add(pair);
          routes.push(createWorkflowEdge({
            id: `bypass:${sourceNode.id}:${current.firstBypassId}:${nextEdge.id}`,
            source: sourceNode.id,
            target: nextEdge.target,
            sourcePort: "out",
            targetPort: "in",
            mode: "temporary",
            metadata: { label: "Bypass", viaNodeId: current.firstBypassId, derived: true },
          }));
        }
      }
      return routes;
    });
}

export function getEffectiveWorkflowEdges(workflow: WorkflowState) {
  const bypassedNodeIds = new Set(
    workflow.nodes.filter(isWorkflowNodeBypassed).map(node => node.id),
  );
  const directEdges = workflow.edges.filter(
    edge => isWorkflowEdgeEnabled(edge) && !bypassedNodeIds.has(edge.source) && !bypassedNodeIds.has(edge.target),
  );
  return [...directEdges, ...getDerivedBypassEdges(workflow)];
}

export function getIncomingWorkflowEdges(workflow: WorkflowState, nodeId: string) {
  return getEffectiveWorkflowEdges(workflow).filter(edge => edge.target === nodeId);
}

export function createNode(
  type: NodeType,
  position: GraphPosition,
  index: number,
  overrides: Partial<Pick<WorkflowNode, "title" | "locked" | "bypassed" | "disabled" | "config">> = {},
): WorkflowNode {
  const defaultConfig: NodeConfiguration =
    type === "input"
      ? { prompt: "Describe the outcome you want this workflow to produce." }
      : type === "ai-agent"
        ? { provider: "Manus", model: "Manus 1.6", apiKeyAvailable: false }
        : type === "document"
          ? { files: [], tunnels: [] }
          : type === "format"
            ? { formatInstruction: "Extract the requested information." }
            : type === "split"
              ? { splitOutputs: ["Output 1", "Output 2"] }
              : type === "blank"
                ? { blankContent: "" }
                : {};

  return {
    id: id(),
    index,
    type,
    title: overrides.title ?? nodeCatalog[type].label,
    position,
    locked: overrides.locked ?? false,
    bypassed: overrides.bypassed ?? false,
    disabled: overrides.disabled ?? false,
    config: { ...defaultConfig, ...overrides.config },
  };
}

export function createInitialWorkflow(): WorkflowState {
  const input = createNode("input", { x: -430, y: -215 }, 1, {
    config: {
      prompt:
        "Draft a concise product brief for a focused, trustworthy visual workflow editor.",
    },
  });
  const context = createNode("context", { x: -430, y: 145 }, 2, {
    config: { summary: "Workspace principles, style notes, and audience constraints." },
  });
  const agent = createNode("ai-agent", { x: -35, y: -105 }, 3);
  const output = createNode("output", { x: 300, y: -105 }, 4, {
    config: { summary: "Workflow response" },
  });

  return {
    id: "local-articulate-workflow",
    name: "Untitled workflow",
    nodes: [input, context, agent, output],
    edges: [
      createWorkflowEdge({ id: id(), source: input.id, target: agent.id, sourcePort: "out", targetPort: "in" }),
      createWorkflowEdge({ id: id(), source: context.id, target: agent.id, sourcePort: "out", targetPort: "in" }),
      createWorkflowEdge({ id: id(), source: agent.id, target: output.id, sourcePort: "out", targetPort: "in" }),
    ],
    groups: [],
    selection: { nodeIds: [agent.id], edgeIds: [] },
    updatedAt: Date.now(),
  };
}

export function getNodeDimensions(node: WorkflowNode) {
  if (node.type === "input") {
    const prompt = String(node.config.prompt ?? "");
    const textLines = Math.max(3, Math.min(9, Math.ceil(prompt.length / 37) + prompt.split("\n").length - 1));
    return { width: 316, height: 150 + textLines * 18 };
  }

  if (node.type === "ai-agent") return { width: 302, height: 188 };
  if (node.type === "output") {
    const summary = String(node.config.summary ?? "");
    const textLines = Math.max(2, Math.min(12, Math.ceil(summary.length / 34) + summary.split("\n").length - 1));
    return { width: 272, height: 88 + textLines * 18 };
  }
  if (node.type === "document") {
    return { width: 300, height: 166 + Math.min(4, (node.config.files as DocumentFile[] | undefined)?.length ?? 0) * 20 };
  }
  if (node.type === "blank") {
    const content = String(node.config.blankContent ?? "");
    return { width: 292, height: 138 + Math.min(8, Math.max(0, Math.ceil(content.length / 38))) * 16 };
  }
  if (node.type === "split") {
    return { width: 272, height: 122 + Math.min(5, (node.config.splitOutputs as string[] | undefined)?.length ?? 0) * 22 };
  }
  return { width: 272, height: 142 };
}

export const workflowNodeTypes = Object.keys(nodeCatalog) as NodeType[];

export function searchNodeTypes(query: string): NodeType[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return workflowNodeTypes;

  return workflowNodeTypes.filter(type => {
    const node = nodeCatalog[type];
    return [node.label, node.eyebrow, node.description]
      .some(value => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}
