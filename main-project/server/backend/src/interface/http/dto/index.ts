/**
 * Response DTOs — maps backend domain types to the shapes the frontend
 * expects. This is the single place to update when the frontend contract changes.
 *
 * Frontend status values (lowercase) match the mock data in lib/mock/*.ts so
 * Phase UI-2 can swap mock calls for real API calls with zero component changes.
 */
import type { Lead, PipelineRun, RunEvent, Email } from "@/domain/types";
import type { LeadStatus, RunStatus, EmailStatus, EventLevel } from "@/domain/types";

// ─── Frontend-compatible status types ────────────────────────────────────────

export type FrontendLeadStatus = "new" | "contacted" | "approved" | "rejected" | "cold";
export type FrontendRunStatus = "running" | "complete" | "failed" | "queued";
export type FrontendEmailStatus = "pending" | "approved" | "rejected" | "sent" | "failed";
export type FrontendEventLevel = "info" | "success" | "warning" | "error";
export type FrontendAgentStatus = "pending" | "running" | "done" | "failed";

// ─── Status mappers ───────────────────────────────────────────────────────────

function mapLeadStatus(s: LeadStatus): FrontendLeadStatus {
  switch (s) {
    case "DISCOVERED":
    case "AUDITED":
    case "EMAIL_DRAFTED":
    case "PENDING_APPROVAL":
      return "new";
    case "APPROVED":
      return "approved";
    case "EMAIL_SENT":
    case "REPLIED":
      return "contacted";
    case "COLD":
    case "SKIPPED":
      return "cold";
    case "REJECTED":
      return "rejected";
  }
}

function mapRunStatus(s: RunStatus): FrontendRunStatus {
  switch (s) {
    case "QUEUED":   return "queued";
    case "RUNNING":  return "running";
    case "SUCCEEDED": return "complete";
    case "FAILED":   return "failed";
  }
}

function mapEmailStatus(s: EmailStatus): FrontendEmailStatus {
  switch (s) {
    case "PENDING_APPROVAL": return "pending";
    case "APPROVED":         return "approved";
    case "REJECTED":         return "rejected";
    case "SENT":             return "sent";
    case "FAILED":           return "failed";
  }
}

function mapEventLevel(l: EventLevel): FrontendEventLevel {
  return l.toLowerCase() as FrontendEventLevel;
}

// ─── Prompt parser ────────────────────────────────────────────────────────────
// Parses "restaurants in Austin TX" → { niche: "restaurants", city: "Austin TX" }
// Falls back to { niche: prompt, city: "" } for unrecognized patterns.

export function parsePrompt(prompt: string): { niche: string; city: string } {
  const m = prompt.match(/^(.+?)\s+in\s+(.+?)$/i);
  if (m?.[1] && m?.[2]) {
    return { niche: m[1].trim(), city: m[2].trim() };
  }
  return { niche: prompt.trim(), city: "" };
}

// ─── Agent progress derivation ────────────────────────────────────────────────

const TRACKED_AGENTS = ["scout", "analyst", "writer", "tracker", "reporter"] as const;

function computeAgentProgress(
  run: PipelineRun,
  events: readonly RunEvent[]
): Record<string, FrontendAgentStatus> {
  const progress: Record<string, FrontendAgentStatus> = {
    scout: "pending",
    analyst: "pending",
    writer: "pending",
    tracker: "pending",
    reporter: "pending",
  };

  const byAgent: Record<string, EventLevel[]> = {};
  for (const e of events) {
    const key = e.agentName.toLowerCase();
    if (!byAgent[key]) byAgent[key] = [];
    byAgent[key].push(e.level);
  }

  for (const agent of TRACKED_AGENTS) {
    const levels = byAgent[agent];
    if (!levels?.length) continue;

    const levelSet = new Set(levels);

    if (levelSet.has("SUCCESS")) {
      // At least one step succeeded — show done (partial errors visible in logs)
      progress[agent] = "done";
    } else if (levelSet.has("ERROR")) {
      // Only errors, no successes — fully failed
      progress[agent] = "failed";
    } else {
      // Only INFO/WARNING events written so far — agent is mid-flight or just started
      const isFinished = run.status === "SUCCEEDED" || run.status === "FAILED";
      progress[agent] = isFinished ? "done" : "running";
    }
  }

  return progress;
}

// ─── DTO shapes (match frontend mock types exactly) ───────────────────────────

export interface LeadDTO {
  id: string;
  publicId: string;
  businessName: string;
  address: string;
  city: string;
  niche: string;
  phone?: string;
  website?: string;
  contactEmail?: string;
  googleRating?: number;
  reviewCount: number;
  digitalScore?: number;
  reviewSentiment?: string;
  topIssue?: string;
  reviewExcerpt?: string;
  status: FrontendLeadStatus;
  discoveredAt: string;
  runId: string;
}

