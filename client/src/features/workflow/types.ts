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
  };
};

export type WorkflowSelection = {
  nodeIds: string[];
  edgeIds: string[];
};

export type WorkflowState = {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selection: WorkflowSelection;
  updatedAt: number;
};

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

  return workflow.nodes
    .filter(isWorkflowNodeBypassed)
    .flatMap(node => {
      const incoming = routableEdges.filter(edge => edge.target === node.id);
      const outgoing = routableEdges.filter(edge => edge.source === node.id);
      return incoming.flatMap(sourceEdge =>
        outgoing.flatMap(targetEdge => {
          const pair = `${sourceEdge.source}:${targetEdge.target}`;
          if (
            sourceEdge.source === targetEdge.target ||
            bypassedNodeIds.has(sourceEdge.source) ||
            bypassedNodeIds.has(targetEdge.target) ||
            originalPairs.has(pair) ||
            derivedPairs.has(pair)
          ) {
            return [];
          }
          derivedPairs.add(pair);
          return [createWorkflowEdge({
            id: `bypass:${node.id}:${sourceEdge.id}:${targetEdge.id}`,
            source: sourceEdge.source,
            target: targetEdge.target,
            sourcePort: "out",
            targetPort: "in",
            mode: "temporary",
            metadata: { label: "Bypass", viaNodeId: node.id, derived: true },
          })];
        }),
      );
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
