import { describe, expect, it } from "vitest";
import { WorkflowExecutionService } from "./execution";

const validRequest = {
  runId: "run-0001",
  inputNodeId: "input-1",
  agentNodeId: "agent-1",
  prompt: "Summarize the value of a local-first workflow editor.",
  model: "Manus 1.6",
};

const catalog = async () => ({
  data: [{ id: "gpt-5-mini", object: "model", created: 0, owned_by: "manus" }],
});

describe("WorkflowExecutionService", () => {
  it("returns real model output through a completed execution result", async () => {
    const service = new WorkflowExecutionService(catalog, async () => ({
      id: "completion-1",
      created: 0,
      model: "gpt-5-mini",
      choices: [{ index: 0, message: { role: "assistant", content: "A local-first editor keeps workflow work responsive and private." }, finish_reason: "stop" }],
    }));

    const result = await service.run(validRequest);

    expect(result).toMatchObject({ status: "completed", resolvedModel: "gpt-5-mini" });
    expect(result.output).toContain("local-first");
  });

  it("pauses an in-flight model call through an abort signal and resumes through a new real request", async () => {
    let attempts = 0;
    let markStarted: (() => void) | undefined;
    const executionStarted = new Promise<void>(resolve => { markStarted = resolve; });
    const service = new WorkflowExecutionService(catalog, ({ signal }) => {
      attempts += 1;
      if (attempts === 1) {
        markStarted?.();
        return new Promise((_, reject) => signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }));
      }
      return Promise.resolve({
        id: "completion-2",
        created: 0,
        model: "gpt-5-mini",
        choices: [{ index: 0, message: { role: "assistant", content: "Resumed output" }, finish_reason: "stop" }],
      });
    });

    const running = service.run(validRequest);
    await executionStarted;
    expect(service.pause(validRequest.runId).status).toBe("paused");
    expect((await running).status).toBe("paused");
    expect((await service.resume(validRequest.runId)).status).toBe("completed");
  });

  it("returns a failed result for invalid empty workflow input", async () => {
    const service = new WorkflowExecutionService(catalog, async () => {
      throw new Error("not called");
    });
    const result = await service.run({ ...validRequest, prompt: "  " });
    expect(result).toMatchObject({ status: "failed", error: "Add a prompt before running this workflow." });
  });
});
