import { describe, expect, it } from "vitest";
import { createInitialWorkflow, createNode } from "./types";
import { workflowReducer } from "./workflowReducer";

describe("workflowReducer", () => {
  it("keeps locked nodes fixed while moving other selected nodes", () => {
    const state = createInitialWorkflow();
    const locked = state.nodes[0]!;
    const free = state.nodes[1]!;
    const lockedState = workflowReducer(state, { type: "toggle-lock", nodeId: locked.id });

    const result = workflowReducer(lockedState, {
      type: "move-nodes",
      positions: {
        [locked.id]: { x: 500, y: 500 },
        [free.id]: { x: 200, y: 200 },
      },
    });

    expect(result.nodes.find(node => node.id === locked.id)?.position).toEqual(locked.position);
    expect(result.nodes.find(node => node.id === free.id)?.position).toEqual({ x: 200, y: 200 });
  });

  it("deletes attached ropes when a node is removed", () => {
    const state = createInitialWorkflow();
    const removed = state.nodes[2]!;
    const result = workflowReducer(state, { type: "delete-nodes", nodeIds: [removed.id] });

    expect(result.nodes.some(node => node.id === removed.id)).toBe(false);
    expect(result.edges.some(edge => edge.source === removed.id || edge.target === removed.id)).toBe(false);
  });

  it("selects copied nodes when they are added to the workflow", () => {
    const state = createInitialWorkflow();
    const copy = createNode("memory", { x: 40, y: 80 }, 9);
    const result = workflowReducer(state, { type: "add-nodes", nodes: [copy], select: true });

    expect(result.selection.nodeIds).toEqual([copy.id]);
    expect(result.nodes).toContainEqual(copy);
  });
});
