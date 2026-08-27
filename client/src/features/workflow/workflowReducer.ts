import { WorkflowEdge, WorkflowNode, WorkflowSelection, WorkflowState } from "./types";

export type WorkflowAction =
  | { type: "replace"; workflow: WorkflowState }
  | { type: "set-selection"; selection: WorkflowSelection }
  | { type: "add-nodes"; nodes: WorkflowNode[]; select: boolean }
  | { type: "move-nodes"; positions: Record<string, { x: number; y: number }> }
  | { type: "update-node"; nodeId: string; patch: Partial<Pick<WorkflowNode, "title" | "config">> }
  | { type: "toggle-lock"; nodeId: string }
  | { type: "delete-nodes"; nodeIds: string[] }
  | { type: "add-edge"; edge: WorkflowEdge };

const stamp = (state: WorkflowState, patch: Partial<WorkflowState>): WorkflowState => ({
  ...state,
  ...patch,
  updatedAt: Date.now(),
});

export function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case "replace":
      return action.workflow;
    case "set-selection":
      return { ...state, selection: action.selection };
    case "add-nodes":
      return stamp(state, {
        nodes: [...state.nodes, ...action.nodes],
        selection: action.select
          ? { nodeIds: action.nodes.map(node => node.id), edgeIds: [] }
          : state.selection,
      });
    case "move-nodes":
      return stamp(state, {
        nodes: state.nodes.map(node => {
          const nextPosition = action.positions[node.id];
          return nextPosition && !node.locked ? { ...node, position: nextPosition } : node;
        }),
      });
    case "update-node":
      return stamp(state, {
        nodes: state.nodes.map(node =>
          node.id === action.nodeId
            ? { ...node, ...action.patch, config: { ...node.config, ...action.patch.config } }
            : node,
        ),
      });
    case "toggle-lock":
      return stamp(state, {
        nodes: state.nodes.map(node =>
          node.id === action.nodeId ? { ...node, locked: !node.locked } : node,
        ),
      });
    case "delete-nodes": {
      const removed = new Set(action.nodeIds);
      return stamp(state, {
        nodes: state.nodes.filter(node => !removed.has(node.id)),
        edges: state.edges.filter(edge => !removed.has(edge.source) && !removed.has(edge.target)),
        selection: {
          nodeIds: state.selection.nodeIds.filter(nodeId => !removed.has(nodeId)),
          edgeIds: [],
        },
      });
    }
    case "add-edge": {
      const duplicate = state.edges.some(
        edge =>
          edge.source === action.edge.source &&
          edge.target === action.edge.target &&
          edge.sourcePort === action.edge.sourcePort &&
          edge.targetPort === action.edge.targetPort,
      );
      return duplicate ? state : stamp(state, { edges: [...state.edges, action.edge] });
    }
    default:
      return state;
  }
}