export interface RunEventDTO {
  id: string;
  agentName: string;
  message: string;
  level: FrontendEventLevel;
  timestamp: string;
}

export interface AgentProgress {
  scout: FrontendAgentStatus;
  analyst: FrontendAgentStatus;
  writer: FrontendAgentStatus;
  tracker: FrontendAgentStatus;
  reporter: FrontendAgentStatus;
}

export interface PipelineRunDTO {
  id: string;
  prompt: string;
  niche: string;
  city: string;
  status: FrontendRunStatus;
  startedAt: string;
  completedAt: string | null;
  leadsFound: number;
  leadsScored: number;
  leadsDrafted: number;
  leadsEmailed: number;
  errorMessage?: string;
  agentProgress: AgentProgress;
  events?: RunEventDTO[];
}

export interface EmailDTO {
  id: string;
  leadId: string;
  businessName: string;
  recipientEmail: string | null;
  subject: string;
  body: string;
  wordCount: number;
  status: FrontendEmailStatus;
  createdAt: string;
  approvedAt: string | null;
  sentAt: string | null;
  approvedBy?: string;
}

export interface PublicAuditDTO {
  id: string;
  publicId: string;
  businessName: string;
  address: string;
  city: string;
  niche: string;
  phone?: string;
  website?: string;
  googleRating?: number;
  reviewCount: number;
  digitalScore?: number;
  reviewSentiment?: string;
  topIssue?: string;
  reviewExcerpt?: string;
  pageSpeedScore?: number;
  mobileScore?: number;
  hasSSL?: boolean;
  hasMobileMeta?: boolean;
}

// ─── Mapper functions ─────────────────────────────────────────────────────────

export function toLeadDTO(lead: Lead): LeadDTO {
  return {
    id: lead.id,
    publicId: lead.publicId,
    businessName: lead.businessName,
    address: lead.address,
    city: lead.city,
    niche: lead.niche,
    reviewCount: lead.reviewCount,
    status: mapLeadStatus(lead.status),
    discoveredAt: lead.discoveredAt.toISOString(),
    runId: lead.runId,
    ...(lead.phone !== undefined && { phone: lead.phone }),
    ...(lead.website !== undefined && { website: lead.website }),
    ...(lead.contactEmail !== undefined && { contactEmail: lead.contactEmail }),
    ...(lead.googleRating !== undefined && { googleRating: lead.googleRating }),
    ...(lead.digitalScore !== undefined && { digitalScore: lead.digitalScore }),
    ...(lead.reviewSentiment !== undefined && { reviewSentiment: lead.reviewSentiment }),
    ...(lead.topIssue !== undefined && { topIssue: lead.topIssue }),
    ...(lead.reviewExcerpt !== undefined && { reviewExcerpt: lead.reviewExcerpt }),
  };
}

export function toRunEventDTO(event: RunEvent): RunEventDTO {
  return {
    id: event.id,
    agentName: event.agentName,
    message: event.message,
    level: mapEventLevel(event.level),
    timestamp: event.createdAt.toISOString(),
  };
}

export function toRunDTO(
  run: PipelineRun,
  events: readonly RunEvent[] = []
): PipelineRunDTO {
  const { niche, city } = parsePrompt(run.prompt);
  return {
    id: run.id,
    prompt: run.prompt,
    niche,
    city,
    status: mapRunStatus(run.status),
    startedAt: run.startedAt.toISOString(),
    completedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    leadsFound: run.leadsFound,
    leadsScored: run.leadsScored,
    leadsDrafted: run.leadsDrafted,
    leadsEmailed: run.leadsEmailed,
    agentProgress: computeAgentProgress(run, events) as unknown as AgentProgress,
    events: events.map(toRunEventDTO),
    ...(run.errorMessage !== undefined && { errorMessage: run.errorMessage }),
  };
}

export function toEmailDTO(email: Email, lead?: Lead): EmailDTO {
  return {
    id: email.id,
    leadId: email.leadId,
    businessName: lead?.businessName ?? "Unknown Business",
    recipientEmail: email.recipientEmail ?? null,
    subject: email.subject,
    body: email.body,
    wordCount: email.wordCount,
    status: mapEmailStatus(email.status),
    createdAt: email.createdAt.toISOString(),
    approvedAt: null, // no approvedAt timestamp on Email model — use sentAt proxy
    sentAt: email.sentAt ? email.sentAt.toISOString() : null,
    ...(email.approvedBy !== undefined && { approvedBy: email.approvedBy }),
  };
}
