import { FileText, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DocumentFile, WorkflowNode } from "../workflow/types";

type TunnelTargetPickerProps = {
  source: WorkflowNode;
  nodes: WorkflowNode[];
  onConfirm: (targetNodeId: string, fileIds: string[]) => void;
  onClose: () => void;
};

export function TunnelTargetPicker({ source, nodes, onConfirm, onClose }: TunnelTargetPickerProps) {
  const files = (source.config.files as DocumentFile[] | undefined) ?? [];
  const targets = nodes.filter(node => node.id !== source.id);
  const [targetNodeId, setTargetNodeId] = useState(targets[0]?.id ?? "");
  const [fileIds, setFileIds] = useState<string[]>(() => files.map(file => file.id));

  useEffect(() => {
    setTargetNodeId(targets[0]?.id ?? "");
    setFileIds(files.map(file => file.id));
  }, [source.id]);

  const toggleFile = (fileId: string) => setFileIds(ids => ids.includes(fileId) ? ids.filter(id => id !== fileId) : [...ids, fileId]);

  return <div className="tunnel-picker-backdrop" role="presentation" onPointerDown={onClose}>
    <section className="tunnel-picker" role="dialog" aria-modal="true" aria-label="Tunnel documents" onPointerDown={event => event.stopPropagation()}>
      <header><div><Send size={15} /><span>Tunnel documents</span></div><button type="button" onClick={onClose} aria-label="Close"><X size={16} /></button></header>
      {files.length ? <>
        <p>Send selected files from <strong>{source.title}</strong> directly to another node. Existing ropes remain unchanged.</p>
        <div className="tunnel-file-list">{files.map(file => <label key={file.id}><input type="checkbox" checked={fileIds.includes(file.id)} onChange={() => toggleFile(file.id)} /><FileText size={13} /><span>{file.name}</span></label>)}</div>
        <label className="tunnel-target-label">Target node<select value={targetNodeId} onChange={event => setTargetNodeId(event.target.value)}>{targets.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
        <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" className="primary" disabled={!targetNodeId || !fileIds.length} onClick={() => onConfirm(targetNodeId, fileIds)}>Tunnel</button></footer>
      </> : <><div className="tunnel-empty"><FileText size={22} /><strong>No files to tunnel</strong><span>Upload a file to this Document node first.</span></div><footer><button type="button" onClick={onClose}>Close</button></footer></>}
    </section>
  </div>;
}
