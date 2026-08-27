import { ChevronLeft, ChevronRight, CirclePlus, Copy, Layers3, Search, Workflow } from "lucide-react";
import { nodeCatalog, NodeType, workflowNodeTypes } from "../workflow/types";

type LeftPanelProps = {
  open: boolean;
  onToggle: () => void;
  onAddNode: (type: NodeType) => void;
  onCopy: () => void;
  canCopy: boolean;
};

export function LeftPanel({ open, onToggle, onAddNode, onCopy, canCopy }: LeftPanelProps) {
  if (!open) {
    return <button className="panel-rail panel-rail-left" onClick={onToggle} aria-label="Open left panel"><ChevronRight size={17} /></button>;
  }

  return (
    <aside className="app-panel left-panel">
      <div className="panel-header">
        <div className="brand-mark brand-mark-graph" aria-label="Articulate mark"><i /><i /><i /></div>
        <div><strong>ARTICULATE</strong><span>WORKFLOW STUDIO</span></div>
        <button className="collapse-button" onClick={onToggle} aria-label="Collapse left panel"><ChevronLeft size={17} /></button>
      </div>
      <div className="blueprint-rule"><span /></div>
      <section className="workspace-brief">
        <div className="section-kicker"><Workflow size={14} /> ACTIVE WORKSPACE</div>
        <h2>Blueprint / 001</h2>
        <p>Local graph editing is active. Execution is intentionally offline.</p>
      </section>
      <div className="panel-actions">
        <button className="panel-action"><Search size={15} /> Find</button>
        <button className="panel-action" onClick={onCopy} disabled={!canCopy}><Copy size={15} /> Copy</button>
      </div>
      <section className="node-library">
        <div className="section-kicker"><Layers3 size={14} /> NODE LIBRARY</div>
        <p className="panel-caption">Add an architectural unit to the graph.</p>
        <div className="node-library-list">
          {workflowNodeTypes.map(type => (
            <button key={type} className="library-node" onClick={() => onAddNode(type)}>
              <span className="library-plus"><CirclePlus size={15} /></span>
              <span><strong>{nodeCatalog[type].label}</strong><small>{nodeCatalog[type].eyebrow}</small></span>
            </button>
          ))}
        </div>
      </section>
      <div className="panel-footnote"><i /> STORAGE BOUNDARY: LOCAL</div>
    </aside>
  );
}
