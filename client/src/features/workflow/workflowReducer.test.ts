import { describe, expect, it } from "vitest";
import { createInitialWorkflow, createNode, getIncomingWorkflowEdges, searchNodeTypes } from "./types";
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

describe("searchNodeTypes", () => {
  it("finds node types by their name or purpose", () => {
    expect(searchNodeTypes("agent")).toEqual(["ai-agent"]);
    expect(searchNodeTypes("state")).toEqual(["memory"]);
    expect(searchNodeTypes("   ")).toHaveLength(8);
  });
});

describe("workflow connections", () => {
  it("keeps a disabled connection in graph state but excludes it from incoming information", () => {
    const state = createInitialWorkflow();
    const edge = state.edges[0]!;
    const target = edge.target;
    const result = workflowReducer(state, { type: "toggle-edge", edgeId: edge.id });

    expect(result.edges.find(candidate => candidate.id === edge.id)?.enabled).toBe(false);
    expect(result.edges.some(candidate => candidate.id === edge.id)).toBe(true);
    expect(getIncomingWorkflowEdges(result, target).some(candidate => candidate.id === edge.id)).toBe(false);
  });

  it("removes a deleted connection and clears its selected state", () => {
    const state = createInitialWorkflow();
    const edge = state.edges[1]!;
    const selected = { ...state, selection: { nodeIds: [], edgeIds: [edge.id] } };
    const result = workflowReducer(selected, { type: "delete-edge", edgeId: edge.id });

    expect(result.edges.some(candidate => candidate.id === edge.id)).toBe(false);
    expect(result.selection.edgeIds).toEqual([]);
  });

  it("normalizes legacy saved edges before users interact with them", () => {
    const state = createInitialWorkflow();
    const legacyEdge = { ...state.edges[0]! } as { enabled?: boolean } & typeof state.edges[number];
    delete legacyEdge.enabled;
    const legacyWorkflow = { ...state, edges: [legacyEdge, ...state.edges.slice(1)] };
    const result = workflowReducer(state, { type: "replace", workflow: legacyWorkflow });

    expect(result.edges[0]?.enabled).toBe(true);
    expect(result.edges[0]?.mode).toBe("standard");
  });
});
