import { describe, expect, it } from "vitest";
import { createInitialWorkflow } from "./types";
import { commitWorkflow, createStarterWorkflows, createWorkflowExport, createWorkflowHistory, duplicateWorkflow, parseWorkflowExport, redoWorkflow, searchWorkflowNodes, undoWorkflow } from "./workflowControls";

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

  it("duplicates the whole graph with fresh workflow and node identities", () => {
    const original = createInitialWorkflow();
    const copy = duplicateWorkflow(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.nodes.map(node => node.id)).not.toEqual(original.nodes.map(node => node.id));
    expect(copy.edges).toHaveLength(original.edges.length);
    expect(copy.name).toBe(`Copy of ${original.name}`);
  });
});
