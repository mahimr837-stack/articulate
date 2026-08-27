import { ArrowRight, Code2, X } from "lucide-react";
import { getEffectiveWorkflowEdges, WorkflowNode, WorkflowState } from "../workflow/types";

type RawDataViewProps = {
  workflow: WorkflowState;
  node: WorkflowNode;
  onClose: () => void;
};

const rawNodeContent = (node?: WorkflowNode) => node
  ? JSON.stringify({
      type: node.type,
      title: node.title,
      config: node.config,
      bypassed: node.bypassed,
      disabled: node.disabled,
    }, null, 2)
  : "No connected node";

export function getNodeNeighborhood(workflow: WorkflowState, node: WorkflowNode) {
  const edges = getEffectiveWorkflowEdges(workflow);
  const previous = edges.find(edge => edge.target === node.id);
  const next = edges.find(edge => edge.source === node.id);
  return {
    previous: previous ? workflow.nodes.find(candidate => candidate.id === previous.source) : undefined,
    next: next ? workflow.nodes.find(candidate => candidate.id === next.target) : undefined,
  };
}

export function RawDataView({ workflow, node, onClose }: RawDataViewProps) {
  const { previous: previousNode, next: nextNode } = getNodeNeighborhood(workflow, node);
  const nodes = [previousNode, node, nextNode];

  return (
    <div className="raw-data-backdrop" role="presentation" onPointerDown={onClose}>
      <section className="raw-data-view" role="dialog" aria-modal="true" aria-label="Node raw data" onPointerDown={event => event.stopPropagation()}>
        <header>
          <div><Code2 size={16} /><span>Raw data</span></div>
          <button type="button" onClick={onClose} aria-label="Close raw data"><X size={16} /></button>
        </header>
        <div className="raw-data-chain">
          {nodes.map((entry, index) => (
            <div key={entry?.id ?? `empty-${index}`} className={`raw-data-node ${index === 1 ? "is-focus" : ""}`}>
              <div className="raw-data-node-title"><span>{index === 0 ? "Previous" : index === 1 ? "Selected" : "Next"}</span><strong>{entry?.title ?? "No node"}</strong></div>
              <pre>{rawNodeContent(entry)}</pre>
              {index < nodes.length - 1 && <ArrowRight className="raw-data-arrow" size={17} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
