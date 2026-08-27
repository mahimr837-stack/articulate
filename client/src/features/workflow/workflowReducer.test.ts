import { describe, expect, it } from "vitest";
import { createDocumentTunnel, createInitialWorkflow, createNode, createWorkflowEdge, DocumentFile, getDerivedBypassEdges, getIncomingWorkflowEdges, getTunneledDocuments, normalizeWorkflow, searchNodeTypes, workflowNodeTypes } from "./types";
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

  it("does not create a workflow change when a move does not change a node position", () => {
    const state = createInitialWorkflow();
    const node = state.nodes[0]!;
    expect(workflowReducer(state, { type: "move-nodes", positions: { [node.id]: node.position } })).toBe(state);
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

  it("expands Output node dimensions for completed workflow content", () => {
    const state = createInitialWorkflow();
    const output = state.nodes.find(node => node.type === "output")!;
    const updated = workflowReducer(state, {
      type: "update-node",
      nodeId: output.id,
      patch: { config: { summary: "A completed response with enough content to occupy more than the initial output area." } },
    });

    expect(updated.nodes.find(node => node.id === output.id)?.config.summary).toContain("completed response");
  });
});

describe("searchNodeTypes", () => {
  it("finds node types by their name or purpose", () => {
    expect(searchNodeTypes("agent")).toEqual(["ai-agent"]);
    expect(searchNodeTypes("state")).toEqual(["memory"]);
    expect(searchNodeTypes("   ")).toHaveLength(workflowNodeTypes.length);
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

describe("node bypass and disable states", () => {
  it("derives direct effective routes around a bypassed node without removing its original edges", () => {
    const state = createInitialWorkflow();
    const agent = state.nodes.find(node => node.type === "ai-agent")!;
    const output = state.nodes.find(node => node.type === "output")!;
    const result = workflowReducer(state, { type: "toggle-bypass", nodeId: agent.id });
    const bypassEdges = getDerivedBypassEdges(result);

    expect(result.nodes.find(node => node.id === agent.id)?.bypassed).toBe(true);
    expect(result.edges).toHaveLength(3);
    expect(bypassEdges).toHaveLength(2);
    expect(getIncomingWorkflowEdges(result, output.id)).toHaveLength(2);
    expect(getIncomingWorkflowEdges(result, output.id).every(edge => edge.source !== agent.id)).toBe(true);
  });

  it("keeps bypass and disable as distinct reversible states", () => {
    const state = createInitialWorkflow();
    const agent = state.nodes.find(node => node.type === "ai-agent")!;
    const bypassed = workflowReducer(state, { type: "toggle-bypass", nodeId: agent.id });
    const disabled = workflowReducer(bypassed, { type: "toggle-disable", nodeId: agent.id });
    const restored = workflowReducer(disabled, { type: "toggle-disable", nodeId: agent.id });

    expect(bypassed.nodes.find(node => node.id === agent.id)).toMatchObject({ bypassed: true, disabled: false });
    expect(disabled.nodes.find(node => node.id === agent.id)).toMatchObject({ bypassed: false, disabled: true });
    expect(restored.nodes.find(node => node.id === agent.id)).toMatchObject({ bypassed: false, disabled: false });
  });

  it("routes around a consecutive bypass chain without creating bypass endpoints that remain bypassed", () => {
    const source = createNode("input", { x: 0, y: 0 }, 1);
    const first = createNode("format", { x: 200, y: 0 }, 2, { bypassed: true });
    const second = createNode("format", { x: 400, y: 0 }, 3, { bypassed: true });
    const target = createNode("output", { x: 600, y: 0 }, 4);
    const workflow = normalizeWorkflow({
      id: "chain", name: "Chain", nodes: [source, first, second, target], groups: [], selection: { nodeIds: [], edgeIds: [] }, updatedAt: 1,
      edges: [
        createWorkflowEdge({ id: "a", source: source.id, target: first.id, sourcePort: "out", targetPort: "in" }),
        createWorkflowEdge({ id: "b", source: first.id, target: second.id, sourcePort: "out", targetPort: "in" }),
        createWorkflowEdge({ id: "c", source: second.id, target: target.id, sourcePort: "out", targetPort: "in" }),
      ],
    });

    expect(getDerivedBypassEdges(workflow)).toEqual(expect.arrayContaining([expect.objectContaining({ source: source.id, target: target.id })]));
  });

  it("normalizes legacy snapshots with missing groups, invalid edges, duplicate indexes, and stale selection", () => {
    const state = createInitialWorkflow();
    const legacy = {
      ...state,
      groups: undefined,
      selection: { nodeIds: [state.nodes[0]!.id, "missing"], edgeIds: ["missing"] },
      nodes: [{ ...state.nodes[0]!, index: 1 }, { ...state.nodes[1]!, index: 1 }],
      edges: [{ ...state.edges[0]!, source: "missing" }],
    } as unknown as typeof state;
    const normalized = normalizeWorkflow(legacy);

    expect(normalized.groups).toEqual([]);
    expect(normalized.edges).toEqual([]);
    expect(normalized.nodes.map(node => node.index)).toEqual([1, 2]);
    expect(normalized.selection.nodeIds).toEqual([state.nodes[0]!.id]);
  });
});

describe("extended node defaults", () => {
  it("creates document, format, split, and blank configurations through the shared node factory", () => {
    expect(createNode("document", { x: 0, y: 0 }, 1).config).toMatchObject({ files: [], tunnels: [] });
    expect(createNode("format", { x: 0, y: 0 }, 2).config.formatInstruction).toContain("Extract");
    expect(createNode("split", { x: 0, y: 0 }, 3).config.splitOutputs).toEqual(["Output 1", "Output 2"]);
    expect(createNode("blank", { x: 0, y: 0 }, 4).config.blankContent).toBe("");
  });
});

describe("document tunnels", () => {
  it("keeps tunnel metadata in a Document node and exposes delivered files to multiple graph targets", () => {
    const state = createInitialWorkflow();
    const source = createNode("document", { x: 0, y: 0 }, 5);
    const [input, , agent] = state.nodes;
    const file: DocumentFile = { id: "file-1", name: "source.csv", mimeType: "text/csv", size: 42, storageKey: "documents/source.csv", storageUrl: "/manus-storage/documents/source.csv", uploadedAt: 1 };
    const first = createDocumentTunnel(source.id, file.id, input!.id);
    const second = createDocumentTunnel(source.id, file.id, agent!.id);
    const workflow = {
      ...state,
      nodes: [...state.nodes, { ...source, config: { files: [file], tunnels: [first, second] } }],
      edges: [
        ...state.edges,
        createWorkflowEdge({ id: first.id, source: source.id, target: input!.id, sourcePort: "out", targetPort: "in", metadata: { tunnel: true, documentId: file.id } }),
        createWorkflowEdge({ id: second.id, source: source.id, target: agent!.id, sourcePort: "out", targetPort: "in", metadata: { tunnel: true, documentId: file.id } }),
      ],
    };

    expect(getTunneledDocuments(workflow, input!.id)).toEqual([file]);
    expect(getTunneledDocuments(workflow, agent!.id)).toEqual([file]);
    expect(workflow.edges.filter(edge => edge.metadata?.tunnel)).toHaveLength(2);
  });
});

describe("advanced canvas groups", () => {
  it("keeps a gripped group intact and prevents group-locked nodes from moving", () => {
    const state = createInitialWorkflow();
    const selected = state.nodes.slice(0, 2).map(node => node.id);
    const gripped = workflowReducer({ ...state, selection: { nodeIds: selected, edgeIds: [] } }, { type: "grip-selection", groupId: "group-1" });
    const locked = workflowReducer(gripped, { type: "toggle-group-lock", groupId: "group-1" });
    const moved = workflowReducer(locked, { type: "move-nodes", positions: { [selected[0]!]: { x: 800, y: 800 } } });

    expect(gripped.groups[0]?.nodeIds).toEqual(selected);
    expect(locked.groups[0]?.locked).toBe(true);
    expect(moved.nodes.find(node => node.id === selected[0])?.position).toEqual(state.nodes[0]?.position);
  });

  it("ungroups selections and appends selected-execution ropes without removing the original graph", () => {
    const state = createInitialWorkflow();
    const selected = [state.nodes[0]!.id, state.nodes[2]!.id, state.nodes[3]!.id];
    const gripped = workflowReducer({ ...state, selection: { nodeIds: selected, edgeIds: [] } }, { type: "grip-selection", groupId: "group-1" });
    const ungripped = workflowReducer(gripped, { type: "ungrip-selected" });
    const executed = workflowReducer({ ...ungripped, selection: { nodeIds: selected, edgeIds: [] } }, { type: "execute-selected", executionId: "run-1" });

    expect(ungripped.groups).toHaveLength(0);
    expect(executed.edges).toHaveLength(state.edges.length + 2);
    expect(executed.edges.filter(edge => edge.metadata?.selectedExecution)).toHaveLength(2);
  });

  it("does not duplicate selected-execution ropes when the same selection is executed again", () => {
    const state = createInitialWorkflow();
    const selected = state.nodes.slice(0, 2).map(node => node.id);
    const once = workflowReducer({ ...state, selection: { nodeIds: selected, edgeIds: [] } }, { type: "execute-selected", executionId: "run-1" });
    const twice = workflowReducer(once, { type: "execute-selected", executionId: "run-2" });

    expect(twice.edges).toHaveLength(once.edges.length);
  });
});
