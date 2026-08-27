import {
  AlignJustify,
  Bot,
  Braces,
  ChevronUp,
  CircleOff,
  Clock3,
  Copy,
  Code2,
  Database,
  FileText,
  GitFork,
  KeyRound,
  Lock,
  MoreHorizontal,
  PanelTop,
  Power,
  Share2,
  Settings2,
  Sparkles,
  StickyNote,
  SkipForward,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import { ChangeEvent, PointerEvent, ReactNode, useEffect, useState } from "react";
import { formatDuration, getExecutionDuration, NodeExecution, idleExecution } from "../execution/executionState";
import { DocumentFile, getNodeDimensions, nodeCatalog, NodeConfiguration, WorkflowNode as WorkflowNodeData } from "../workflow/types";

type NodeAction = "delete" | "duplicate" | "configure" | "toggle-lock" | "toggle-bypass" | "toggle-disable" | "view-raw" | "tunnel";

type WorkflowNodeProps = {
  node: WorkflowNodeData;
  selected: boolean;
  onNodePointerDown: (event: PointerEvent<HTMLDivElement>, nodeId: string) => void;
  onPortPointerDown: (event: PointerEvent<HTMLButtonElement>, nodeId: string) => void;
  onAction: (nodeId: string, action: NodeAction) => void;
  onConfigChange: (nodeId: string, config: Partial<NodeConfiguration>) => void;
  execution?: NodeExecution;
  onExecutionAction?: (nodeId: string, action: "run" | "pause" | "resume" | "retry") => void;
  onDocumentUpload?: (nodeId: string, files: File[]) => void;
  isDocumentUploading?: boolean;
  documentError?: string;
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
    case "blank": return <StickyNote {...iconProps} />;
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
          <button className="node-menu-icon-item" onClick={() => perform("view-raw")}><Code2 size={13} /> Raw data</button>
          {node.type === "document" && <button className="node-menu-icon-item" onClick={() => perform("tunnel")}><Share2 size={13} /> Tunnel</button>}
          <button onClick={() => perform("duplicate")}>Duplicate</button>
          <button onClick={() => perform("toggle-bypass")}>{node.bypassed ? "Restore" : "Bypass"}</button>
          <button onClick={() => perform("toggle-disable")}>{node.disabled ? "Enable" : "Disable"}</button>
          <button onClick={() => perform("toggle-lock")}>{node.locked ? "Unlock" : "Lock"}</button>
          <button className="danger" onClick={() => perform("delete")}>Delete</button>
        </div>
      )}
    </div>
  );
}

function NodeQuickActions({ node, onAction }: Pick<WorkflowNodeProps, "node" | "onAction">) {
  const actions: { id: NodeAction; label: string; icon: ReactNode; destructive?: boolean }[] = [
    { id: "configure", label: "Configure", icon: <Settings2 size={14} /> },
    { id: "duplicate", label: "Duplicate", icon: <Copy size={14} /> },
    { id: "toggle-lock", label: node.locked ? "Unlock" : "Lock", icon: node.locked ? <Unlock size={14} /> : <Lock size={14} /> },
    { id: "delete", label: "Delete", icon: <Trash2 size={14} />, destructive: true },
  ];

  return (
    <div className="node-quick-actions" onPointerDown={event => event.stopPropagation()} aria-label={`${node.title} quick actions`}>
      {actions.map(action => (
        <button
          key={action.id}
          type="button"
          className={action.destructive ? "danger" : ""}
          title={action.label}
          aria-label={action.label}
          onClick={() => onAction(node.id, action.id)}
        >
          {action.icon}
        </button>
      ))}
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

function ExecutionTimer({ execution }: { execution: NodeExecution }) {
  const [now, setNow] = useState(() => Date.now());
  const active = execution.status === "running" || execution.status === "retrying";

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [active]);

  if (!active || !execution.startedAt) return null;
  return <div className="input-execution-timer"><Clock3 size={12} /> {formatDuration(getExecutionDuration(execution, now))}</div>;
}

function DocumentNodeContent({ node, onDocumentUpload, isDocumentUploading, documentError }: Pick<WorkflowNodeProps, "node" | "onDocumentUpload" | "isDocumentUploading" | "documentError">) {
  const files = (node.config.files as DocumentFile[] | undefined) ?? [];
  const onFilesChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length) onDocumentUpload?.(node.id, selected);
    event.target.value = "";
  };

  const tunnels = (node.config.tunnels ?? []).length;
  return <div className="document-node-content" onPointerDown={event => event.stopPropagation()}>
    <div className="document-file-list">
      {files.length ? files.slice(0, 4).map(file => <a key={file.id} href={file.storageUrl} target="_blank" rel="noreferrer" title={file.name}><FileText size={13} /><span>{file.name}</span></a>) : <p>No files uploaded</p>}
    </div>
    <label className="document-upload-control">
      <Upload size={13} /><span>{isDocumentUploading ? "Uploading…" : "Upload files"}</span>
      <input type="file" multiple onChange={onFilesChosen} disabled={isDocumentUploading} />
    </label>
    {tunnels > 0 && <p className="document-tunnel-count"><Share2 size={12} /> {tunnels} tunnel{tunnels === 1 ? "" : "s"}</p>}
    {documentError && <p className="document-error">{documentError}</p>}
  </div>;
}

