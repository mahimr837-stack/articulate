import { BookOpen, ChevronDown, ChevronUp, Command, CopyPlus, Download, Eye, FileUp, Link2, Lock, PanelTopClose, Play, Redo2, Search, Share2, Undo2, Unlock, Unlink } from "lucide-react";
import { useMemo, useState } from "react";
import { WorkflowNode } from "../workflow/types";
import { ArticulateThinkingLogo } from "../brand/ArticulateThinkingLogo";

export type Appearance = "white" | "grey" | "night" | "system";
type WorkflowMenuAction = "save-template" | "duplicate" | "templates" | "starters" | "import" | "export" | "share" | "publish";

type TopPanelProps = {
  open: boolean;
  appearance: Appearance;
  workflowName: string;
  nodes: WorkflowNode[];
  canUndo: boolean;
  canRedo: boolean;
  selectedCount: number;
  activeGroupLocked?: boolean;
  isThinking: boolean;
  onToggle: () => void;
  onAppearanceChange: (appearance: Appearance) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFocusNode: (nodeId: string) => void;
  onWorkflowAction: (action: WorkflowMenuAction) => void;
  onGrip: () => void;
  onUngrip: () => void;
  onToggleGroupLock: () => void;
  onExecuteSelected: () => void;
};

const appearances: { id: Appearance; label: string }[] = [
  { id: "white", label: "White" }, { id: "grey", label: "Grey" }, { id: "night", label: "Night" }, { id: "system", label: "System" },
];

export function TopPanel({ open, appearance, workflowName, nodes, canUndo, canRedo, selectedCount, activeGroupLocked, isThinking, onToggle, onAppearanceChange, onUndo, onRedo, onFocusNode, onWorkflowAction, onGrip, onUngrip, onToggleGroupLock, onExecuteSelected }: TopPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? nodes.filter(node => node.title.toLocaleLowerCase().includes(normalized) || String(node.index).includes(normalized)).slice(0, 6) : [];
  }, [nodes, query]);
  const chooseAction = (action: WorkflowMenuAction) => { onWorkflowAction(action); setMenuOpen(false); };

  if (!open) return <button className="top-rail" onClick={onToggle} aria-label="Open top controls"><ChevronUp size={17} /></button>;
  return <header className="top-panel workflow-top-panel">
    <div className="top-identity"><ArticulateThinkingLogo isThinking={isThinking} size={25} /><div><h1>{workflowName}</h1></div></div>
    <div className="top-center-tools">
      <div className="tool-segment"><button onClick={onUndo} disabled={!canUndo} aria-label="Undo"><Undo2 size={15} /></button><button onClick={onRedo} disabled={!canRedo} aria-label="Redo"><Redo2 size={15} /></button></div>
      <div className="group-tools">
        <button type="button" title="Move selected nodes together" disabled={selectedCount < 2} onClick={onGrip}><Link2 size={14} /> Grip</button>
        <button type="button" title="Release this group" disabled={activeGroupLocked === undefined} onClick={onUngrip}><Unlink size={14} /> Ungrip</button>
        <button type="button" disabled={activeGroupLocked === undefined} onClick={onToggleGroupLock}>{activeGroupLocked ? <Unlock size={14} /> : <Lock size={14} />}{activeGroupLocked ? "Unlock" : "Lock"}</button>
        <button type="button" className="execute-selected" disabled={selectedCount < 2} onClick={onExecuteSelected}><Play size={13} /> Execute</button>
      </div>
      <div className="top-node-search">
        <Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find node" aria-label="Find a node by name or number" />
        {matches.length > 0 && <div className="node-search-results">{matches.map(node => <button key={node.id} onClick={() => { onFocusNode(node.id); setQuery(""); }}><span>{node.index}</span>{node.title}</button>)}</div>}
      </div>
    </div>
    <div className="top-actions">
      <div className="workflow-menu-wrap"><button className="top-tool workflow-menu-trigger" onClick={() => setMenuOpen(value => !value)}><BookOpen size={14} /> Workflow <ChevronDown size={12} /></button>{menuOpen && <div className="workflow-menu">
        <button onClick={() => chooseAction("save-template")}>Save as template</button><button onClick={() => chooseAction("duplicate")}>Duplicate workflow</button><button onClick={() => chooseAction("templates")}>Template library</button><button onClick={() => chooseAction("starters")}>Starter workflows</button>
        <span /><button onClick={() => chooseAction("import")}><FileUp size={13} /> Import workflow</button><button onClick={() => chooseAction("export")}><Download size={13} /> Export workflow</button><button onClick={() => chooseAction("share")}><Share2 size={13} /> Share workflow</button><button onClick={() => chooseAction("publish")}><CopyPlus size={13} /> Publish template</button>
      </div>}</div>
      <div className="appearance-menu" aria-label="Appearance modes">{appearances.map(item => <button key={item.id} className={appearance === item.id ? "active" : ""} onClick={() => onAppearanceChange(item.id)}>{item.label}</button>)}</div>
      <div className="tool-segment"><button className="top-tool-icon" aria-label="Preview unavailable"><Eye size={15} /></button><button className="top-tool-icon" aria-label="Shortcuts"><Command size={15} /></button></div>
      <button className="collapse-button top-collapse" onClick={onToggle} aria-label="Collapse top controls"><PanelTopClose size={16} /></button>
    </div>
  </header>;
}
