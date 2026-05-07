"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader,
  Circle,
} from "lucide-react";
import type { PipelineRun, AgentStatus, RunEvent } from "@/lib/types";
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
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─── Status display ───────────────────────────────────────────────────────────

function RunStatusBadge({ status }: { status: PipelineRun["status"] }) {
  if (status === "complete") return <Badge variant="success">Complete</Badge>;
  if (status === "failed")   return <Badge variant="error">Failed</Badge>;
  if (status === "queued")   return <Badge variant="muted">Queued</Badge>;
  return <Badge variant="warning">Running</Badge>;
}

// ─── Agent step indicator ─────────────────────────────────────────────────────

const AGENT_LABELS: Record<string, string> = {
  scout: "Scout Agent",
  analyst: "Analyst Agent",
  writer: "Writer Agent",
  tracker: "Tracker Agent",
  reporter: "Reporter Agent",
};

const AGENT_DESCS: Record<string, string> = {
  scout: "Queries Google Maps · deduplicates against cache",
  analyst: "Crawls websites · PageSpeed · reviews",
  writer: "Claude Sonnet 4.6 drafts personalized emails",
  tracker: "Logs leads to Postgres + Google Sheets",
  reporter: "Sends daily summary via Gmail API",
};

function AgentStep({
  agent,
  status,
  index,
  isLast,
}: {
  agent: string;
  status: AgentStatus;
  index: number;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-4">
      {/* Spine */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "w-8 h-8 border flex items-center justify-center shrink-0 transition-all duration-300",
            status === "done"
              ? "border-lp-green/30 bg-lp-green/10"
              : status === "failed"
              ? "border-lp-red/30 bg-lp-red/10"
              : status === "running"
              ? "border-lp-amber/30 bg-lp-amber/8"
              : "border-border/60 bg-background"
          )}
          style={
            status === "done"
              ? { animation: "lp-step-done 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }
              : undefined
          }
        >
          {status === "done" && (
            <CheckCircle2 className="w-4 h-4 text-lp-green" strokeWidth={1.5} />
          )}
          {status === "failed" && (
            <XCircle className="w-4 h-4 text-lp-red" strokeWidth={1.5} />
          )}
          {status === "running" && (
            <Loader className="w-4 h-4 text-lp-amber animate-spin" strokeWidth={1.5} />
          )}
          {status === "pending" && (
            <Circle className="w-3 h-3 text-border" strokeWidth={1.5} />
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-px flex-1 mt-1 min-h-[24px]",
              status === "done" ? "bg-lp-green/20" : "bg-border/30"
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="pb-6 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p
            className={cn(
              "text-sm font-semibold",
              status === "done"
                ? "text-foreground"
                : status === "failed"
                ? "text-lp-red"
                : status === "running"
                ? "text-lp-amber"
                : "text-muted-foreground/40"
            )}
          >
            {AGENT_LABELS[agent]}
          </p>
          <span
            className={cn(
              "text-[10px] font-mono uppercase tracking-[0.1em]",
              status === "done"
                ? "text-lp-green/60"
                : status === "failed"
                ? "text-lp-red/60"
                : status === "running"
                ? "text-lp-amber/60"
                : "text-muted-foreground/25"
            )}
          >
            {status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground/40">{AGENT_DESCS[agent]}</p>
      </div>
    </div>
  );
}

// ─── Event log line ───────────────────────────────────────────────────────────

const LEVEL_COLORS = {
  info: "text-muted-foreground",
  success: "text-lp-green",
  warning: "text-lp-amber",
  error: "text-lp-red",
};

const LEVEL_PREFIX = {
  info: "›",
  success: "✓",
  warning: "!",
  error: "✕",
};

function EventLine({ event, index }: { event: RunEvent; index: number }) {
  return (
    <div
      className="py-1.5 border-b border-border/20 last:border-0"
      style={{
        animation: "lp-fade-in 0.25s ease both",
        animationDelay: `${index * 0.025}s`,
      }}
    >
      {/* Timestamp + agent on one row */}
      <div className="flex items-center gap-2 mb-0.5">
        <span className="font-mono text-[10px] text-muted-foreground/25 tabular-nums shrink-0">
          {formatTime(event.timestamp)}
        </span>
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.1em] shrink-0",
            LEVEL_COLORS[event.level]
          )}
        >
          {event.agentName}
        </span>
      </div>
      {/* Message on second row */}
      <span
        className={cn(
          "font-mono text-xs leading-relaxed break-words",
          LEVEL_COLORS[event.level]
        )}
      >
        <span className="mr-1.5 opacity-60">{LEVEL_PREFIX[event.level]}</span>
        {event.message}
      </span>
    </div>
  );
}

