import { BookOpen, FilePlus2, X } from "lucide-react";
import { WorkflowTemplate } from "./workflowControls";

type WorkflowLibraryDialogProps = { mode: "templates" | "starters"; templates: WorkflowTemplate[]; onChoose: (template: WorkflowTemplate) => void; onClose: () => void; };
export function WorkflowLibraryDialog({ mode, templates, onChoose, onClose }: WorkflowLibraryDialogProps) {
  const title = mode === "templates" ? "Template library" : "Starter workflows";
  return <div className="workflow-library-backdrop" role="presentation" onPointerDown={onClose}><section className="workflow-library-dialog" role="dialog" aria-modal="true" aria-label={title} onPointerDown={event => event.stopPropagation()}>
    <header><div><BookOpen size={16} /><span>{title}</span></div><button type="button" onClick={onClose} aria-label="Close workflow library"><X size={16} /></button></header>
    <div className="workflow-library-list">{templates.length ? templates.map(template => <button key={template.id} onClick={() => onChoose(template)}><FilePlus2 size={15} /><span><strong>{template.name}</strong><small>{template.description || "Reusable workflow"}</small></span>{template.published && <em>Published</em>}</button>) : <p>No saved templates yet.</p>}</div>
  </section></div>;
}
