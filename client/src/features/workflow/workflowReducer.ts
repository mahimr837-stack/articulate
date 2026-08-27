import { createWorkflowEdge, isWorkflowEdgeEnabled, WorkflowEdge, WorkflowNode, WorkflowSelection, WorkflowState } from "./types";

export type WorkflowAction =
  | { type: "replace"; workflow: WorkflowState }
  | { type: "set-selection"; selection: WorkflowSelection }
  | { type: "add-nodes"; nodes: WorkflowNode[]; select: boolean }
  | { type: "move-nodes"; positions: Record<string, { x: number; y: number }> }
  | { type: "update-node"; nodeId: string; patch: Partial<Pick<WorkflowNode, "title" | "config">> }
  | { type: "toggle-lock"; nodeId: string }
  | { type: "toggle-bypass"; nodeId: string }
  | { type: "toggle-disable"; nodeId: string }
  | { type: "delete-nodes"; nodeIds: string[] }
  | { type: "add-edge"; edge: WorkflowEdge }
  | { type: "toggle-edge"; edgeId: string }
  | { type: "delete-edge"; edgeId: string };

const stamp = (state: WorkflowState, patch: Partial<WorkflowState>): WorkflowState => ({
  ...state,
  ...patch,
  updatedAt: Date.now(),
});

export function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case "replace":
      return {
        ...action.workflow,
        nodes: action.workflow.nodes.map(node => ({
          ...node,
          bypassed: node.bypassed ?? false,
          disabled: node.disabled ?? false,
        })),
        edges: action.workflow.edges.map(edge => createWorkflowEdge(edge)),
      };
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
    case "toggle-bypass":
      return stamp(state, {
        nodes: state.nodes.map(node =>
          node.id === action.nodeId
            ? { ...node, bypassed: !node.bypassed, disabled: false }
            : node,
        ),
      });
    case "toggle-disable":
      return stamp(state, {
        nodes: state.nodes.map(node =>
          node.id === action.nodeId
            ? { ...node, disabled: !node.disabled, bypassed: false }
            : node,
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
          edge.targetPort === action.edge.targetPort &&
          edge.metadata?.documentId === action.edge.metadata?.documentId &&
          Boolean(edge.metadata?.tunnel) === Boolean(action.edge.metadata?.tunnel),
      );
      return duplicate ? state : stamp(state, { edges: [...state.edges, action.edge] });
    }
    case "toggle-edge":
      return stamp(state, {
        edges: state.edges.map(edge =>
          edge.id === action.edgeId
            ? { ...edge, enabled: !isWorkflowEdgeEnabled(edge), mode: edge.mode ?? "standard" }
            : edge,
        ),
      });
    case "delete-edge":
      return stamp(state, {
        edges: state.edges.filter(edge => edge.id !== action.edgeId),
        selection: {
          nodeIds: state.selection.nodeIds,
          edgeIds: state.selection.edgeIds.filter(edgeId => edgeId !== action.edgeId),
        },
      });
    default:
      return state;
  }
}
