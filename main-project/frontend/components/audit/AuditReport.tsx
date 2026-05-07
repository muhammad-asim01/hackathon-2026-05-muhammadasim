"use client";

import { useEffect, useState } from "react";
import {
  Zap,
  Smartphone,
  Lock,
  Star,
  Globe,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  MapPin,
  Phone,
} from "lucide-react";
import type { PublicAuditLead } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Audit item builder ────────────────────────────────────────────────────────

interface AuditItem {
  icon: React.ElementType;
  label: string;
  status: "pass" | "warn" | "fail" | "pending";
  detail: string;
}

function buildAuditItems(lead: PublicAuditLead): AuditItem[] {
  const issue = (lead.topIssue ?? "").toLowerCase();

  const pageSpeedItem: AuditItem = lead.pageSpeedScore !== undefined
    ? {
        icon: Zap,
        label: "PageSpeed Performance",
        status:
          lead.pageSpeedScore >= 70 ? "pass"
          : lead.pageSpeedScore >= 50 ? "warn"
          : "fail",
        detail:
          lead.pageSpeedScore >= 70
            ? `Score ${lead.pageSpeedScore}/100 — good loading performance`
            : lead.pageSpeedScore >= 50
            ? `Score ${lead.pageSpeedScore}/100 — room for improvement`
            : `Score ${lead.pageSpeedScore}/100 — critical performance issues detected`,
      }
    : {
        icon: Zap,
        label: "PageSpeed Performance",
        status: "pending",
        detail: "Analysis pending — will appear after site audit completes",
      };

  const mobileItem: AuditItem = lead.mobileScore !== undefined
    ? {
        icon: Smartphone,
        label: "Mobile Friendliness",
        status:
          lead.mobileScore >= 70 ? "pass"
          : lead.mobileScore >= 50 ? "warn"
          : "fail",
        detail:
          lead.mobileScore >= 70
            ? `Score ${lead.mobileScore}/100 — responsive design detected`
            : lead.mobileScore >= 50
            ? `Score ${lead.mobileScore}/100 — some mobile layout issues found`
            : `Score ${lead.mobileScore}/100 — major layout problems on mobile devices`,
      }
    : {
        icon: Smartphone,
        label: "Mobile Friendliness",
        status: "pending",
        detail: "Analysis pending — will appear after site audit completes",
      };

  const sslItem: AuditItem = lead.hasSSL !== undefined
    ? {
        icon: Lock,
        label: "HTTPS / SSL Certificate",
        status: lead.hasSSL ? "pass" : "fail",
        detail: lead.hasSSL
          ? "SSL certificate valid — secure connection"
          : "Site not served over HTTPS — visitor data at risk",
      }
    : issue
    ? {
        icon: Lock,
        label: "HTTPS / SSL Certificate",
        status: issue.includes("http") ? "fail" : "pass",
        detail: issue.includes("http")
          ? "Site not served over HTTPS — visitor data at risk"
          : "SSL certificate valid — secure connection",
      }
    : {
        icon: Lock,
        label: "HTTPS / SSL Certificate",
        status: "pending",
        detail: "Analysis pending — will appear after site audit completes",
      };

  const gbpItem: AuditItem = {
    icon: Star,
    label: "Google Business Profile",
    status:
      lead.reviewCount < 20
        ? "warn"
        : issue.includes("photo") || issue.includes("google")
        ? "warn"
        : "pass",
    detail: `${lead.reviewCount} reviews${lead.googleRating !== undefined ? ` · ${lead.googleRating}★ rating` : ""}${
      issue.includes("photo") ? " · profile photos missing" : ""
    }`,
  };

  const seoItem: AuditItem = issue
    ? {
        icon: Globe,
        label: "Structured Data & SEO",
        status:
          issue.includes("schema") || issue.includes("sitemap") || issue.includes("index")
            ? "fail"
            : "pass",
        detail:
          issue.includes("schema")
            ? "Missing LocalBusiness schema — invisible to rich search results"
            : issue.includes("sitemap") || issue.includes("index")
            ? "Sitemap or indexing misconfiguration detected"
            : "Schema markup and search indexing appear healthy",
      }
    : {
        icon: Globe,
        label: "Structured Data & SEO",
        status: "pending",
        detail: "Analysis pending — will appear after site audit completes",
      };

  const bookingItem: AuditItem = issue
    ? {
        icon: BookOpen,
        label: "Online Booking / Contact",
        status:
          issue.includes("book") ||
          issue.includes("appointment") ||
          issue.includes("contact") ||
          issue.includes("404") ||
          issue.includes("broken")
            ? "fail"
            : "pass",
        detail:
          issue.includes("book") || issue.includes("appointment")
            ? "No functional booking system — customers must call during business hours"
            : issue.includes("404") || issue.includes("broken")
            ? "Broken links detected on key conversion pages"
            : "Contact form and booking flow accessible",
      }
    : {
        icon: BookOpen,
        label: "Online Booking / Contact",
        status: "pending",
        detail: "Analysis pending — will appear after site audit completes",
      };

  return [pageSpeedItem, mobileItem, sslItem, gbpItem, seoItem, bookingItem];
}

