import { createInitialWorkflow, createNode, createWorkflowEdge, WorkflowNode, WorkflowState } from "./types";

export type WorkflowHistory = {
  past: WorkflowState[];
  present: WorkflowState;
  future: WorkflowState[];
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  workflow: WorkflowState;
  createdAt: number;
  updatedAt: number;
  published: boolean;
};

export type WorkflowExport = {
  kind: "articulate-workflow";
  version: 1;
  exportedAt: number;
  workflow: WorkflowState;
};

const id = (prefix: string) => typeof crypto !== "undefined" && "randomUUID" in crypto ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createWorkflowHistory(present: WorkflowState): WorkflowHistory {
  return { past: [], present, future: [] };
}

export function commitWorkflow(history: WorkflowHistory, next: WorkflowState): WorkflowHistory {
  if (next === history.present) return history;
  return { past: [...history.past, history.present].slice(-50), present: next, future: [] };
}

export function undoWorkflow(history: WorkflowHistory): WorkflowHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redoWorkflow(history: WorkflowHistory): WorkflowHistory {
  const next = history.future[0];
  if (!next) return history;
  return { past: [...history.past, history.present].slice(-50), present: next, future: history.future.slice(1) };
}

export function searchWorkflowNodes(nodes: WorkflowNode[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return nodes;
  return nodes.filter(node => node.title.toLocaleLowerCase().includes(normalized) || String(node.index).includes(normalized));
}

export function createWorkflowTemplate(workflow: WorkflowState, name: string, description = "") : WorkflowTemplate {
  const now = Date.now();
  return { id: id("template"), name: name.trim() || workflow.name, description: description.trim(), workflow, createdAt: now, updatedAt: now, published: false };
}

export function duplicateWorkflow(workflow: WorkflowState): WorkflowState {
  const nodeMap = new Map<string, string>();
  const nodes = workflow.nodes.map(node => {
    const duplicate = createNode(node.type, { ...node.position }, node.index, {
      title: node.title,
      locked: node.locked,
      bypassed: node.bypassed,
      disabled: node.disabled,
      config: JSON.parse(JSON.stringify(node.config)),
    });
    nodeMap.set(node.id, duplicate.id);
    return duplicate;
  });
  return {
    ...workflow,
    id: id("workflow"),
    name: `Copy of ${workflow.name}`,
    nodes,
    edges: workflow.edges.map(edge => createWorkflowEdge({
      ...edge,
      id: id("edge"),
      source: nodeMap.get(edge.source) ?? edge.source,
      target: nodeMap.get(edge.target) ?? edge.target,
      metadata: edge.metadata ? { ...edge.metadata } : undefined,
    })),
    selection: { nodeIds: [], edgeIds: [] },
    updatedAt: Date.now(),
  };
}

export function publishWorkflowTemplate(template: WorkflowTemplate): WorkflowTemplate {
  return { ...template, published: true, updatedAt: Date.now() };
}

export function createWorkflowExport(workflow: WorkflowState): WorkflowExport {
  return { kind: "articulate-workflow", version: 1, exportedAt: Date.now(), workflow };
}

export function parseWorkflowExport(value: string): WorkflowState {
  const parsed = JSON.parse(value) as Partial<WorkflowExport>;
  if (parsed.kind !== "articulate-workflow" || parsed.version !== 1 || !parsed.workflow || !Array.isArray(parsed.workflow.nodes) || !Array.isArray(parsed.workflow.edges)) {
    throw new Error("This file is not a valid Articulate workflow export.");
  }
  return parsed.workflow;
}

export function createStarterWorkflows(): WorkflowTemplate[] {
  const base = createInitialWorkflow();
  const researchInput = createNode("input", { x: -400, y: -90 }, 1, { config: { prompt: "Summarize the attached source and extract key decisions." } });
  const researchDocument = createNode("document", { x: -400, y: 180 }, 2);
  const researchAgent = createNode("ai-agent", { x: 0, y: 25 }, 3);
  const researchOutput = createNode("output", { x: 380, y: 25 }, 4, { config: { summary: "Research findings" } });
  const research: WorkflowState = { ...base, id: "starter-research", name: "Document research", nodes: [researchInput, researchDocument, researchAgent, researchOutput], edges: [
    { id: "starter-research-input", source: researchInput.id, target: researchAgent.id, sourcePort: "out", targetPort: "in", enabled: true, mode: "standard" },
    { id: "starter-research-document", source: researchDocument.id, target: researchAgent.id, sourcePort: "out", targetPort: "in", enabled: true, mode: "standard" },
    { id: "starter-research-output", source: researchAgent.id, target: researchOutput.id, sourcePort: "out", targetPort: "in", enabled: true, mode: "standard" },
  ], selection: { nodeIds: [], edgeIds: [] }, updatedAt: Date.now() };
  return [
    { id: "starter-blank", name: "Blank workflow", description: "Start with a clean canvas.", workflow: { ...base, nodes: [], edges: [], selection: { nodeIds: [], edgeIds: [] } }, createdAt: 0, updatedAt: 0, published: false },
    { id: "starter-ai", name: "Input to AI", description: "Start with an Input, AI Agent, and Output path.", workflow: base, createdAt: 0, updatedAt: 0, published: false },
    { id: "starter-research", name: "Document research", description: "Use an AI Agent to work from supplied documents.", workflow: research, createdAt: 0, updatedAt: 0, published: false },
  ];
}

export class LocalTemplateStorageAdapter {
  constructor(private readonly key = "articulate:workflow-templates") {}
  load(): WorkflowTemplate[] {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem(this.key) ?? "[]") as WorkflowTemplate[]; } catch { return []; }
  }
  save(templates: WorkflowTemplate[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(this.key, JSON.stringify(templates));
  }
}
