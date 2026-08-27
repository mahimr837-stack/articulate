import { normalizeWorkflow, WorkflowState } from "./types";

export interface WorkflowStorageAdapter {
  load(workflowId: string): Promise<WorkflowState | null>;
  save(workflow: WorkflowState): Promise<void>;
}

export class LocalWorkflowStorageAdapter implements WorkflowStorageAdapter {
  constructor(private readonly keyPrefix = "articulate:workflow:") {}

  async load(workflowId: string): Promise<WorkflowState | null> {
    if (typeof window === "undefined") return null;
    const value = window.localStorage.getItem(`${this.keyPrefix}${workflowId}`);
    if (!value) return null;
    try {
      return normalizeWorkflow(JSON.parse(value) as WorkflowState);
    } catch {
      return null;
    }
  }

  async save(workflow: WorkflowState): Promise<void> {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${this.keyPrefix}${workflow.id}`, JSON.stringify(workflow));
    }
  }
}

export type SupabaseWorkflowRow = {
  id: string;
  name: string;
  graph: WorkflowState;
  updated_at: string;
};

/**
 * The future Supabase adapter intentionally depends on a tiny client contract.
 * The initial editor does not send workflow data to a backend or store raw API keys.
 */
export interface SupabaseWorkflowClient {
  from(table: "workflows"): {
    select(columns: string): { eq(column: string, value: string): { maybeSingle(): Promise<{ data: SupabaseWorkflowRow | null; error: Error | null }> } };
    upsert(row: Omit<SupabaseWorkflowRow, "updated_at">): Promise<{ error: Error | null }>;
  };
}

export class SupabaseWorkflowStorageAdapter implements WorkflowStorageAdapter {
  constructor(private readonly client: SupabaseWorkflowClient) {}

  async load(workflowId: string): Promise<WorkflowState | null> {
    const { data, error } = await this.client.from("workflows").select("id,name,graph,updated_at").eq("id", workflowId).maybeSingle();
    if (error) throw error;
    return data?.graph ? normalizeWorkflow(data.graph) : null;
  }

  async save(workflow: WorkflowState): Promise<void> {
    const { error } = await this.client.from("workflows").upsert({
      id: workflow.id,
      name: workflow.name,
      graph: workflow,
    });
    if (error) throw error;
  }
}
