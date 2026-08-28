import { Check, ChevronLeft, ChevronRight, Clock3, KeyRound, LockKeyhole, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ExecutionState, formatDuration } from "../execution/executionState";
import { NodeConfiguration, WorkflowNode } from "../workflow/types";
import { getPanelPresentation } from "./panelPresentation";

type RightPanelProps = {
  open: boolean;
  node?: WorkflowNode;
  execution: ExecutionState;
  nodes: WorkflowNode[];
  onToggle: () => void;
  onConfigChange: (nodeId: string, config: Partial<NodeConfiguration>) => void;
};

export function RightPanel({ open, node, execution, nodes, onToggle, onConfigChange }: RightPanelProps) {
  const [view, setView] = useState<"inspect" | "history">("inspect");
  const presentation = getPanelPresentation(open);
  const historyRuns = useMemo(
    () => Object.entries(execution)
      .filter(([, record]) => record.history.length > 0)
      .sort(([, a], [, b]) => (b.startedAt ?? 0) - (a.startedAt ?? 0)),
    [execution],
  );

  const isAgent = node?.type === "ai-agent";
  return (
    <>
    <aside className={`app-panel right-panel ${presentation.panelStateClass}`} aria-hidden={presentation.ariaHidden} inert={presentation.inert}>
      <div className="panel-header inspector-header">
        <div><strong>{view === "history" ? "History" : "Inspector"}</strong></div>
        <button className="collapse-button" onClick={onToggle} aria-label="Collapse inspector"><ChevronRight size={17} /></button>
      </div>
      <div className="right-panel-tabs">
        <button className={view === "inspect" ? "active" : ""} onClick={() => setView("inspect")}>Inspect</button>
        <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}><Clock3 size={13} /> History</button>
      </div>
      {view === "history" ? (
        <section className="history-panel">
          {historyRuns.length ? historyRuns.map(([inputNodeId, run]) => (
            <div className="history-run" key={inputNodeId}>
              <div className="history-run-meta"><span>Run</span><strong>{formatDuration(run.durationMs)}</strong></div>
              <ol>
                {run.history.map((step, index) => {
                  const nodeTitle = step.nodeTitle ?? nodes.find(candidate => candidate.id === step.nodeId)?.title ?? step.kind;
                  return (
                    <li key={step.id} className={`history-step state-${step.status}`}>
                      <span className="history-order">{index + 1}</span>
                      <div><strong>{nodeTitle}</strong><small>{step.kind === "agent" ? formatDuration(step.durationMs) : formatDuration(step.durationMs)}</small></div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )) : <div className="history-empty"><Clock3 size={22} /><h2>No executions yet</h2><p>Run an Input node to inspect its recorded workflow steps.</p></div>}
        </section>
      ) : node ? (
        <>
          <section className="inspector-title">
            <div className="mini-index">{String(node.index).padStart(2, "0")}</div>
            <div><h2>{node.title}</h2></div>
          </section>
          <section className="inspector-section">
            <div className="section-kicker"><SlidersHorizontal size={14} /> Configuration</div>
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
            <div className="section-kicker">Position</div>
            <div><span>X</span><b>{node.position.x}</b><span>Y</span><b>{node.position.y}</b></div>
          </section>
        </>
      ) : (
        <div className="empty-inspector"><SlidersHorizontal size={24} /><h2>Nothing selected</h2><p>Select a node on the canvas to inspect its configuration.</p></div>
      )}
    </aside>
    <button className={`panel-rail panel-rail-right ${presentation.railStateClass}`} onClick={onToggle} aria-label="Open inspector and history"><ChevronLeft size={17} /></button>
    </>
  );
}
