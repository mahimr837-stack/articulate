import { Check, ChevronLeft, ChevronRight, KeyRound, LockKeyhole, SlidersHorizontal, X } from "lucide-react";
import { NodeConfiguration, WorkflowNode } from "../workflow/types";

type RightPanelProps = {
  open: boolean;
  node?: WorkflowNode;
  onToggle: () => void;
  onConfigChange: (nodeId: string, config: Partial<NodeConfiguration>) => void;
};

export function RightPanel({ open, node, onToggle, onConfigChange }: RightPanelProps) {
  if (!open) {
    return <button className="panel-rail panel-rail-right" onClick={onToggle} aria-label="Open inspector"><ChevronLeft size={17} /></button>;
  }

  const isAgent = node?.type === "ai-agent";
  return (
    <aside className="app-panel right-panel">
      <div className="panel-header inspector-header">
        <div><strong>INSPECTOR</strong><span>{node ? `NODE ${String(node.index).padStart(2, "0")}` : "NO SELECTION"}</span></div>
        <button className="collapse-button" onClick={onToggle} aria-label="Collapse inspector"><ChevronRight size={17} /></button>
      </div>
      <div className="blueprint-rule"><span /></div>
      {node ? (
        <>
          <section className="inspector-title">
            <div className="mini-index">{String(node.index).padStart(2, "0")}</div>
            <div><p>{node.type.toUpperCase().replace("-", " ")}</p><h2>{node.title}</h2></div>
          </section>
          <section className="inspector-section">
            <div className="section-kicker"><SlidersHorizontal size={14} /> CONFIGURATION</div>
            {isAgent ? (
              <div className="agent-config-form">
                <label>Provider
                  <select value={String(node.config.provider ?? "Manus")} onChange={event => onConfigChange(node.id, { provider: event.target.value })}>
                    <option>Manus</option><option>OpenAI</option><option>Anthropic</option><option>Google</option>
                  </select>
                </label>
                <label>Model
                  <select value={String(node.config.model ?? "Manus 1.6")} onChange={event => onConfigChange(node.id, { model: event.target.value })}>
                    <option>Manus 1.6</option><option>Manus 1.5</option><option>GPT-5</option><option>Claude Sonnet</option>
                  </select>
                </label>
                <label>API key
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={node.config.apiKeyAvailable ? "Key available — hidden" : "Enter key to mark available"}
                    onBlur={event => {
                      if (event.target.value.trim()) {
                        onConfigChange(node.id, { apiKeyAvailable: true });
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
                <div className={`key-status ${node.config.apiKeyAvailable ? "available" : "unavailable"}`}>
                  <KeyRound size={14} />
                  <span>{node.config.apiKeyAvailable ? "API key available" : "API key unavailable"}</span>
                  {node.config.apiKeyAvailable ? <Check size={15} /> : <X size={15} />}
                </div>
                <p className="security-note"><LockKeyhole size={13} /> Keys are never retained in local graph data.</p>
              </div>
            ) : (
              <div className="config-placeholder"><p>This node has an extensible configuration boundary ready for its next implementation phase.</p><code>config.{node.type.replace("-", "_")}</code></div>
            )}
          </section>
          <section className="inspector-section position-readout">
            <div className="section-kicker">POSITION</div>
            <div><span>X</span><b>{node.position.x}</b><span>Y</span><b>{node.position.y}</b></div>
          </section>
        </>
      ) : (
        <div className="empty-inspector"><SlidersHorizontal size={24} /><h2>Nothing selected</h2><p>Select a node on the canvas to inspect its configuration.</p></div>
      )}
      <div className="panel-footnote"><i /> PERSISTENCE: SUPABASE-READY</div>
    </aside>
  );
}
