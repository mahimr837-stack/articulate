export type EditorOverlayState = {
  rawNodeId?: string;
  tunnelSourceNodeId?: string;
  libraryMode?: "templates" | "starters";
  workflowNotice?: string;
};

export function dismissEditorOverlays(): EditorOverlayState {
  return {
    rawNodeId: undefined,
    tunnelSourceNodeId: undefined,
    libraryMode: undefined,
    workflowNotice: undefined,
  };
}
