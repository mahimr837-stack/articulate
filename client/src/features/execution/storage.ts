import { ExecutionState, normalizeExecutionState } from "./executionState";

export class LocalExecutionStorageAdapter {
  constructor(private readonly key = "articulate:execution-history") {}

  async load(): Promise<ExecutionState> {
    if (typeof window === "undefined") return {};
    const value = window.localStorage.getItem(this.key);
    if (!value) return {};
    try {
      return normalizeExecutionState(JSON.parse(value) as ExecutionState);
    } catch {
      return {};
    }
  }

  async save(records: ExecutionState): Promise<void> {
    if (typeof window !== "undefined") window.localStorage.setItem(this.key, JSON.stringify(records));
  }
}
