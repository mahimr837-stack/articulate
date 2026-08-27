import { ArrowRight, Code2, X } from "lucide-react";
import { getEffectiveWorkflowEdges, WorkflowEdge, WorkflowNode, WorkflowState } from "../workflow/types";

type RawDataViewProps = {
  workflow: WorkflowState;
  node: WorkflowNode;
  onClose: () => void;
};

const rawNodeContent = (node?: WorkflowNode, relationships?: { incoming: WorkflowEdge[]; outgoing: WorkflowEdge[] }) => node
  ? JSON.stringify({
      type: node.type,
      title: node.title,
      config: node.config,
      bypassed: node.bypassed,
      disabled: node.disabled,
      ...(relationships ? { connections: relationships } : {}),
    }, null, 2)
  : "No connected node";

export function getNodeNeighborhood(workflow: WorkflowState, node: WorkflowNode) {
  const edges = getEffectiveWorkflowEdges(workflow);
  const incomingEdges = edges.filter(edge => edge.target === node.id);
  const outgoingEdges = edges.filter(edge => edge.source === node.id);
  const previousNodes = incomingEdges.flatMap(edge => {
    const candidate = workflow.nodes.find(nodeCandidate => nodeCandidate.id === edge.source);
    return candidate ? [candidate] : [];
  });
  const nextNodes = outgoingEdges.flatMap(edge => {
    const candidate = workflow.nodes.find(nodeCandidate => nodeCandidate.id === edge.target);
    return candidate ? [candidate] : [];
  });
  return {
    previous: previousNodes[0],
    next: nextNodes[0],
    previousNodes,
    nextNodes,
    incomingEdges,
    outgoingEdges,
  };
}

export function RawDataView({ workflow, node, onClose }: RawDataViewProps) {
  const { previousNodes, nextNodes, incomingEdges, outgoingEdges } = getNodeNeighborhood(workflow, node);
  const columns = [
    { label: "Previous", entries: previousNodes },
    { label: "Selected", entries: [node] },
    { label: "Next", entries: nextNodes },
  ];

  return (
    <div className="raw-data-backdrop" role="presentation" onPointerDown={onClose}>
      <section className="raw-data-view" role="dialog" aria-modal="true" aria-label="Node raw data" onPointerDown={event => event.stopPropagation()}>
        <header>
          <div><Code2 size={16} /><span>Raw data</span></div>
          <button type="button" onClick={onClose} aria-label="Close raw data"><X size={16} /></button>
        </header>
        <div className="raw-data-chain">
          {columns.map((column, index) => (
            <div key={column.label} className="raw-data-column">
              {column.entries.length ? column.entries.map(entry => (
                <div key={entry.id} className={`raw-data-node ${index === 1 ? "is-focus" : ""}`}>
                  <div className="raw-data-node-title"><span>{column.label}{column.entries.length > 1 ? ` (${column.entries.length})` : ""}</span><strong>{entry.title}</strong></div>
                  <pre>{rawNodeContent(entry, index === 1 ? { incoming: incomingEdges, outgoing: outgoingEdges } : undefined)}</pre>
                </div>
              )) : <div className="raw-data-node"><div className="raw-data-node-title"><span>{column.label}</span><strong>No node</strong></div><pre>No connected node</pre></div>}
              {index < columns.length - 1 && <ArrowRight className="raw-data-arrow" size={17} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
