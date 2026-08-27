import { ChevronLeft, ChevronRight, CirclePlus, Copy, Layers3, Search, Workflow, X } from "lucide-react";
import { useMemo, useState } from "react";
import { nodeCatalog, NodeType, searchNodeTypes } from "../workflow/types";

type LeftPanelProps = {
  open: boolean;
  onToggle: () => void;
  onAddNode: (type: NodeType) => void;
  onCopy: () => void;
  canCopy: boolean;
};

export function LeftPanel({ open, onToggle, onAddNode, onCopy, canCopy }: LeftPanelProps) {
  const [query, setQuery] = useState("");
  const matchingTypes = useMemo(() => searchNodeTypes(query), [query]);

  if (!open) {
    return <button className="panel-rail panel-rail-left" onClick={onToggle} aria-label="Open left panel"><ChevronRight size={17} /></button>;
  }

  return (
    <aside className="app-panel left-panel">
      <div className="panel-header">
        <div className="brand-mark brand-mark-graph" aria-label="Articulate mark"><i /><i /><i /></div>
        <div><strong>Articulate</strong></div>
        <button className="collapse-button" onClick={onToggle} aria-label="Collapse left panel"><ChevronLeft size={17} /></button>
      </div>
      <div className="blueprint-rule"><span /></div>
      <section className="workspace-brief">
        <div className="section-kicker"><Workflow size={14} /> Workspace</div>
        <h2>Untitled workflow</h2>
      </section>
      <div className="panel-actions">
        <button className="panel-action" onClick={onCopy} disabled={!canCopy}><Copy size={15} /> Copy</button>
      </div>
      <section className="node-library">
        <div className="section-kicker"><Layers3 size={14} /> Nodes</div>
        <div className="node-search">
          <Search size={14} aria-hidden="true" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search nodes"
            aria-label="Search available nodes"
          />
          {query && <button onClick={() => setQuery("")} aria-label="Clear node search"><X size={13} /></button>}
        </div>
        <p className="panel-caption">{query ? `${matchingTypes.length} result${matchingTypes.length === 1 ? "" : "s"}` : "Add to canvas"}</p>
        <div className="node-library-list">
          {matchingTypes.map(type => (
            <button key={type} className="library-node" onClick={() => onAddNode(type)}>
              <span className="library-plus"><CirclePlus size={15} /></span>
              <span><strong>{nodeCatalog[type].label}</strong><small>{nodeCatalog[type].eyebrow}</small></span>
            </button>
          ))}
          {!matchingTypes.length && <p className="node-search-empty">No matching nodes</p>}
        </div>
      </section>
    </aside>
  );
}
