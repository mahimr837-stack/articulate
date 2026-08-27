import { describe, expect, it } from "vitest";
import { parseAgentModelContent, parseNodeProposalContent, WorkflowExecutionService } from "./execution";

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
  it("returns only a bounded approval-ready proposal and never exposes private reasoning", () => {
    const result = parseAgentModelContent(JSON.stringify({
      answer: "I can organize the source before continuing.",
      proposal: { nodeType: "format", title: "Classify source", purpose: "Extract the requested fields." },
      privateReasoning: "This is ignored.",
    }));

    expect(result).toEqual({ output: "I can organize the source before continuing.", proposal: { nodeType: "format", title: "Classify source", purpose: "Extract the requested fields." } });
  });

  it("parses a direct node proposal only from its safe allowed fields", () => {
    expect(parseNodeProposalContent(JSON.stringify({ proposal: { nodeType: "blank", title: "Scratchpad", purpose: "Keep a working note." }, privateReasoning: "ignored" }))).toEqual({ nodeType: "blank", title: "Scratchpad", purpose: "Keep a working note." });
    expect(parseNodeProposalContent(JSON.stringify({ proposal: { nodeType: "shell", title: "Unsafe", purpose: "Not allowed" } }))).toBeUndefined();
  });

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

  it("recovers a paused execution from the persisted request if the server process no longer has run memory", async () => {
    const service = new WorkflowExecutionService(catalog, async () => ({
      id: "completion-recovered",
      created: 0,
      model: "gpt-5-mini",
      choices: [{ index: 0, message: { role: "assistant", content: "Recovered output" }, finish_reason: "stop" }],
    }));

    await expect(service.resume(validRequest.runId, validRequest)).resolves.toMatchObject({ status: "completed", output: "Recovered output" });
  });

  it("returns a failed result for invalid empty workflow input", async () => {
    const service = new WorkflowExecutionService(catalog, async () => {
      throw new Error("not called");
    });
    const result = await service.run({ ...validRequest, prompt: "  " });
    expect(result).toMatchObject({ status: "failed", error: "Add a prompt before running this workflow." });
  });
});
