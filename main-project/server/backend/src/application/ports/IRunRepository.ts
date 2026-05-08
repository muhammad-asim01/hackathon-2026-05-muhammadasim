import type { PipelineRun, RunEvent, RunStatus, EventLevel } from "@/domain/types";

export interface CreateRunEventData {
  readonly agentName: string;
  readonly level: EventLevel;
  readonly message: string;
  readonly payload?: Record<string, unknown>;
}

export interface RunUpdateData {
  readonly status?: RunStatus;
  readonly finishedAt?: Date;
  readonly leadsFound?: number;
  readonly leadsScored?: number;
  readonly leadsDrafted?: number;
  readonly leadsEmailed?: number;
  readonly errorMessage?: string;
}

export interface IRunRepository {
  create(prompt: string): Promise<PipelineRun>;
  findById(id: string): Promise<PipelineRun | null>;
  /** Single DB round-trip: fetches the run AND its events together (used by SSE handler). */
  findByIdWithEvents(id: string): Promise<{ run: PipelineRun; events: readonly RunEvent[] } | null>;
  findMany(options?: { limit?: number; offset?: number }): Promise<readonly PipelineRun[]>;
  update(id: string, data: RunUpdateData): Promise<PipelineRun>;
  addEvent(runId: string, event: CreateRunEventData): Promise<RunEvent>;
  getEvents(runId: string): Promise<readonly RunEvent[]>;
  /** Batch-fetch events for multiple runs in a single query — avoids N+1 on list endpoints. */
  getEventsByRunIds(runIds: readonly string[]): Promise<Map<string, readonly RunEvent[]>>;
}
