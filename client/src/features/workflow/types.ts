export type NodeType =
  | "ai-agent"
  | "input"
  | "context"
  | "output"
  | "memory"
  | "document"
  | "format"
  | "split";

export type NodeConfiguration = {
  prompt?: string;
  model?: string;
  provider?: string;
  apiKeyAvailable?: boolean;
  [key: string]: string | boolean | undefined;
};

export type GraphPosition = { x: number; y: number };

export type WorkflowNode = {
  id: string;
  index: number;
  type: NodeType;
  title: string;
  position: GraphPosition;
  locked: boolean;
  config: NodeConfiguration;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourcePort: "out";
  targetPort: "in";
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
};

const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function createNode(
  type: NodeType,
  position: GraphPosition,
  index: number,
  overrides: Partial<Pick<WorkflowNode, "title" | "locked" | "config">> = {},
): WorkflowNode {
  const defaultConfig: NodeConfiguration =
    type === "input"
      ? { prompt: "Describe the outcome you want this workflow to produce." }
      : type === "ai-agent"
        ? { provider: "Manus", model: "Manus 1.6", apiKeyAvailable: false }
        : {};

  return {
    id: id(),
    index,
    type,
    title: overrides.title ?? nodeCatalog[type].label,
    position,
    locked: overrides.locked ?? false,
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
      { id: id(), source: input.id, target: agent.id, sourcePort: "out", targetPort: "in" },
      { id: id(), source: context.id, target: agent.id, sourcePort: "out", targetPort: "in" },
      { id: id(), source: agent.id, target: output.id, sourcePort: "out", targetPort: "in" },
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
  return { width: 272, height: 142 };
}

export const workflowNodeTypes = Object.keys(nodeCatalog) as NodeType[];
