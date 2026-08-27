import {
  AlignJustify,
  Bot,
  Braces,
  Database,
  FileText,
  GitFork,
  KeyRound,
  Lock,
  MoreHorizontal,
  PanelTop,
  Sparkles,
  Upload,
} from "lucide-react";
import { PointerEvent, useState } from "react";
import { getNodeDimensions, nodeCatalog, NodeConfiguration, WorkflowNode as WorkflowNodeData } from "../workflow/types";

type NodeAction = "delete" | "duplicate" | "configure" | "toggle-lock";

type WorkflowNodeProps = {
  node: WorkflowNodeData;
  selected: boolean;
  onNodePointerDown: (event: PointerEvent<HTMLDivElement>, nodeId: string) => void;
  onPortPointerDown: (event: PointerEvent<HTMLButtonElement>, nodeId: string) => void;
  onAction: (nodeId: string, action: NodeAction) => void;
  onConfigChange: (nodeId: string, config: Partial<NodeConfiguration>) => void;
};

function NodeIcon({ type }: { type: WorkflowNodeData["type"] }) {
  const iconProps = { size: 15, strokeWidth: 1.8 };
  switch (type) {
    case "ai-agent": return <Bot {...iconProps} />;
    case "input": return <Upload {...iconProps} />;
    case "context": return <AlignJustify {...iconProps} />;
    case "output": return <PanelTop {...iconProps} />;
    case "memory": return <Database {...iconProps} />;
    case "document": return <FileText {...iconProps} />;
    case "format": return <Braces {...iconProps} />;
    case "split": return <GitFork {...iconProps} />;
  }
}

function NodeMenu({ node, onAction }: Pick<WorkflowNodeProps, "node" | "onAction">) {
  const [open, setOpen] = useState(false);
  const perform = (action: NodeAction) => {
    onAction(node.id, action);
    setOpen(false);
  };

  return (
    <div className="node-menu-wrap" onPointerDown={event => event.stopPropagation()}>
      <button className="node-menu-trigger" onClick={() => setOpen(value => !value)} aria-label={`${node.title} actions`}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="node-menu" role="menu">
          <button onClick={() => perform("configure")}>Configure</button>
          <button onClick={() => perform("duplicate")}>Duplicate</button>
          <button onClick={() => perform("toggle-lock")}>{node.locked ? "Unlock" : "Lock"}</button>
          <button className="danger" onClick={() => perform("delete")}>Delete</button>
        </div>
      )}
    </div>
  );
}

function GenericNodeContent({ node }: { node: WorkflowNodeData }) {
  const detail = String(
    node.config.summary ?? nodeCatalog[node.type].description,
  );
  return (
    <div className="node-generic-content">
      <span className="node-detail-line" />
      <p>{detail}</p>
    </div>
  );
}

export function WorkflowNode({
  node,
  selected,
  onNodePointerDown,
  onPortPointerDown,
  onAction,
  onConfigChange,
}: WorkflowNodeProps) {
  const dimensions = getNodeDimensions(node);
  const hasInput = node.type !== "input";
  const hasOutput = node.type !== "output";

  return (
    <div
      className={`workflow-node ${selected ? "is-selected" : ""} ${node.locked ? "is-locked" : ""}`}
      data-node-id={node.id}
      style={{ left: node.position.x, top: node.position.y, width: dimensions.width, minHeight: dimensions.height }}
      onPointerDown={event => onNodePointerDown(event, node.id)}
    >
      {hasInput && (
        <button
          className="node-port port-in"
          data-port-node-id={node.id}
          data-port-direction="in"
          aria-label={`Connect to ${node.title}`}
          onPointerDown={event => event.stopPropagation()}
        >
          <span />
          <small>IN</small>
        </button>
      )}
      {hasOutput && (
        <button
          className="node-port port-out"
          data-port-node-id={node.id}
          data-port-direction="out"
          aria-label={`Connect from ${node.title}`}
          onPointerDown={event => onPortPointerDown(event, node.id)}
        >
          <small>OUT</small>
          <span />
        </button>
      )}

      <div className="node-topline">
        <div className="node-kind"><NodeIcon type={node.type} /></div>
        <div className="node-index">{node.index}</div>
      </div>
      <div className="node-heading">
        <div>
          <h3>{node.title}</h3>
        </div>
        <NodeMenu node={node} onAction={onAction} />
      </div>

      {node.type === "input" ? (
        <div className="prompt-field" onPointerDown={event => event.stopPropagation()}>
          <textarea
            value={String(node.config.prompt ?? "")}
            rows={3}
            aria-label="Input prompt"
            placeholder="Write an instruction…"
            onChange={event => onConfigChange(node.id, { prompt: event.target.value })}
            onKeyDown={event => event.stopPropagation()}
          />
        </div>
      ) : node.type === "ai-agent" ? (
        <div className="agent-summary">
          <div><span>MODEL</span><strong>{String(node.config.model ?? "Not selected")}</strong></div>
          <div><span>PROVIDER</span><strong>{String(node.config.provider ?? "Not selected")}</strong></div>
          <div className={node.config.apiKeyAvailable ? "key-ready" : "key-missing"}>
            <KeyRound size={13} /><span>{node.config.apiKeyAvailable ? "KEY AVAILABLE" : "KEY REQUIRED"}</span>
            <b>{node.config.apiKeyAvailable ? "✓" : "×"}</b>
          </div>
        </div>
      ) : (
        <GenericNodeContent node={node} />
      )}

      {node.locked && <div className="node-lock-mark"><Lock size={12} /></div>}
    </div>
  );
}
