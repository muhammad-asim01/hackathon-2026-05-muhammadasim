// API response types — mirror the backend DTO shapes exactly.
// These match what every /api/* endpoint returns after unwrapping { ok, data }.

// ─── Shared enums ─────────────────────────────────────────────────────────────

export type LeadStatus = "new" | "contacted" | "approved" | "rejected" | "cold";
export type DraftStatus = "pending" | "approved" | "rejected" | "sent";
export type RunStatus = "running" | "complete" | "failed" | "queued";
export type AgentStatus = "pending" | "running" | "done" | "failed";
export type EventLevel = "info" | "success" | "warning" | "error";
export type ReviewSentiment = "positive" | "mixed" | "negative";

// ─── Lead ─────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  publicId: string;
  businessName: string;
  address: string;
  city: string;
  niche: string;
  phone?: string;
  website?: string;
  /** Extracted by Analyst phase — pre-fills recipient email on the approval card */
  contactEmail?: string;
  googleRating?: number;
  reviewCount: number;
  digitalScore?: number;
  reviewSentiment?: ReviewSentiment;
  topIssue?: string;
  reviewExcerpt?: string;
  status: LeadStatus;
  discoveredAt: string;
  runId: string;
}

export interface LeadDetail extends Lead {
  emails: EmailDraft[];
}

// ─── Email draft ──────────────────────────────────────────────────────────────

export interface EmailDraft {
  id: string;
  leadId: string;
  businessName: string;
  recipientEmail: string | null;
  subject: string;
  body: string;
  wordCount: number;
  status: DraftStatus;
  createdAt: string;
  approvedAt: string | null;
  sentAt: string | null;
  approvedBy?: string;
}

// ─── Pipeline run ─────────────────────────────────────────────────────────────

export interface AgentProgress {
  scout: AgentStatus;
  analyst: AgentStatus;
  writer: AgentStatus;
  tracker: AgentStatus;
  reporter: AgentStatus;
}

export interface RunEvent {
  id: string;
  agentName: string;
  message: string;
  level: EventLevel;
  timestamp: string;
}

export interface PipelineRun {
  id: string;
  prompt: string;
  niche: string;
  city: string;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  leadsFound: number;
  leadsScored: number;
  leadsDrafted: number;
  leadsEmailed: number;
  agentProgress: AgentProgress;
  events?: RunEvent[];
  errorMessage?: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  totalLeadsAllTime: number;
  totalSent: number;
  totalReplies: number;
  overallReplyRate: number;
  avgDigitalScore: number;
  runsCompleted: number;
  avgLeadsPerRun: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface Settings {
  id: string;
  dailyQuota: number;
  scoreThreshold: number;
  emailWordLimit: number;
  targetNiches: string[];
  targetCities: string[];
  fromName: string | null;
  replyToEmail: string | null;
}

// ─── Paginated list wrapper ───────────────────────────────────────────────────

export interface PagedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

// ─── Public audit lead ────────────────────────────────────────────────────────
// Shape returned by GET /api/public/audit/:publicId — all analyst fields optional
// because the endpoint is reachable before the Analyst agent has run.

export interface PublicAuditLead {
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
  reviewSentiment?: ReviewSentiment;
  topIssue?: string;
  reviewExcerpt?: string;
  pageSpeedScore?: number;
  mobileScore?: number;
  hasSSL?: boolean;
  hasMobileMeta?: boolean;
}

// ─── Lead score helpers ───────────────────────────────────────────────────────

export function scoreVariant(
  score?: number
): "error" | "warning" | "muted" | "default" {
  // 0 means the analyst ran but found no website AND no Google data (OSM-only lead).
  // Display it as "muted" (unscored) rather than red-error so the UI stays readable.
  if (score == null || score === 0) return "muted";
  if (score <= 30) return "error";
  if (score <= 55) return "warning";
  return "default";
}

export function scoreTier(score?: number): string {
  if (score == null) return "Not yet audited";
  if (score === 0) return "No digital presence detected — top outreach priority";
  if (score <= 30) return "Critical — immediate outreach";
  if (score <= 55) return "Poor — strong outreach candidate";
  if (score <= 75) return "Fair — offer free audit";
  return "Good — skip";
}
