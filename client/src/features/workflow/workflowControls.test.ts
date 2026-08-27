import { describe, expect, it } from "vitest";
import { createInitialWorkflow } from "./types";
import { commitWorkflow, createStarterWorkflows, createWorkflowExport, createWorkflowHistory, createWorkflowTemplate, duplicateWorkflow, parseWorkflowExport, redoWorkflow, searchWorkflowNodes, undoWorkflow } from "./workflowControls";

describe("workflow-level controls", () => {
  it("undoes and redoes complete workflow graph snapshots", () => {
    const initial = createInitialWorkflow();
    const updated = { ...initial, name: "Renamed workflow" };
    const committed = commitWorkflow(createWorkflowHistory(initial), updated);
    expect(undoWorkflow(committed).present.name).toBe(initial.name);
    expect(redoWorkflow(undoWorkflow(committed)).present.name).toBe("Renamed workflow");
  });

  it("finds graph nodes by name and node number", () => {
    const nodes = createInitialWorkflow().nodes;
    expect(searchWorkflowNodes(nodes, "agent").map(node => node.type)).toEqual(["ai-agent"]);
    expect(searchWorkflowNodes(nodes, "2").map(node => node.type)).toEqual(["context"]);
  });

  it("round-trips a portable workflow export and offers starter workflows", () => {
    const workflow = createInitialWorkflow();
    expect(parseWorkflowExport(JSON.stringify(createWorkflowExport(workflow))).id).toBe(workflow.id);
    expect(createStarterWorkflows()).toHaveLength(3);
  });

  it("captures independent normalized template and export snapshots", () => {
    const workflow = createInitialWorkflow();
    const template = createWorkflowTemplate(workflow, "Snapshot");
    const exported = createWorkflowExport(workflow);
    workflow.nodes[0]!.title = "Changed later";

    expect(template.workflow.nodes[0]?.title).not.toBe("Changed later");
    expect(exported.workflow.nodes[0]?.title).not.toBe("Changed later");
  });

  it("duplicates the whole graph with fresh workflow and node identities", () => {
    const original = createInitialWorkflow();
    const copy = duplicateWorkflow(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.nodes.map(node => node.id)).not.toEqual(original.nodes.map(node => node.id));
    expect(copy.edges).toHaveLength(original.edges.length);
    expect(copy.name).toBe(`Copy of ${original.name}`);
  });

  it("remaps group membership only to duplicated nodes", () => {
    const original = createInitialWorkflow();
    const groupNodeIds = original.nodes.slice(0, 2).map(node => node.id);
    const grouped = { ...original, groups: [{ id: "group-1", nodeIds: groupNodeIds, locked: true, createdAt: 1 }] };
    const copy = duplicateWorkflow(grouped);

    expect(copy.groups).toHaveLength(1);
    expect(copy.groups[0]?.locked).toBe(true);
    expect(copy.groups[0]?.nodeIds).not.toEqual(groupNodeIds);
    expect(copy.groups[0]?.nodeIds.every(id => copy.nodes.some(node => node.id === id))).toBe(true);
  });
});
