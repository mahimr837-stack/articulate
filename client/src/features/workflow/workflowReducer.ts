import { createNodeGroup, createSelectedExecutionEdges, createWorkflowEdge, isWorkflowEdgeEnabled, normalizeWorkflow, WorkflowEdge, WorkflowNode, WorkflowSelection, WorkflowState } from "./types";

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
  | { type: "delete-edge"; edgeId: string }
  | { type: "grip-selection"; groupId: string }
  | { type: "ungrip-selected" }
  | { type: "toggle-group-lock"; groupId: string }
  | { type: "execute-selected"; executionId: string };

const stamp = (state: WorkflowState, patch: Partial<WorkflowState>): WorkflowState => ({
  ...state,
  ...patch,
  updatedAt: Date.now(),
});

export function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case "replace":
      return normalizeWorkflow(action.workflow);
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
      {
        const groupLockedNodeIds = new Set((state.groups ?? []).filter(group => group.locked).flatMap(group => group.nodeIds));
        let changed = false;
        const nodes = state.nodes.map(node => {
          const nextPosition = action.positions[node.id];
          const canMove = nextPosition && !node.locked && !groupLockedNodeIds.has(node.id);
          if (!canMove || (node.position.x === nextPosition.x && node.position.y === nextPosition.y)) return node;
          changed = true;
          return { ...node, position: nextPosition };
        });
        return changed ? stamp(state, { nodes }) : state;
      }
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
        groups: (state.groups ?? []).map(group => ({ ...group, nodeIds: group.nodeIds.filter(nodeId => !removed.has(nodeId)) })).filter(group => group.nodeIds.length > 1),
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
          Boolean(edge.metadata?.tunnel) === Boolean(action.edge.metadata?.tunnel) &&
          Boolean(edge.metadata?.selectedExecution) === Boolean(action.edge.metadata?.selectedExecution),
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
    case "grip-selection": {
      const selectedIds = state.selection.nodeIds;
      if (selectedIds.length < 2) return state;
      const selected = new Set(selectedIds);
      const retainedGroups = (state.groups ?? [])
        .map(group => ({ ...group, nodeIds: group.nodeIds.filter(nodeId => !selected.has(nodeId)) }))
        .filter(group => group.nodeIds.length > 1);
      return stamp(state, { groups: [...retainedGroups, createNodeGroup(action.groupId, selectedIds)] });
    }
    case "ungrip-selected": {
      const selected = new Set(state.selection.nodeIds);
      return stamp(state, { groups: (state.groups ?? []).map(group => ({ ...group, nodeIds: group.nodeIds.filter(nodeId => !selected.has(nodeId)) })).filter(group => group.nodeIds.length > 1) });
    }
    case "toggle-group-lock":
      return stamp(state, { groups: (state.groups ?? []).map(group => group.id === action.groupId ? { ...group, locked: !group.locked } : group) });
    case "execute-selected": {
      if (state.selection.nodeIds.length < 2) return state;
      const edges = createSelectedExecutionEdges(state, state.selection.nodeIds, action.executionId);
      const existing = new Set(state.edges.map(edge => edge.id));
      const additions = edges.filter(edge => !existing.has(edge.id) && !state.edges.some(existingEdge =>
        existingEdge.source === edge.source
        && existingEdge.target === edge.target
        && Boolean(existingEdge.metadata?.selectedExecution),
      ));
      return additions.length ? stamp(state, { edges: [...state.edges, ...additions] }) : state;
    }
    default:
      return state;
  }
}
