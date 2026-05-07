import type { PrismaClient, Prisma } from "@prisma/client";
import type { IAuditRepository, CreateAuditInput } from "@/application/ports/IAuditRepository";
import type { AuditRecord } from "@/domain/types";

function toAuditRecord(row: {
  id: string;
  leadId: string;
  pageSpeedScore: number | null;
  mobileScore: number | null;
  loadTimeMs: number | null;
  hasSSL: boolean;
  hasMobileMeta: boolean;
  hasMetaTags: boolean;
  hasCTA: boolean;
  reviewSummary: unknown;
  rawFindings: unknown;
  auditedAt: Date;
}): AuditRecord {
  return {
    id: row.id,
    leadId: row.leadId,
    ...(row.pageSpeedScore !== null && { pageSpeedScore: row.pageSpeedScore }),
    ...(row.mobileScore !== null && { mobileScore: row.mobileScore }),
    ...(row.loadTimeMs !== null && { loadTimeMs: row.loadTimeMs }),
    hasSSL: row.hasSSL,
    hasMobileMeta: row.hasMobileMeta,
    hasMetaTags: row.hasMetaTags,
    hasCTA: row.hasCTA,
    reviewSummary: (row.reviewSummary ?? {}) as Record<string, unknown>,
    rawFindings: (row.rawFindings ?? {}) as Record<string, unknown>,
    auditedAt: row.auditedAt,
  };
}

export class AuditRepository implements IAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAuditInput): Promise<AuditRecord> {
    const row = await this.prisma.audit.create({
      data: {
        leadId: input.leadId,
        ...(input.pageSpeedScore !== undefined && { pageSpeedScore: input.pageSpeedScore }),
        ...(input.mobileScore !== undefined && { mobileScore: input.mobileScore }),
        ...(input.loadTimeMs !== undefined && { loadTimeMs: input.loadTimeMs }),
        hasSSL: input.hasSSL,
        hasMobileMeta: input.hasMobileMeta,
        hasMetaTags: input.hasMetaTags,
        hasCTA: input.hasCTA,
        reviewSummary: input.reviewSummary as Prisma.InputJsonValue,
        rawFindings: input.rawFindings as Prisma.InputJsonValue,
      },
    });
    return toAuditRecord(row);
  }

  async findByLeadId(leadId: string): Promise<AuditRecord | null> {
    const row = await this.prisma.audit.findUnique({ where: { leadId } });
    return row ? toAuditRecord(row) : null;
  }
}
