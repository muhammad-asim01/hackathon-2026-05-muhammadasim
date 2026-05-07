"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, XCircle, Clock, Loader } from "lucide-react";
import { useRuns } from "@/hooks/useRuns";
import { type PipelineRun, type AgentStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(start: string, end: string | null): string {
  if (!end) return "in progress";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Status components ────────────────────────────────────────────────────────

function RunStatusBadge({ status }: { status: PipelineRun["status"] }) {
  if (status === "complete") return <Badge variant="success">Complete</Badge>;
  if (status === "failed") return <Badge variant="error">Failed</Badge>;
  if (status === "queued") return <Badge variant="muted">Queued</Badge>;
  return <Badge variant="warning">Running</Badge>;
}

function AgentDot({ status }: { status: AgentStatus }) {
  if (status === "done") return <span className="w-2 h-2 rounded-full bg-lp-green" />;
  if (status === "failed") return <span className="w-2 h-2 rounded-full bg-lp-red" />;
  if (status === "running")
    return <span className="w-2 h-2 rounded-full border border-lp-amber border-t-transparent animate-spin" />;
  return <span className="w-2 h-2 rounded-full bg-border" />;
}

// ─── Agent timeline ───────────────────────────────────────────────────────────

const AGENTS = ["scout", "analyst", "writer", "tracker", "reporter"] as const;

function AgentTimeline({ progress }: { progress: PipelineRun["agentProgress"] }) {
  return (
    <div className="flex items-center gap-0">
      {AGENTS.map((agent, i) => (
        <div key={agent} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <AgentDot status={progress[agent]} />
            <span className="text-[8px] text-muted-foreground/30 uppercase tracking-[0.08em]">
              {agent.slice(0, 3)}
            </span>
          </div>
          {i < AGENTS.length - 1 && (
            <div
              className={cn(
                "h-px w-5 mb-3.5 mx-0.5",
                progress[agent] === "done" ? "bg-lp-green/40" : "bg-border/40"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Run row ─────────────────────────────────────────────────────────────────

function RunRow({ run, index }: { run: PipelineRun; index: number }) {
  return (
    <Link
      href={`/dashboard/runs/${run.id}`}
      className="block hover:bg-border/15 transition-colors group"
      style={{ animation: "lp-fade-in 0.3s ease both", animationDelay: `${index * 0.06}s` }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 px-5 py-4 items-center">
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm font-semibold text-foreground">
              {run.niche}
              <span className="font-normal text-muted-foreground/60"> · {run.city}</span>
            </p>
            <RunStatusBadge status={run.status} />
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground/40 flex-wrap">
            <span><span className="text-foreground/50">{run.leadsFound}</span>&nbsp;found</span>
            <span>·</span>
            <span><span className="text-foreground/50">{run.leadsScored}</span>&nbsp;scored</span>
            <span>·</span>
            <span><span className="text-foreground/50">{run.leadsDrafted}</span>&nbsp;drafted</span>
            <span>·</span>
            <span><span className="text-foreground/50">{run.leadsEmailed}</span>&nbsp;sent</span>
          </div>
          <AgentTimeline progress={run.agentProgress} />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-mono text-muted-foreground/40">{formatDate(run.startedAt)}</p>
            <p className="text-[10px] text-muted-foreground/30 mt-0.5 font-mono">
              {formatDuration(run.startedAt, run.completedAt)}
            </p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRun() {
  return (
    <div className="px-5 py-4 animate-pulse space-y-2">
      <div className="h-3.5 bg-border/40 rounded-none w-48" />
      <div className="h-2.5 bg-border/30 rounded-none w-72" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RunsList() {
  const { data: runs, isLoading, isError } = useRuns();

  const sorted = [...(runs ?? [])].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  const complete = sorted.filter((r) => r.status === "complete").length;
  const failed   = sorted.filter((r) => r.status === "failed").length;
  const running  = sorted.filter((r) => r.status === "running").length;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Pipeline Runs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          History of every agent pipeline execution.
        </p>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
          <CheckCircle2 className="w-3.5 h-3.5 text-lp-green" strokeWidth={1.5} />
          {complete} complete
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
          <XCircle className="w-3.5 h-3.5 text-lp-red" strokeWidth={1.5} />
          {failed} failed
        </div>
        {running > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-lp-amber">
            <Loader className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
            {running} running
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
          <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
          {sorted.length} total
        </div>
      </div>

      {/* List */}
      <div className="border border-border/60 divide-y divide-border/40 bg-card">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonRun key={i} />)
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-lp-red/60">
            Failed to load runs.
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground/40">
            No pipeline runs yet. Trigger one from the Dashboard.
          </div>
        ) : (
          sorted.map((run, i) => <RunRow key={run.id} run={run} index={i} />)
        )}
      </div>
    </div>
  );
}
