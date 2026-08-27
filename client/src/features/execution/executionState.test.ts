import { describe, expect, it } from "vitest";
import { executionReducer, formatDuration, getExecutionDuration, idleExecution, normalizeExecutionState } from "./executionState";

describe("executionReducer", () => {
  it("reflects the real client lifecycle from running through paused and completed", () => {
    const running = executionReducer({}, { type: "start", inputNodeId: "input-1", inputNodeTitle: "Brief", agentNodeId: "agent-1", agentNodeTitle: "Research agent", runId: "run-1", status: "running", at: 1000 });
    const paused = executionReducer(running, { type: "settle", inputNodeId: "input-1", result: { runId: "run-1", agentNodeId: "agent-1", status: "paused" }, at: 1650 });
    const resumed = executionReducer(paused, { type: "start", inputNodeId: "input-1", agentNodeId: "agent-1", runId: "run-1", status: "running", at: 2000 });
    const completed = executionReducer(resumed, { type: "settle", inputNodeId: "input-1", result: { runId: "run-1", agentNodeId: "agent-1", status: "completed" }, at: 3250 });

    expect(running["input-1"]?.status).toBe("running");
    expect(paused["input-1"]?.status).toBe("paused");
    expect(resumed["input-1"]?.status).toBe("running");
    expect(completed["input-1"]?.status).toBe("completed");
    expect(completed["input-1"]?.durationMs).toBe(1900);
    expect(completed["input-1"]?.history.map(step => step.kind)).toEqual(["input", "agent", "output"]);
    expect(completed["input-1"]?.history.map(step => step.nodeTitle)).toEqual(["Brief", "Research agent", "Output"]);
    expect(idleExecution.status).toBe("idle");
  });

  it("derives a live timer from actual start timestamps and formats completed timing", () => {
    const running = executionReducer({}, { type: "start", inputNodeId: "input-1", agentNodeId: "agent-1", runId: "run-1", status: "running", at: 1000 });
    expect(getExecutionDuration(running["input-1"]!, 1425)).toBe(425);
    expect(formatDuration(425)).toBe("425 ms");
    expect(formatDuration(1400)).toBe("1.4 s");
  });

  it("converts an interrupted persisted active record to a resumable paused record", () => {
    const records = {
      input: { runId: "run-0001", agentNodeId: "agent", status: "running" as const, startedAt: 100, resumedAt: 200, accumulatedDurationMs: 100, history: [], updatedAt: 300 },
    };
    const restored = normalizeExecutionState(records);
    expect(restored.input).toMatchObject({ status: "paused", safeStatus: "waiting", resumedAt: undefined, accumulatedDurationMs: 200 });
  });
});
