import { describe, expect, it } from "vitest";
import { getEditorKeyboardCommand } from "./editorKeyboard";

describe("editor keyboard commands", () => {
  it("keeps browser text editing untouched", () => {
    expect(getEditorKeyboardCommand({ key: "z", ctrlKey: true, editingText: true, selectedNodeCount: 1, selectedEdgeCount: 0 })).toBeUndefined();
  });

  it("maps safe editor shortcuts and prioritizes node deletion", () => {
    expect(getEditorKeyboardCommand({ key: "z", ctrlKey: true, selectedNodeCount: 0, selectedEdgeCount: 0 })).toBe("undo");
    expect(getEditorKeyboardCommand({ key: "z", ctrlKey: true, shiftKey: true, selectedNodeCount: 0, selectedEdgeCount: 0 })).toBe("redo");
    expect(getEditorKeyboardCommand({ key: "delete", selectedNodeCount: 1, selectedEdgeCount: 1 })).toBe("delete-nodes");
    expect(getEditorKeyboardCommand({ key: "delete", selectedNodeCount: 0, selectedEdgeCount: 1 })).toBe("delete-edges");
    expect(getEditorKeyboardCommand({ key: "Escape", selectedNodeCount: 0, selectedEdgeCount: 0 })).toBe("dismiss");
  });
});
