import { ChevronUp, Clipboard, Command, Eye, PanelTopClose, Redo2, Undo2 } from "lucide-react";

export type Appearance = "white" | "grey" | "night" | "system";

type TopPanelProps = {
  open: boolean;
  appearance: Appearance;
  onToggle: () => void;
  onAppearanceChange: (appearance: Appearance) => void;
  onPaste: () => void;
  canPaste: boolean;
};

const appearances: { id: Appearance; label: string }[] = [
  { id: "white", label: "White" },
  { id: "grey", label: "Grey" },
  { id: "night", label: "Night" },
  { id: "system", label: "System" },
];

export function TopPanel({ open, appearance, onToggle, onAppearanceChange, onPaste, canPaste }: TopPanelProps) {
  if (!open) return <button className="top-rail" onClick={onToggle} aria-label="Open top controls"><ChevronUp size={17} /></button>;
  return (
    <header className="top-panel">
      <div className="top-identity"><span className="top-geometry" /><div><h1>Untitled workflow</h1></div></div>
      <div className="top-center-tools">
        <div className="tool-segment"><button disabled aria-label="Undo"><Undo2 size={15} /></button><button disabled aria-label="Redo"><Redo2 size={15} /></button></div>
        <button className="top-tool" onClick={onPaste} disabled={!canPaste}><Clipboard size={15} /> Paste</button>
      </div>
      <div className="top-actions">
        <div className="appearance-menu" aria-label="Appearance modes">
          {appearances.map(item => <button key={item.id} className={appearance === item.id ? "active" : ""} onClick={() => onAppearanceChange(item.id)}>{item.label}</button>)}
        </div>
        <div className="tool-segment"><button className="top-tool-icon" aria-label="Preview unavailable"><Eye size={15} /></button><button className="top-tool-icon" aria-label="Shortcuts"><Command size={15} /></button></div>
        <button className="collapse-button top-collapse" onClick={onToggle} aria-label="Collapse top controls"><PanelTopClose size={16} /></button>
      </div>
    </header>
  );
}
