import { describe, expect, it } from "vitest";
import { createInitialWorkflow } from "../workflow/types";
import { getNodeNeighborhood } from "./RawDataView";

describe("getNodeNeighborhood", () => {
  it("returns raw-data neighbors using the effective workflow connections", () => {
    const workflow = createInitialWorkflow();
    const agent = workflow.nodes.find(node => node.type === "ai-agent")!;
    const { previous, next, previousNodes, incomingEdges, nextNodes } = getNodeNeighborhood(workflow, agent);

    expect(previous?.type).toBe("input");
    expect(next?.type).toBe("output");
    expect(previousNodes.map(node => node.type)).toEqual(["input", "context"]);
    expect(incomingEdges).toHaveLength(2);
    expect(nextNodes).toHaveLength(1);
  });
});
