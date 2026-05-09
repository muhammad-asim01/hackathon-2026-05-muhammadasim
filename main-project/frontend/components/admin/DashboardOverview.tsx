"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Building2, CheckCircle, Send, MessageSquare, Play, Loader,
} from "lucide-react";
import { useAnalyticsSummary } from "@/hooks/useAnalytics";
import { useLeads } from "@/hooks/useLeads";
import { useRuns, useRunPipeline } from "@/hooks/useRuns";
import { scoreVariant } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent, loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="bg-card border border-border/60 p-5 flex flex-col gap-4" style={{ animation: "lp-slide-up 0.35s ease both" }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.13em]">{label}</p>
        <div className={cn("w-8 h-8 border flex items-center justify-center", accent ? "border-lp-amber/20 bg-lp-amber/8" : "border-border/60 bg-background")}>
          <Icon className={cn("w-3.5 h-3.5", accent ? "text-lp-amber" : "text-muted-foreground/50")} strokeWidth={1.5} />
        </div>
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-16 bg-border/40 animate-pulse rounded-none" />
        ) : (
          <p className={cn("text-3xl font-bold font-mono tabular-nums tracking-tight", accent ? "text-lp-amber" : "text-foreground")}>
            {value}
          </p>
        )}
        {sub && <p className="text-xs text-muted-foreground/50 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Run status dot ───────────────────────────────────────────────────────────

function RunStatusDot({ status }: { status: string }) {
  if (status === "complete") return <span className="w-1.5 h-1.5 rounded-full bg-lp-green shrink-0" />;
  if (status === "failed")   return <span className="w-1.5 h-1.5 rounded-full bg-lp-red shrink-0" />;
  return <span className="w-1.5 h-1.5 rounded-full border border-lp-amber border-t-transparent animate-spin shrink-0" />;
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ─── Run Pipeline modal ───────────────────────────────────────────────────────

function RunPipelineModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const runPipeline = useRunPipeline();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    runPipeline.mutate(
      { prompt: prompt.trim() },
      { onSuccess: () => { setPrompt(""); onClose(); } }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Run Pipeline</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">
              Search Prompt
            </label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. restaurants in Austin TX"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-10 px-3 bg-background border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-lp-amber/40 transition-colors"
            />
            <p className="text-[11px] text-muted-foreground/40">
              Format: &ldquo;{"{niche}"} in {"{city}"}&rdquo; — e.g. auto repair shops in Chicago IL
            </p>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!prompt.trim() || runPipeline.isPending}
              className="gap-2"
            >
              {runPipeline.isPending ? (
                <><Loader className="w-3.5 h-3.5 animate-spin" /> Starting…</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> Run Pipeline</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardOverview() {
  const [showRunModal, setShowRunModal] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary();
  const { data: runsData } = useRuns({ limit: 4 });
  const { data: leadsData } = useLeads({ limit: 5 });

  const recentRuns  = [...(runsData ?? [])].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 4);
  const recentLeads = [...(leadsData?.data ?? [])].sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime()).slice(0, 5);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="p-6 lg:p-8 space-y-8 border-b border-border/40">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Pipeline overview — {today}</p>
        </div>
        
      </div>

      {/* First-run onboarding nudge — only shown when no leads exist yet */}
      {!summaryLoading && (summary?.totalLeadsAllTime ?? 0) === 0 && (
        <div className="border border-lp-amber/20 bg-lp-amber/5 px-5 py-4 flex items-start gap-4" style={{ animation: "lp-fade-in 0.4s ease both" }}>
          <div className="w-8 h-8 border border-lp-amber/30 bg-lp-amber/10 flex items-center justify-center shrink-0 mt-0.5">
            <Play className="w-3.5 h-3.5 text-lp-amber" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Your pipeline hasn&apos;t run yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click <span className="text-lp-amber font-medium">Run Pipeline</span> above, or go to the{" "}
              <Link href="/dashboard/agent" className="text-lp-amber hover:underline">Agent page</Link>{" "}
              for full controls — niche, city, score threshold, and word limit.
            </p>
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/40 border border-border/40">
        <KpiCard
          label="Total leads"
          value={summary?.totalLeadsAllTime ?? 0}
          sub="all time"
          icon={Building2}
          accent
          loading={summaryLoading}
        />
        <KpiCard
          label="Emails sent"
          value={summary?.totalSent ?? 0}
          sub="all time"
          icon={Send}
          loading={summaryLoading}
        />
        <KpiCard
          label="Replies"
          value={summary?.totalReplies ?? 0}
          sub="from sent emails"
          icon={MessageSquare}
          loading={summaryLoading}
        />
        <KpiCard
          label="Reply rate"
          value={`${summary?.overallReplyRate ?? 0}%`}
          sub="of sent emails replied"
          icon={CheckCircle}
          loading={summaryLoading}
        />
      </div>

      {/* Recent runs + recent leads */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6">
        {/* Recent runs */}
        <div className="bg-card border border-border/60">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
            <p className="text-xs font-semibold text-foreground">Recent Runs</p>
            <Link href="/dashboard/runs" className="text-[10px] text-muted-foreground/50 hover:text-lp-amber transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {recentRuns.length === 0 ? (
              <p className="px-5 py-8 text-xs text-muted-foreground/40 text-center">No runs yet.</p>
            ) : recentRuns.map((run) => (
              <Link
                key={run.id}
                href={`/dashboard/runs/${run.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-border/20 transition-colors group"
              >
                <RunStatusDot status={run.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {run.niche}<span className="text-muted-foreground/50 font-normal"> · {run.city}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 font-mono mt-0.5">
                    {run.leadsFound} found · {run.leadsEmailed} emailed · {formatDuration(run.startedAt, run.completedAt)}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent leads */}
        <div className="bg-card border border-border/60">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
            <p className="text-xs font-semibold text-foreground">Recent Leads</p>
            <Link href="/dashboard/leads" className="text-[10px] text-muted-foreground/50 hover:text-lp-amber transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {recentLeads.length === 0 ? (
              <p className="px-5 py-8 text-xs text-muted-foreground/40 text-center">No leads yet.</p>
            ) : recentLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/dashboard/leads/${lead.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-border/20 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{lead.businessName}</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5 truncate">
                    {lead.niche} · {lead.city}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={scoreVariant(lead.digitalScore)} className="font-mono text-[10px] px-1.5 py-0">
                    {lead.digitalScore ?? "—"}
                  </Badge>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <RunPipelineModal open={showRunModal} onClose={() => setShowRunModal(false)} />
    </div>
  );
}
