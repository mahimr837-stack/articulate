import { NodeProposal } from "@shared/execution";

export type PendingNodeProposal = {
  sourceNodeId: string;
  proposal: NodeProposal;
};

export type ProposalState = { pending?: PendingNodeProposal };

export type ProposalAction =
  | { type: "received"; pending: PendingNodeProposal }
  | { type: "resolved" };

export function proposalReducer(state: ProposalState, action: ProposalAction): ProposalState {
  if (action.type === "received") return { pending: action.pending };
  if (action.type === "resolved") return {};
  return state;
}
