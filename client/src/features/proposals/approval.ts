import { NodeProposal } from "@shared/execution";
import { createNode, createWorkflowEdge, WorkflowNode } from "../workflow/types";

export function createApprovedProposalAddition(proposal: NodeProposal, source: WorkflowNode, index: number) {
  const node = createNode(
    proposal.nodeType,
    { x: source.position.x + 370, y: source.position.y + 70 },
    index,
    { title: proposal.title, config: { summary: proposal.purpose } },
  );
  const edge = createWorkflowEdge({
    id: `proposal-${node.id}`,
    source: source.id,
    target: node.id,
    sourcePort: "out",
    targetPort: "in",
    metadata: { label: "Approved proposal" },
  });
  return { node, edge };
}
