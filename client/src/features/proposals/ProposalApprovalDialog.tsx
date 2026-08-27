import { Bot, Check, X } from "lucide-react";
import { PendingNodeProposal } from "./proposalState";

type ProposalApprovalDialogProps = {
  pending: PendingNodeProposal;
  sourceTitle: string;
  onApprove: () => void;
  onDecline: () => void;
};

export function ProposalApprovalDialog({ pending, sourceTitle, onApprove, onDecline }: ProposalApprovalDialogProps) {
  const { proposal } = pending;
  return <div className="proposal-backdrop" role="presentation" onPointerDown={onDecline}>
    <section className="proposal-dialog" role="dialog" aria-modal="true" aria-label="Approve proposed workflow node" onPointerDown={event => event.stopPropagation()}>
      <header><div><Bot size={16} /><span>Node proposal</span></div><button type="button" onClick={onDecline} aria-label="Decline proposal"><X size={16} /></button></header>
      <div className="proposal-dialog-body"><p><strong>{sourceTitle}</strong> is requesting a new workflow node.</p><div className="proposal-node-card"><span>{proposal.nodeType.replace("-", " ")}</span><strong>{proposal.title}</strong><p>{proposal.purpose}</p></div><small>The node will not be created unless you approve it.</small></div>
      <footer><button type="button" onClick={onDecline}>Decline</button><button type="button" className="primary" onClick={onApprove}><Check size={14} /> Approve</button></footer>
    </section>
  </div>;
}
