import { NodeProposal, SafeAgentStatus, WorkflowExecutionStatus } from "@shared/execution";

export type ExecutionHistoryStep = {
  id: string;
  nodeId: string;
  nodeTitle: string;
  kind: "input" | "agent" | "output";
  status: WorkflowExecutionStatus;
  startedAt: number;
  completedAt?: number;
  durationMs: number;
};

export type NodeExecution = {
  runId?: string;
  agentNodeId?: string;
  inputNodeTitle?: string;
  agentNodeTitle?: string;
  status: WorkflowExecutionStatus;
  safeStatus?: SafeAgentStatus;
  proposal?: NodeProposal;
  error?: string;
  startedAt?: number;
  resumedAt?: number;
  completedAt?: number;
  accumulatedDurationMs?: number;
  durationMs?: number;
  history: ExecutionHistoryStep[];
  updatedAt: number;
};

export type ExecutionState = Record<string, NodeExecution>;

export type ExecutionAction =
  | { type: "hydrate"; records: ExecutionState }
  | { type: "start"; inputNodeId: string; runId: string; agentNodeId: string; status: "running" | "retrying"; inputNodeTitle?: string; agentNodeTitle?: string; at?: number }
  | { type: "settle"; inputNodeId: string; result: Omit<NodeExecution, "updatedAt" | "history" | "startedAt" | "resumedAt" | "completedAt" | "durationMs" | "accumulatedDurationMs">; at?: number }
  | { type: "fail"; inputNodeId: string; error: string; at?: number };

export const idleExecution: NodeExecution = { status: "idle", history: [], updatedAt: 0 };

const isActive = (status: WorkflowExecutionStatus) => status === "running" || status === "retrying";

export function getExecutionDuration(execution: NodeExecution, now = Date.now()) {
  const accumulated = execution.accumulatedDurationMs ?? execution.durationMs ?? 0;
  if (isActive(execution.status) && execution.resumedAt) return accumulated + Math.max(0, now - execution.resumedAt);
  return accumulated;
}

const historyFor = (inputNodeId: string, execution: NodeExecution, endedAt?: number): ExecutionHistoryStep[] => {
  if (!execution.startedAt || !execution.agentNodeId) return [];
  const durationMs = getExecutionDuration(execution, endedAt ?? execution.updatedAt);
  const agentStatus = execution.status;
  const steps: ExecutionHistoryStep[] = [
    { id: `${execution.runId}:input`, nodeId: inputNodeId, nodeTitle: execution.inputNodeTitle ?? "Input", kind: "input", status: "completed", startedAt: execution.startedAt, completedAt: execution.startedAt, durationMs: 0 },
    { id: `${execution.runId}:agent`, nodeId: execution.agentNodeId, nodeTitle: execution.agentNodeTitle ?? "AI Agent", kind: "agent", status: agentStatus, startedAt: execution.startedAt, completedAt: endedAt, durationMs },
  ];
  if (agentStatus === "completed") {
    steps.push({ id: `${execution.runId}:output`, nodeId: `output:${execution.runId}`, nodeTitle: "Output", kind: "output", status: "completed", startedAt: endedAt ?? execution.updatedAt, completedAt: endedAt ?? execution.updatedAt, durationMs: 0 });
  }
  return steps;
};

export function formatDuration(durationMs?: number) {
  if (durationMs === undefined) return "—";
  if (durationMs < 1000) return `${durationMs} ms`;
  const seconds = durationMs / 1000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
}

/** Active requests cannot survive a browser reload, so restore them as paused and resumable. */
export function normalizeExecutionState(records: ExecutionState): ExecutionState {
  return Object.fromEntries(Object.entries(records).flatMap(([inputNodeId, record]) => {
    if (!record || !record.status || !Array.isArray(record.history)) return [];
    const interrupted = isActive(record.status);
    const accumulatedDurationMs = getExecutionDuration(record, record.updatedAt || Date.now());
    const normalized: NodeExecution = {
      ...record,
      status: interrupted ? "paused" : record.status,
      safeStatus: interrupted ? "waiting" : record.safeStatus,
      resumedAt: undefined,
      accumulatedDurationMs,
      durationMs: interrupted ? accumulatedDurationMs : record.durationMs,
      history: record.history.map(step => ({
        ...step,
        nodeTitle: step.nodeTitle ?? (step.kind === "input" ? "Input" : step.kind === "agent" ? "AI Agent" : "Output"),
      })),
      updatedAt: record.updatedAt || Date.now(),
    };
    return [[inputNodeId, normalized]];
  }));
}

export function executionReducer(state: ExecutionState, action: ExecutionAction): ExecutionState {
  switch (action.type) {
    case "hydrate":
      return normalizeExecutionState(action.records);
    case "start": {
      const now = action.at ?? Date.now();
      const previous = state[action.inputNodeId];
      const resuming = previous?.runId === action.runId && previous.status === "paused";
      const execution: NodeExecution = {
        runId: action.runId,
        agentNodeId: action.agentNodeId,
        inputNodeTitle: resuming ? previous?.inputNodeTitle : action.inputNodeTitle,
        agentNodeTitle: resuming ? previous?.agentNodeTitle : action.agentNodeTitle,
        status: action.status,
        safeStatus: "processing",
        startedAt: resuming ? previous?.startedAt : now,
        resumedAt: now,
        accumulatedDurationMs: resuming && previous ? getExecutionDuration(previous, previous.updatedAt) : 0,
        history: resuming && previous ? previous.history : [],
        updatedAt: now,
      };
      return { ...state, [action.inputNodeId]: execution };
    }
    case "settle": {
      const now = action.at ?? Date.now();
      const previous = state[action.inputNodeId] ?? idleExecution;
      const durationMs = getExecutionDuration(previous, now);
      const execution: NodeExecution = {
        ...previous,
        ...action.result,
        status: action.result.status,
        safeStatus: action.result.safeStatus ?? (action.result.status === "failed" ? "failed" : action.result.status === "paused" ? "waiting" : "completed"),
        resumedAt: undefined,
        accumulatedDurationMs: durationMs,
        durationMs,
        completedAt: action.result.status === "paused" ? undefined : now,
        updatedAt: now,
      };
      execution.history = historyFor(action.inputNodeId, execution, action.result.status === "paused" ? undefined : now);
      return { ...state, [action.inputNodeId]: execution };
    }
    case "fail": {
      const now = action.at ?? Date.now();
      const previous = state[action.inputNodeId] ?? idleExecution;
      const durationMs = getExecutionDuration(previous, now);
      const execution: NodeExecution = {
        ...previous,
        status: "failed",
        safeStatus: "failed",
        error: action.error,
        resumedAt: undefined,
        accumulatedDurationMs: durationMs,
        durationMs,
        completedAt: now,
        updatedAt: now,
      };
      execution.history = historyFor(action.inputNodeId, execution, now);
      return { ...state, [action.inputNodeId]: execution };
    }
    default:
      return state;
  }
}