function FormatNodeContent({ node, onConfigChange }: Pick<WorkflowNodeProps, "node" | "onConfigChange">) {
  return <div className="node-editable-content" onPointerDown={event => event.stopPropagation()}>
    <textarea value={String(node.config.formatInstruction ?? "")} placeholder="Describe what to extract or classify" onChange={event => onConfigChange(node.id, { formatInstruction: event.target.value })} onKeyDown={event => event.stopPropagation()} />
  </div>;
}

function SplitNodeContent({ node, onConfigChange }: Pick<WorkflowNodeProps, "node" | "onConfigChange">) {
  const outputs = (node.config.splitOutputs as string[] | undefined) ?? [];
  const updateOutput = (index: number, value: string) => onConfigChange(node.id, { splitOutputs: outputs.map((output, outputIndex) => outputIndex === index ? value : output) });
  return <div className="split-node-content" onPointerDown={event => event.stopPropagation()}>
    {outputs.map((output, index) => <label key={`${index}-${output}`}><span>{index + 1}</span><input value={output} aria-label={`Split output ${index + 1}`} onChange={event => updateOutput(index, event.target.value)} /></label>)}
    <button type="button" onClick={() => onConfigChange(node.id, { splitOutputs: [...outputs, `Output ${outputs.length + 1}`] })}>Add output</button>
  </div>;
}

function BlankNodeContent({ node, onConfigChange }: Pick<WorkflowNodeProps, "node" | "onConfigChange">) {
  return <div className="node-editable-content blank-node-content" onPointerDown={event => event.stopPropagation()}>
    <textarea value={String(node.config.blankContent ?? "")} placeholder="Write anything…" onChange={event => onConfigChange(node.id, { blankContent: event.target.value })} onKeyDown={event => event.stopPropagation()} />
  </div>;
}

export function WorkflowNode({
  node,
  selected,
  onNodePointerDown,
  onPortPointerDown,
  onAction,
  onConfigChange,
  execution = idleExecution,
  onExecutionAction,
  onDocumentUpload,
  isDocumentUploading,
  documentError,
}: WorkflowNodeProps) {
  const dimensions = getNodeDimensions(node);
  const hasInput = node.type !== "input";
  const hasOutput = node.type !== "output";
  const [executionTimeOpen, setExecutionTimeOpen] = useState(false);
  const hasRecordedExecution = node.type === "input" && execution.status !== "idle" && execution.durationMs !== undefined && execution.status !== "running" && execution.status !== "retrying";

  return (
    <div
      className={`workflow-node ${selected ? "is-selected" : ""} ${node.locked ? "is-locked" : ""}`}
      data-node-id={node.id}
      style={{ left: node.position.x, top: node.position.y, width: dimensions.width, minHeight: dimensions.height }}
      onPointerDown={event => onNodePointerDown(event, node.id)}
    >
      {node.type === "input" && <ExecutionTimer execution={execution} />}
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
        {hasRecordedExecution && (
          <div className="input-timing-wrap" onPointerDown={event => event.stopPropagation()}>
            <button
              className="input-timing-control"
              type="button"
              aria-label="Show recorded execution time"
              aria-expanded={executionTimeOpen}
              onClick={() => setExecutionTimeOpen(open => !open)}
            ><ChevronUp size={13} /></button>
            {executionTimeOpen && <div className="input-timing-panel"><span>Last run</span><strong>{formatDuration(execution.durationMs)}</strong></div>}
          </div>
        )}
        <div className="node-index">{node.index}</div>
      </div>
      <div className="node-heading">
        <div>
          <h3>{node.title}</h3>
        </div>
        <NodeMenu node={node} onAction={onAction} />
      </div>

      {node.bypassed && <div className="node-state-indicator state-bypassed"><SkipForward size={11} /> Bypassed</div>}
      {node.disabled && <div className="node-state-indicator state-disabled"><CircleOff size={11} /> Disabled</div>}

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
      ) : node.type === "document" ? (
        <DocumentNodeContent node={node} onDocumentUpload={onDocumentUpload} isDocumentUploading={isDocumentUploading} documentError={documentError} />
      ) : node.type === "format" ? (
        <FormatNodeContent node={node} onConfigChange={onConfigChange} />
      ) : node.type === "split" ? (
        <SplitNodeContent node={node} onConfigChange={onConfigChange} />
      ) : node.type === "blank" ? (
        <BlankNodeContent node={node} onConfigChange={onConfigChange} />
      ) : (
        <GenericNodeContent node={node} />
      )}

      {node.type === "input" && onExecutionAction && (
        <div className="input-execution" onPointerDown={event => event.stopPropagation()}>
          {execution.status !== "idle" && <span className={`execution-state state-${execution.status}`}>{execution.status}</span>}
          <button
            type="button"
            className={`input-run-control state-${execution.status}`}
            disabled={execution.status === "retrying"}
            onClick={() => {
              const action = execution.status === "running" || execution.status === "retrying"
                ? "pause"
                : execution.status === "paused"
                  ? "resume"
                  : execution.status === "failed"
                    ? "retry"
                    : "run";
              onExecutionAction(node.id, action);
            }}
          >
            {execution.status === "running" || execution.status === "retrying"
              ? "Pause"
              : execution.status === "paused"
                ? "Resume"
                : execution.status === "failed"
                  ? "Retry"
                  : "Run"}
          </button>
          {execution.error && <p className="execution-error">{execution.error}</p>}
        </div>
      )}

      {node.locked && <div className="node-lock-mark"><Lock size={12} /></div>}
      {selected && <NodeQuickActions node={node} onAction={onAction} />}
    </div>
  );
}