// ─── Score ring ───────────────────────────────────────────────────────────────

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function scoreColor(score: number): string {
  if (score <= 30) return "#ea6962";
  if (score <= 55) return "#cc5b33";
  return "#cab16a";
}

function scoreLabel(score: number): string {
  if (score <= 30) return "Critical";
  if (score <= 55) return "Poor";
  return "Fair";
}

function ScoreRing({ score }: { score: number | undefined }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  if (score === undefined) {
    return (
      <div className="relative flex items-center justify-center shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="#44403c" strokeWidth="10" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono text-muted-foreground/40">—</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/30 mt-0.5">
            Pending
          </span>
        </div>
      </div>
    );
  }

  const targetOffset = CIRCUMFERENCE * (1 - score / 100);
  const currentOffset = animated ? targetOffset : CIRCUMFERENCE;
  const color = scoreColor(score);

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="#44403c" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="butt"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={currentOffset}
          style={{
            transition: animated
              ? "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)"
              : "none",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold font-mono tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mt-0.5">
          {scoreLabel(score)}
        </span>
      </div>
    </div>
  );
}

// ─── Checklist item ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pass: {
    StatusIcon: CheckCircle2,
    iconClass: "text-lp-green",
    bg: "bg-lp-green/8",
    border: "border-lp-green/20",
  },
  warn: {
    StatusIcon: AlertTriangle,
    iconClass: "text-lp-amber",
    bg: "bg-lp-amber/8",
    border: "border-lp-amber/20",
  },
  fail: {
    StatusIcon: XCircle,
    iconClass: "text-lp-red",
    bg: "bg-lp-red/8",
    border: "border-lp-red/20",
  },
  pending: {
    StatusIcon: Clock,
    iconClass: "text-muted-foreground/30",
    bg: "bg-border/10",
    border: "border-border/30",
  },
};

function CheckItem({ item, index }: { item: AuditItem; index: number }) {
  const cfg = STATUS_CONFIG[item.status];
  const { StatusIcon } = cfg;
  const ItemIcon = item.icon;

  return (
    <div
      className={cn("flex items-start gap-3 p-4 border", cfg.bg, cfg.border)}
      style={{ animation: "lp-fade-in 0.3s ease both", animationDelay: `${index * 0.06}s` }}
    >
      <div className="flex items-center justify-center w-8 h-8 shrink-0 bg-background border border-border/40">
        <ItemIcon className="w-3.5 h-3.5 text-muted-foreground/60" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-foreground">{item.label}</p>
          <StatusIcon className={cn("w-3.5 h-3.5 shrink-0", cfg.iconClass)} strokeWidth={1.5} />
        </div>
        <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">{item.detail}</p>
      </div>
    </div>
  );
}

// ─── Review highlight ─────────────────────────────────────────────────────────

