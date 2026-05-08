import type { AuditRecord } from "@/domain/types";

export interface CreateAuditInput {
  readonly leadId: string;
  readonly pageSpeedScore?: number;
  readonly mobileScore?: number;
  readonly loadTimeMs?: number;
  readonly hasSSL: boolean;
  readonly hasMobileMeta: boolean;
  readonly hasMetaTags: boolean;
  readonly hasCTA: boolean;
  readonly reviewSummary: Record<string, unknown>;
  readonly rawFindings: Record<string, unknown>;
}

export interface IAuditRepository {
  create(input: CreateAuditInput): Promise<AuditRecord>;
  findByLeadId(leadId: string): Promise<AuditRecord | null>;
}