// ─── Live replay ──────────────────────────────────────────────────────────────

function LiveEventLog({ events }: { events: RunEvent[] }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startReplay() {
    setVisibleCount(0);
    setIsPlaying(true);
  }

  useEffect(() => {
    if (!isPlaying) return;
    if (visibleCount >= events.length) {
      setIsPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      setVisibleCount((c) => c + 1);
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    }, 180);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, visibleCount, events.length]);

  // Show all on initial mount (no replay)
  const shown = isPlaying ? events.slice(0, visibleCount) : events;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">
          Event Log
        </p>
        <button
          onClick={startReplay}
          className="text-[10px] text-muted-foreground/40 hover:text-lp-amber transition-colors font-mono cursor-pointer"
        >
          ↺ Replay
        </button>
      </div>
      <div
        ref={logRef}
        className="bg-background border border-border/60 px-4 py-3 h-80 overflow-y-auto space-y-0"
      >
        {shown.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground/20 py-2">
            — no events recorded —
          </p>
        ) : (
          shown.map((evt, i) => <EventLine key={evt.id} event={evt} index={i} />)
        )}
        {isPlaying && (
          <div className="font-mono text-xs text-lp-amber/60 py-1">
            <span className="animate-pulse">▌</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const AGENTS = ["scout", "analyst", "writer", "tracker", "reporter"] as const;

export function RunDetail({ run }: { run: PipelineRun }) {
  return (
    <div
      className="p-6 lg:p-8 space-y-6 max-w-5xl"
      style={{ animation: "lp-slide-up 0.35s ease both" }}
    >
      {/* Back + header */}
      <div>
        <Link
          href="/dashboard/runs"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Runs
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              {run.niche}{" "}
              <span className="text-muted-foreground font-normal">· {run.city}</span>
            </h1>
            <p className="text-xs text-muted-foreground/40 font-mono mt-1">
              {run.id} · Started {formatDate(run.startedAt)}
              {run.completedAt && ` · ${formatDuration(run.startedAt, run.completedAt)}`}
            </p>
          </div>
          <RunStatusBadge status={run.status} />
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/40 border border-border/40">
        {[
          { label: "Leads Found",  value: run.leadsFound   },
          { label: "Leads Scored", value: run.leadsScored  },
          { label: "Drafts Made",  value: run.leadsDrafted },
          { label: "Emails Sent",  value: run.leadsEmailed },
        ].map((stat) => (
          <div key={stat.label} className="bg-card px-5 py-4">
            <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.12em]">
              {stat.label}
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Body — 2 col */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Agent progress */}
        <div className="bg-card border border-border/60 p-5 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em] mb-4">
            Agent Progress
          </p>
          {AGENTS.map((agent, i) => (
            <AgentStep
              key={agent}
              agent={agent}
              status={run.agentProgress[agent]}
              index={i}
              isLast={i === AGENTS.length - 1}
            />
          ))}
        </div>

        {/* Event log */}
        <div className="bg-card border border-border/60 p-5">
          <LiveEventLog events={run.events ?? []} />
        </div>
      </div>
    </div>
  );
}
