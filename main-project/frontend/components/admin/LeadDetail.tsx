"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Globe, Phone, MapPin, Star, MessageSquare, Gauge,
  Smartphone, AlertTriangle, CheckCircle2, XCircle, Pencil, ExternalLink, FileSearch,
} from "lucide-react";
import { useApproveEmail, useRejectEmail, useEditEmail } from "@/hooks/useApprovals";
import { scoreVariant, scoreTier, type Lead, type EmailDraft, type ReviewSentiment } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  lead: Lead;
  draft: EmailDraft | null;
}

const SENTIMENT_COLORS: Record<ReviewSentiment, string> = {
  positive: "text-lp-green",
  mixed: "text-lp-amber",
  negative: "text-lp-red",
};

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, icon: Icon, variant,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  variant?: "good" | "warn" | "bad" | "neutral";
}) {
  const color = { good: "text-lp-green", warn: "text-lp-amber", bad: "text-lp-red", neutral: "text-muted-foreground" }[variant ?? "neutral"];
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0">
      <div className="w-7 h-7 border border-border/60 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.1em]">{label}</p>
        <p className={cn("text-sm font-semibold font-mono tabular-nums mt-0.5", color)}>{value}</p>
      </div>
    </div>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score?: number }) {
  // Treat 0 the same as null — 0 only occurs on OSM-sourced leads with no website
  // and no Google data. null = "not audited", 0 = "audited: no digital presence".
  // Both render as "Pending / No data" to avoid a confusing half-empty bar.
  const display = score === 0 ? undefined : score;
  const pct = display != null ? Math.min(100, Math.round((display / 75) * 100)) : 0;
  const color = !display ? "bg-border/60" : display <= 55 ? "bg-lp-red" : display <= 75 ? "bg-lp-amber" : "bg-lp-green";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.1em]">Digital Score</span>
        <Badge variant={scoreVariant(display)} className="font-mono text-xs tabular-nums">
          {display != null ? `${display} / 75` : score === 0 ? "No web data" : "Pending"}
        </Badge>
      </div>
      <div className="h-1.5 bg-border/40 w-full">
        <div className={cn("h-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground/40">{scoreTier(score)}</p>
    </div>
  );
}

// ─── Action bar ───────────────────────────────────────────────────────────────

