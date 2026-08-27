import { describe, expect, it } from "vitest";
import { proposalReducer } from "./proposalState";

describe("proposalReducer", () => {
  const pending = { sourceNodeId: "agent-1", proposal: { nodeType: "format" as const, title: "Extract fields", purpose: "Extract the requested fields." } };

  it("keeps proposed nodes pending until an explicit resolution", () => {
    const received = proposalReducer({}, { type: "received", pending });
    expect(received.pending).toEqual(pending);
    expect(proposalReducer(received, { type: "resolved" }).pending).toBeUndefined();
  });
});
