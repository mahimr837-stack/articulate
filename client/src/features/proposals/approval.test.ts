import { describe, expect, it } from "vitest";
import { createNode } from "../workflow/types";
import { createApprovedProposalAddition } from "./approval";
import { proposalReducer } from "./proposalState";

describe("approval-gated node proposals", () => {
  const source = createNode("ai-agent", { x: 100, y: 200 }, 3);
  const proposal = { nodeType: "format" as const, title: "Extract contacts", purpose: "Return name and email fields." };

  it("creates a graph addition only through the approved proposal path", () => {
    const addition = createApprovedProposalAddition(proposal, source, 4);
    expect(addition.node).toMatchObject({ type: "format", title: "Extract contacts" });
    expect(addition.edge).toMatchObject({ source: source.id, target: addition.node.id, metadata: { label: "Approved proposal" } });
  });

  it("clears a declined proposal without producing any workflow addition", () => {
    const pending = proposalReducer({}, { type: "received", pending: { sourceNodeId: source.id, proposal } });
    const declined = proposalReducer(pending, { type: "resolved" });
    expect(declined.pending).toBeUndefined();
  });
});
