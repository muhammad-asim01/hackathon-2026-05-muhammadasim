import type { PrismaClient, Prisma, PipelineRun as PrismaRun, RunEvent as PrismaEvent } from "@prisma/client";
import type { IRunRepository, CreateRunEventData, RunUpdateData } from "@/application/ports/IRunRepository";
import type { PipelineRun, RunEvent } from "@/domain/types";

function runToDomain(row: PrismaRun): PipelineRun {
  return {
    id: row.id,
    prompt: row.prompt,
    status: row.status,
    startedAt: row.startedAt,
    leadsFound: row.leadsFound,
    leadsScored: row.leadsScored,
    leadsDrafted: row.leadsDrafted,
    leadsEmailed: row.leadsEmailed,
    ...(row.finishedAt !== null && { finishedAt: row.finishedAt }),
    ...(row.errorMessage !== null && { errorMessage: row.errorMessage }),
  };
}

function eventToDomain(row: PrismaEvent): RunEvent {
  return {
    id: row.id,
    runId: row.runId,
    agentName: row.agentName,
    level: row.level,
    message: row.message,
    createdAt: row.createdAt,
    ...(row.payload !== null && {
      payload: row.payload as Record<string, unknown>,
    }),
  };
}

export class RunRepository implements IRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(prompt: string): Promise<PipelineRun> {
    const row = await this.prisma.pipelineRun.create({
      data: { prompt, status: "QUEUED" },
    });
    return runToDomain(row);
  }

  async findById(id: string): Promise<PipelineRun | null> {
    const row = await this.prisma.pipelineRun.findUnique({ where: { id } });
    return row ? runToDomain(row) : null;
  }

  async findMany(
    options?: { limit?: number; offset?: number }
  ): Promise<readonly PipelineRun[]> {
    const rows = await this.prisma.pipelineRun.findMany({
      orderBy: { startedAt: "desc" },
      ...(options?.limit !== undefined && { take: options.limit }),
      ...(options?.offset !== undefined && { skip: options.offset }),
    });
    return rows.map(runToDomain);
  }

  async update(id: string, data: RunUpdateData): Promise<PipelineRun> {
    const row = await this.prisma.pipelineRun.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.finishedAt !== undefined && { finishedAt: data.finishedAt }),
        ...(data.leadsFound !== undefined && { leadsFound: data.leadsFound }),
        ...(data.leadsScored !== undefined && { leadsScored: data.leadsScored }),
        ...(data.leadsDrafted !== undefined && { leadsDrafted: data.leadsDrafted }),
        ...(data.leadsEmailed !== undefined && { leadsEmailed: data.leadsEmailed }),
        ...(data.errorMessage !== undefined && { errorMessage: data.errorMessage }),
      },
    });
    return runToDomain(row);
  }

  async addEvent(runId: string, event: CreateRunEventData): Promise<RunEvent> {
    const row = await this.prisma.runEvent.create({
      data: {
        runId,
        agentName: event.agentName,
        level: event.level,
        message: event.message,
        ...(event.payload !== undefined && {
          payload: event.payload as Prisma.InputJsonValue,
        }),
      },
    });
    return eventToDomain(row);
  }

  async getEvents(runId: string): Promise<readonly RunEvent[]> {
    const rows = await this.prisma.runEvent.findMany({
      where: { runId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(eventToDomain);
  }

  async getEventsByRunIds(
    runIds: readonly string[]
  ): Promise<Map<string, readonly RunEvent[]>> {
    if (runIds.length === 0) return new Map();

    const rows = await this.prisma.runEvent.findMany({
      where: { runId: { in: [...runIds] } },
      orderBy: { createdAt: "asc" },
    });

    const map = new Map<string, RunEvent[]>();
    for (const row of rows) {
      const list = map.get(row.runId);
      if (list) {
        list.push(eventToDomain(row));
      } else {
        map.set(row.runId, [eventToDomain(row)]);
      }
    }
    return map;
  }
}
