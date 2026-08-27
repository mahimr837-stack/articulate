export type WorkflowExecutionStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "retrying";

export type AgentRunRequest = {
  runId: string;
  inputNodeId: string;
  agentNodeId: string;
  prompt: string;
  model?: string;
  provider?: string;
  retry?: boolean;
};

export type AgentRunResult = {
  runId: string;
  status: WorkflowExecutionStatus;
  output?: string;
  resolvedModel?: string;
  error?: string;
};
