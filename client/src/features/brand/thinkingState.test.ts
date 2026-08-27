import { describe, expect, it } from "vitest";
import { isArticulateThinking } from "./thinkingState";

describe("Articulate thinking state", () => {
  it("animates only while a real execution is actively processing", () => {
    expect(isArticulateThinking(["running"], [])).toBe(true);
    expect(isArticulateThinking(["retrying"], [])).toBe(true);
    expect(isArticulateThinking([], ["processing"])).toBe(true);
    expect(isArticulateThinking([], ["using-tool"])).toBe(true);
  });

  it("stops immediately for terminal, paused, and approval-waiting states", () => {
    expect(isArticulateThinking(["completed"], ["completed"])).toBe(false);
    expect(isArticulateThinking(["paused"], ["waiting"])).toBe(false);
    expect(isArticulateThinking(["failed"], ["failed"])).toBe(false);
    expect(isArticulateThinking([], ["waiting-for-approval"])).toBe(false);
  });
});
