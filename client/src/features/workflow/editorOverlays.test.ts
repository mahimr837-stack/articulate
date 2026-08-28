import { describe, expect, it } from "vitest";
import { dismissEditorOverlays } from "./editorOverlays";

describe("editor overlay dismissal", () => {
  it("clears every dismissible editor overlay state at once", () => {
    expect(dismissEditorOverlays()).toEqual({
      rawNodeId: undefined,
      tunnelSourceNodeId: undefined,
      libraryMode: undefined,
      workflowNotice: undefined,
    });
  });
});