function ReviewHighlight({ lead }: { lead: PublicAuditLead }) {
  if (!lead.reviewSentiment || !lead.reviewExcerpt) return null;

  const sentimentConfig = {
    positive: "text-lp-green bg-lp-green/10 border-lp-green/20",
    negative: "text-lp-red bg-lp-red/10 border-lp-red/20",
    mixed: "text-lp-amber bg-lp-amber/10 border-lp-amber/20",
  }[lead.reviewSentiment];

  const sentimentLabel = {
    positive: "Positive",
    negative: "Negative",
    mixed: "Mixed",
  }[lead.reviewSentiment];

  const filledStars = lead.googleRating !== undefined ? Math.round(lead.googleRating) : 0;

  return (
    <div className="bg-card border border-border/60 p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className="w-3.5 h-3.5"
              strokeWidth={1}
              style={{
                color: i < filledStars ? "#cab16a" : "#44403c",
                fill: i < filledStars ? "#cab16a" : "none",
              }}
            />
          ))}
          <span className="ml-1.5 text-xs font-mono text-muted-foreground tabular-nums">
            {lead.googleRating !== undefined ? `${lead.googleRating} · ` : ""}{lead.reviewCount} reviews
          </span>
        </div>
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 border",
            sentimentConfig
          )}
        >
          {sentimentLabel}
        </span>
      </div>

      <blockquote className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-border/60 pl-3">
        {lead.reviewExcerpt}
      </blockquote>

      <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.1em]">
        Google review · {lead.businessName}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AuditReport({ lead }: { lead: PublicAuditLead }) {
  const auditItems = buildAuditItems(lead);
  const failCount    = auditItems.filter((i) => i.status === "fail").length;
  const warnCount    = auditItems.filter((i) => i.status === "warn").length;
  const passCount    = auditItems.filter((i) => i.status === "pass").length;
  const pendingCount = auditItems.filter((i) => i.status === "pending").length;
  const hasReview    = Boolean(lead.reviewSentiment && lead.reviewExcerpt);

  return (
    <div className="min-h-screen bg-background">
      {/* Brand header */}
      <header className="border-b border-border/60 bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-lp-amber rounded-full flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-background leading-none">SA</span>
            </div>
            <span className="text-sm font-semibold text-foreground">sift.ai</span>
          </div>
          <span className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-semibold hidden sm:block">
            Digital Audit Report
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Business identity */}
        <div style={{ animation: "lp-slide-up 0.35s ease both" }}>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{lead.businessName}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              {lead.address}, {lead.city}
            </span>
            {lead.website && (
              <>
                <span className="text-border hidden sm:inline">·</span>
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                  {lead.website}
                </span>
              </>
            )}
            {lead.phone && (
              <>
                <span className="text-border hidden sm:inline">·</span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                  {lead.phone}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Score block */}
        <div
          className="bg-card border border-border/60 p-6"
          style={{ animation: "lp-slide-up 0.35s ease 0.05s both" }}
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <ScoreRing score={lead.digitalScore} />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em] mb-2">
                Digital Presence Score
              </p>
              {lead.digitalScore !== undefined ? (
                <>
                  <p className="text-base text-foreground leading-snug">
                    Your website scored{" "}
                    <span
                      className="font-bold font-mono"
                      style={{ color: scoreColor(lead.digitalScore) }}
                    >
                      {lead.digitalScore}
                    </span>{" "}
                    out of <span className="font-mono">100</span> on our automated audit.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {failCount > 0 && (
                      <>
                        We found{" "}
                        <span className="text-lp-red font-semibold">
                          {failCount} critical issue{failCount !== 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                    {warnCount > 0 && (
                      <>
                        {failCount > 0 ? " and " : "We found "}
                        <span className="text-lp-amber font-semibold">
                          {warnCount} warning{warnCount !== 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                    {(failCount > 0 || warnCount > 0) && " that are costing you customers."}
                    {lead.topIssue && (
                      <>
                        {" "}Primary issue:{" "}
                        <em className="text-foreground not-italic">
                          {lead.topIssue.charAt(0).toLowerCase() + lead.topIssue.slice(1)}.
                        </em>
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your digital presence audit is in progress. Check back shortly — the full score and
                  detailed findings will appear here once the analysis completes.
                </p>
              )}

              {/* Mini stat row */}
              {lead.digitalScore !== undefined && (
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40">
                  <div>
                    <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.1em]">Passed</p>
                    <p className="text-lg font-bold font-mono text-lp-green tabular-nums">{passCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.1em]">Warnings</p>
                    <p className="text-lg font-bold font-mono text-lp-amber tabular-nums">{warnCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.1em]">Failed</p>
                    <p className="text-lg font-bold font-mono text-lp-red tabular-nums">{failCount}</p>
                  </div>
                  {pendingCount > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.1em]">Pending</p>
                      <p className="text-lg font-bold font-mono text-muted-foreground/40 tabular-nums">{pendingCount}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audit checklist */}
        <div style={{ animation: "lp-slide-up 0.35s ease 0.1s both" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">
              Audit Checklist
            </p>
            <p className="text-[10px] text-muted-foreground/40 font-mono">
              {passCount}/{auditItems.length} passed
            </p>
          </div>
          <div className="space-y-1">
            {auditItems.map((item, i) => (
              <CheckItem key={item.label} item={item} index={i} />
            ))}
          </div>
        </div>

        {/* Review highlights */}
        {hasReview && (
          <div style={{ animation: "lp-slide-up 0.35s ease 0.15s both" }}>
            <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em] mb-4">
              What Your Customers Are Saying
            </p>
            <ReviewHighlight lead={lead} />
          </div>
        )}

        {/* CTA */}
        <div
          className="bg-card border border-lp-amber/20 p-6 sm:p-8 text-center space-y-4"
          style={{ animation: "lp-slide-up 0.35s ease 0.2s both" }}
        >
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-foreground">Ready to fix these issues?</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              A free 20-minute strategy call is all it takes to map out exactly what&apos;s holding
              your business back online.
            </p>
          </div>
          <a
            href="mailto:muhammadasim.code@gmail.com?subject=Free Strategy Call — sift.ai Audit"
            className="inline-flex items-center gap-2 bg-lp-amber text-background font-semibold text-sm px-6 py-2.5 rounded-full hover:bg-lp-amber/90 active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            Book a Free Call
            <ArrowUpRight className="w-4 h-4" strokeWidth={2} />
          </a>
          <p className="text-[10px] text-muted-foreground/30">No credit card · No obligation · 20 minutes</p>
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 pt-6 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground/25">
          <span>Generated by sift.ai · Automated digital audit</span>
          <span>Results based on publicly available data</span>
        </div>
      </main>
    </div>
  );
}
