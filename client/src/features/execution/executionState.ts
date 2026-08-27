import { WorkflowExecutionStatus } from "@shared/execution";

export type NodeExecution = {
  runId?: string;
  agentNodeId?: string;
  status: WorkflowExecutionStatus;
  error?: string;
  updatedAt: number;
};

export type ExecutionState = Record<string, NodeExecution>;

export type ExecutionAction =
  | { type: "start"; inputNodeId: string; runId: string; agentNodeId: string; status: "running" | "retrying" }
  | { type: "settle"; inputNodeId: string; result: Omit<NodeExecution, "updatedAt"> }
  | { type: "fail"; inputNodeId: string; error: string };

export const idleExecution: NodeExecution = { status: "idle", updatedAt: 0 };

export function executionReducer(state: ExecutionState, action: ExecutionAction): ExecutionState {
  switch (action.type) {
    case "start":
      return {
        ...state,
        [action.inputNodeId]: {
          runId: action.runId,
          agentNodeId: action.agentNodeId,
          status: action.status,
          updatedAt: Date.now(),
        },
      };
    case "settle":
      return {
        ...state,
        [action.inputNodeId]: { ...action.result, updatedAt: Date.now() },
      };
    case "fail":
      return {
        ...state,
        [action.inputNodeId]: { status: "failed", error: action.error, updatedAt: Date.now() },
      };
    default:
      return state;
  }
}
