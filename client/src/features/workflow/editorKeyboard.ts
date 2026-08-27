export type EditorKeyboardCommand = "undo" | "redo" | "copy" | "paste" | "delete-nodes" | "delete-edges" | "dismiss" | undefined;

export function getEditorKeyboardCommand(input: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  editingText?: boolean;
  selectedNodeCount: number;
  selectedEdgeCount: number;
}): EditorKeyboardCommand {
  if (input.editingText) return undefined;
  const key = input.key.toLowerCase();
  const shortcut = input.ctrlKey || input.metaKey;
  if (shortcut && key === "z") return input.shiftKey ? "redo" : "undo";
  if (shortcut && key === "y") return "redo";
  if (shortcut && key === "c") return "copy";
  if (shortcut && key === "v") return "paste";
  if ((key === "backspace" || key === "delete") && input.selectedNodeCount) return "delete-nodes";
  if ((key === "backspace" || key === "delete") && input.selectedEdgeCount) return "delete-edges";
  if (key === "escape") return "dismiss";
  return undefined;
}
