export type WorkflowExecutionStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "retrying";

export type SafeAgentStatus =
  | "processing"
  | "waiting"
  | "using-tool"
  | "waiting-for-approval"
  | "completed"
  | "failed";

export type ProposedNodeType =
  | "ai-agent"
  | "input"
  | "context"
  | "output"
  | "memory"
  | "document"
  | "format"
  | "split"
  | "blank";

export type NodeProposal = {
  nodeType: ProposedNodeType;
  title: string;
  purpose: string;
};

export type AgentRunRequest = {
  runId: string;
  inputNodeId: string;
  agentNodeId: string;
  prompt: string;
  model?: string;
  provider?: string;
  retry?: boolean;
};

export type AgentProposalRequest = {
  sourceNodeId: string;
  prompt: string;
  model?: string;
  provider?: string;
};

export type AgentRunResult = {
  runId: string;
  status: WorkflowExecutionStatus;
  output?: string;
  resolvedModel?: string;
  error?: string;
  safeStatus?: SafeAgentStatus;
  proposal?: NodeProposal;
};

export type AgentProposalResult = {
  safeStatus: SafeAgentStatus;
  proposal?: NodeProposal;
  resolvedModel?: string;
  error?: string;
};
