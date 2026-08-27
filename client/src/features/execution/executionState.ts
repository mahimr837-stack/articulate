import { WorkflowExecutionStatus } from "@shared/execution";

export type ExecutionHistoryStep = {
  id: string;
  nodeId: string;
  kind: "input" | "agent" | "output";
  status: WorkflowExecutionStatus;
  startedAt: number;
  completedAt?: number;
  durationMs: number;
};

export type NodeExecution = {
  runId?: string;
  agentNodeId?: string;
  status: WorkflowExecutionStatus;
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
  | { type: "start"; inputNodeId: string; runId: string; agentNodeId: string; status: "running" | "retrying"; at?: number }
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
    { id: `${execution.runId}:input`, nodeId: inputNodeId, kind: "input", status: "completed", startedAt: execution.startedAt, completedAt: execution.startedAt, durationMs: 0 },
    { id: `${execution.runId}:agent`, nodeId: execution.agentNodeId, kind: "agent", status: agentStatus, startedAt: execution.startedAt, completedAt: endedAt, durationMs },
  ];
  if (agentStatus === "completed") {
    steps.push({ id: `${execution.runId}:output`, nodeId: `output:${execution.runId}`, kind: "output", status: "completed", startedAt: endedAt ?? execution.updatedAt, completedAt: endedAt ?? execution.updatedAt, durationMs: 0 });
  }
  return steps;
};

export function formatDuration(durationMs?: number) {
  if (durationMs === undefined) return "—";
  if (durationMs < 1000) return `${durationMs} ms`;
  const seconds = durationMs / 1000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
}

export function executionReducer(state: ExecutionState, action: ExecutionAction): ExecutionState {
  switch (action.type) {
    case "hydrate":
      return action.records;
    case "start": {
      const now = action.at ?? Date.now();
      const previous = state[action.inputNodeId];
      const resuming = previous?.runId === action.runId && previous.status === "paused";
      const execution: NodeExecution = {
        runId: action.runId,
        agentNodeId: action.agentNodeId,
        status: action.status,
        startedAt: resuming ? previous.startedAt : now,
        resumedAt: now,
        accumulatedDurationMs: resuming ? getExecutionDuration(previous, previous.updatedAt) : 0,
        history: resuming ? previous.history : [],
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