function ActionBar({ draft, leadId, leadStatus }: { draft: EmailDraft | null; leadId: string; leadStatus: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(draft?.body ?? "");
  const [draftSubject, setDraftSubject] = useState(draft?.subject ?? "");

  const approve = useApproveEmail();
  const reject = useRejectEmail();
  const edit = useEditEmail();

  if (!draft) {
    return (
      <div className="bg-card border border-border/60 p-5 flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-lp-amber shrink-0" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">No email draft yet. Run the Writer Agent for this lead.</p>
      </div>
    );
  }

  if (draft.status === "approved" || draft.status === "sent") {
    return (
      <div className="bg-lp-green/5 border border-lp-green/20 p-5 flex items-center gap-3">
        <CheckCircle2 className="w-4 h-4 text-lp-green shrink-0" />
        <p className="text-sm text-lp-green">
          {draft.recipientEmail ? `Email sent to ${draft.recipientEmail}` : "Email sent successfully."}
        </p>
      </div>
    );
  }

  if (draft.status === "rejected") {
    return (
      <div className="bg-lp-red/5 border border-lp-red/20 p-5 flex items-center gap-3">
        <XCircle className="w-4 h-4 text-lp-red shrink-0" />
        <p className="text-sm text-lp-red">Draft discarded.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">Email Draft</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5 font-mono">
            {draft.wordCount} words · {draft.subject}
          </p>
        </div>
        <Badge variant={draft.status === "pending" ? "warning" : draft.status === "sent" ? "success" : "error"} className="capitalize text-[10px]">
          {draft.status}
        </Badge>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <input
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-lp-amber/30 text-xs text-foreground font-mono focus:outline-none"
            placeholder="Subject"
          />
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={10}
            className="w-full px-3 py-2.5 bg-background border border-lp-amber/30 text-sm text-foreground font-mono leading-relaxed focus:outline-none resize-none"
          />
        </div>
      ) : (
        <div className="bg-background border border-border/40 px-4 py-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
          {draft.body}
        </div>
      )}

      <div className="space-y-3">
        {draft.status === "pending" && !isEditing && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => approve.mutate({ id: draft.id })} disabled={approve.isPending} className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {approve.isPending ? "Sending…" : "Approve & Send"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit Draft
              </Button>
              <Button
                size="sm" variant="ghost"
                onClick={() => reject.mutate(draft.id)}
                disabled={reject.isPending}
                className="gap-1.5 text-lp-red hover:text-lp-red hover:bg-lp-red/10"
              >
                <XCircle className="w-3.5 h-3.5" /> Discard
              </Button>
            </div>
          </>
        )}
        {isEditing && (
          <>
            <Button
              size="sm"
              onClick={() => edit.mutate({ id: draft.id, body: draftBody, subject: draftSubject }, { onSuccess: () => setIsEditing(false) })}
              disabled={edit.isPending}
              className="gap-1.5"
            >
              {edit.isPending ? "Saving…" : "Save Draft"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setDraftBody(draft.body); setDraftSubject(draft.subject); }}>
              Cancel
            </Button>
          </>
        )}
        {/* {leadStatus !== "cold" && !isEditing && (
          <Button
            size="sm" variant="ghost"
            className="gap-1.5 text-muted-foreground ml-auto"
            onClick={() => updateLead.mutate({ status: "cold" })}
            disabled={updateLead.isPending}
          >
            <Snowflake className="w-3.5 h-3.5" /> Mark Cold
          </Button>
        )} */}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeadDetail({ lead, draft }: Props) {
  const discoveredDate = new Date(lead.discoveredAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const sentiment = lead.reviewSentiment;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl" style={{ animation: "lp-slide-up 0.35s ease both" }}>
      {/* Back + header */}
      <div>
        <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Leads
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">{lead.businessName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{lead.niche} · {lead.city}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={scoreVariant(lead.digitalScore === 0 ? undefined : lead.digitalScore)}
              className="font-mono text-xs"
            >
              {lead.digitalScore != null && lead.digitalScore > 0
                ? `Score ${lead.digitalScore}`
                : "Score —"}
            </Badge>
            <Badge
              variant={lead.status === "new" ? "muted" : lead.status === "approved" ? "success" : lead.status === "rejected" ? "error" : "warning"}
              className="capitalize text-xs"
            >
              {lead.status}
            </Badge>
            <Link
              href={`/audit/${lead.publicId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium border border-border/60 bg-card hover:bg-card/80 text-muted-foreground hover:text-foreground rounded-full transition-colors duration-150"
            >
              <FileSearch className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              Public Audit Report
              <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-50" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_1fr] gap-6">

        {/* Col 1 — Business meta */}
        <div className="space-y-4">
          <div className="bg-card border border-border/60 p-5 space-y-4">
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">Business</p>
            <div className="space-y-3 text-sm">
              {lead.website && (
                <div className="flex items-start gap-2.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <a href={`${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-lp-amber hover:underline flex items-center gap-1 break-all">
                    {lead.website}<ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" strokeWidth={1.5} />
                  <span className="text-muted-foreground font-mono text-xs">{lead.phone}</span>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" strokeWidth={1.5} />
                <span className="text-muted-foreground text-xs">{lead.address}, {lead.city}</span>
              </div>
              {lead.googleRating != null && (
                <div className="flex items-center gap-2.5">
                  <Star className="w-3.5 h-3.5 text-lp-amber shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground text-xs font-mono">
                    {lead.googleRating} ★
                    {lead.reviewCount > 0 ? ` · ${lead.reviewCount} reviews` : ""}
                  </span>
                </div>
              )}
            </div>
            <div className="pt-3 border-t border-border/40">
              <p className="text-[10px] text-muted-foreground/30 font-mono">Discovered {discoveredDate}</p>
              <p className="text-[10px] text-muted-foreground/30 font-mono mt-0.5">
                Run:{" "}
                <Link href={`/dashboard/runs/${lead.runId}`} className="text-lp-amber/60 hover:text-lp-amber transition-colors">
                  {lead.runId.slice(0, 8)}…
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Col 2 — Audit findings */}
        <div className="space-y-4">
          <div className="bg-card border border-border/60 p-5 space-y-4">
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">Audit Findings</p>
            <ScoreBar score={lead.digitalScore} />
            <div className="pt-2">
              <MetricCard label="PageSpeed Score" value="Pending analyst" icon={Gauge} variant="neutral" />
              <MetricCard label="Mobile Score" value="Pending analyst" icon={Smartphone} variant="neutral" />
              {sentiment && (
                <MetricCard
                  label="Review Sentiment"
                  value={sentiment}
                  icon={MessageSquare}
                  variant={sentiment === "positive" ? "good" : sentiment === "mixed" ? "warn" : "bad"}
                />
              )}
            </div>

            {lead.topIssue && (
              <div className="bg-lp-red/5 border border-lp-red/20 px-4 py-3 space-y-1">
                <p className="text-[10px] font-semibold text-lp-red/70 uppercase tracking-[0.1em]">Primary Issue</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{lead.topIssue}</p>
              </div>
            )}

            {lead.reviewExcerpt && sentiment && (
              <div className="bg-border/20 border-l-2 border-lp-amber/30 pl-4 py-2">
                <p className="text-xs text-muted-foreground/70 italic leading-relaxed">{lead.reviewExcerpt}</p>
                <p className={cn("text-[10px] font-semibold mt-1.5 uppercase tracking-[0.1em]", SENTIMENT_COLORS[sentiment])}>
                  {sentiment} sentiment
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Col 3 — Email draft */}
        <div className="space-y-4">
          <div className="bg-card border border-border/60 p-5 space-y-4">
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">Outreach</p>
            <ActionBar draft={draft} leadId={lead.id} leadStatus={lead.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
