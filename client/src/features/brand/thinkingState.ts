import { SafeAgentStatus, WorkflowExecutionStatus } from "@shared/execution";

export function isArticulateThinking(
  executionStatuses: WorkflowExecutionStatus[],
  agentStatuses: Array<SafeAgentStatus | undefined>,
) {
  return executionStatuses.some(status => status === "running" || status === "retrying")
    || agentStatuses.some(status => status === "processing" || status === "using-tool");
}
