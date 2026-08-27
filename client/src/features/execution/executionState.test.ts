import { describe, expect, it } from "vitest";
import { executionReducer, idleExecution } from "./executionState";

describe("executionReducer", () => {
  it("reflects the real client lifecycle from running through paused and completed", () => {
    const running = executionReducer({}, { type: "start", inputNodeId: "input-1", agentNodeId: "agent-1", runId: "run-1", status: "running" });
    const paused = executionReducer(running, { type: "settle", inputNodeId: "input-1", result: { runId: "run-1", agentNodeId: "agent-1", status: "paused" } });
    const completed = executionReducer(paused, { type: "settle", inputNodeId: "input-1", result: { runId: "run-1", agentNodeId: "agent-1", status: "completed" } });

    expect(running["input-1"]?.status).toBe("running");
    expect(paused["input-1"]?.status).toBe("paused");
    expect(completed["input-1"]?.status).toBe("completed");
    expect(idleExecution.status).toBe("idle");
  });
});
