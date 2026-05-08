// Domain-level enums — mirror the Prisma enums so application/domain layers
// don't depend on @prisma/client.

export type LeadStatus =
  | "DISCOVERED"
  | "AUDITED"
  | "EMAIL_DRAFTED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "EMAIL_SENT"
  | "REPLIED"
  | "COLD"
  | "SKIPPED"
  | "REJECTED";

export type RunStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type EventLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export type EmailCadence = "DAY_0" | "DAY_3";

export type EmailStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SENT"
  | "FAILED";

// ─── Domain entity shapes ─────────────────────────────────────────────────────
// Plain TypeScript types — no Prisma imports. Infrastructure repos map to these.

export interface Lead {
  readonly id: string;
  readonly publicId: string;
  readonly gmapsPlaceId: string;
  readonly businessName: string;
  readonly address: string;
  readonly city: string;
  readonly niche: string;
  readonly phone?: string;
  readonly website?: string;
  /** Contact email extracted by Analyst phase (Playwright crawler) */
  readonly contactEmail?: string;
  readonly googleRating?: number;
  readonly reviewCount: number;
  readonly digitalScore?: number;
  readonly reviewSentiment?: string;
  readonly topIssue?: string;
  readonly reviewExcerpt?: string;
  readonly status: LeadStatus;
  readonly discoveredAt: Date;
  readonly runId: string;
}

export interface Email {
  readonly id: string;
  readonly leadId: string;
  readonly cadence: EmailCadence;
  readonly subject: string;
  readonly body: string;
  readonly wordCount: number;
  readonly status: EmailStatus;
  readonly recipientEmail?: string;
  readonly approvedBy?: string;
  readonly sentAt?: Date;
  readonly gmailMessageId?: string;
  readonly createdAt: Date;
}

export interface PipelineRun {
  readonly id: string;
  readonly prompt: string;
  readonly status: RunStatus;
  readonly startedAt: Date;
  readonly finishedAt?: Date;
  readonly leadsFound: number;
  readonly leadsScored: number;
  readonly leadsDrafted: number;
  readonly leadsEmailed: number;
  readonly errorMessage?: string;
}

// ─── Analyst phase types ──────────────────────────────────────────────────────

export interface Review {
  readonly authorName: string;
  readonly rating: number;
  readonly text: string;
  readonly time: number; // unix timestamp
}

export interface ReviewSummary {
  readonly positives: readonly string[];
  readonly negatives: readonly string[];
  readonly avgRating: number;
  readonly count: number;
}

export interface AuditRecord {
  readonly id: string;
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
  readonly auditedAt: Date;
}

export interface RunEvent {
  readonly id: string;
  readonly runId: string;
  readonly agentName: string;
  readonly level: EventLevel;
  readonly message: string;
  readonly payload?: Record<string, unknown>;
  readonly createdAt: Date;
}
