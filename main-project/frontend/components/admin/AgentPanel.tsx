"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  BarChart2,
  Mail,
  Database,
  Play,
  CheckCircle2,
  XCircle,
  ArrowRight,
  MapPin,
  Briefcase,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  useStartPipeline,
  useLiveRun,
  useRecentRuns,
} from "@/hooks/useAgent";
import type { RunEvent } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "idle" | "running" | "done" | "error";

interface PipelineStep {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

// ─── Pipeline step definitions ────────────────────────────────────────────────

const STEPS: PipelineStep[] = [
  { id: "scout",   label: "Scout Agent",   description: "Discover via OpenStreetMap",       icon: Search    },
  { id: "analyst", label: "Analyst Agent", description: "Audit websites & score quality",   icon: BarChart2 },
  { id: "writer",  label: "Writer Agent",  description: "Draft 180-word emails via Claude", icon: Mail      },
  { id: "tracker", label: "Tracker Agent", description: "Log leads to CRM",                 icon: Database  },
];

// Agents that run exactly once per pipeline (one terminal SUCCESS event).
// Analyst / Writer / Tracker run once PER LEAD — they stay "running" until
// the entire pipeline finishes, even after emitting partial SUCCESS events.
const ONE_SHOT_AGENTS = new Set(["scout", "reporter"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

/** Count events emitted by a specific agent at a specific level. */
function countAgentEvents(events: RunEvent[], agentId: string, level: string): number {
  return events.filter(
    (e) => e.agentName.toLowerCase() === agentId && e.level === level
  ).length;
}

// ─── Step status indicator ────────────────────────────────────────────────────

function StepDot({ status }: { status: StepStatus }) {
  if (status === "running") {
    return (
      <div className="w-5 h-5 rounded-full border-2 border-lp-amber/20 border-t-lp-amber animate-spin shrink-0" />
    );
  }
  if (status === "done") {
    return (
      <div style={{ animation: "lp-step-done 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}>
        <CheckCircle2 className="w-5 h-5 text-lp-green shrink-0" strokeWidth={2} />
      </div>
    );
  }
  if (status === "error") {
    return <XCircle className="w-5 h-5 text-lp-red shrink-0" strokeWidth={2} />;
  }
  return <div className="w-5 h-5 rounded-full border border-border/50 shrink-0" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentPanel() {
  const [niche,   setNiche]   = useState("");
  const [city,    setCity]    = useState("");
  const [shaking, setShaking] = useState(false);
  const [runId,   setRunId]   = useState<string | null>(null);

  const startPipeline               = useStartPipeline();
  const { data: run }               = useLiveRun(runId);
  const { data: recentRuns = [] }   = useRecentRuns();

  const runStatus = run?.status ?? (runId ? "queued" : "idle");
  const isRunning = runStatus === "running" || runStatus === "queued";
  const isDone    = runStatus === "complete";
  const isFailed  = runStatus === "failed";
  const isActive  = isRunning;

  function handleRun() {
    if (isRunning) return;
    const n = niche.trim();
    const c = city.trim();
    if (!n || !c) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    setRunId(null);
    startPipeline.mutate(
      { prompt: `${n} in ${c}` },
      { onSuccess: ({ runId: id }) => setRunId(id) }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleRun();
  }

  // ─── Step status derivation ─────────────────────────────────────────────────
  //
  // Core rules:
  //  • ONE_SHOT agents (scout): done as soon as their single SUCCESS event fires.
  //  • Multi-lead agents (analyst/writer/tracker): stay "running" while the
  //    pipeline is active — even after partial SUCCESS events for individual leads,
  //    more leads may still be in-flight.
  //  • When the run is complete/failed: settle into final state from event history.
  //  • No events at all → idle (shows as "SKIPPED" when run has ended).

  function stepStatus(stepId: string): StepStatus {
    const events    = run?.events ?? [];
    const stepEvts  = events.filter((e) => e.agentName.toLowerCase() === stepId);

    if (!stepEvts.length) return "idle";

    const hasSuccess  = stepEvts.some((e) => e.level === "success");
    const hasError    = stepEvts.some((e) => e.level === "error");
    const runFinished = run?.status === "complete" || run?.status === "failed";

    // One-shot agents complete after their single terminal SUCCESS event
    if (ONE_SHOT_AGENTS.has(stepId) && hasSuccess) return "done";

    // Multi-lead agents stay "running" until the whole pipeline finishes
    if (!runFinished) return "running";

    // Run is done — derive final state from accumulated event history
    if (hasSuccess)           return "done";
    if (hasError)             return "error";
    return "done"; // had events but only INFO/WARNING → completed gracefully
  }

  // ─── Per-step progress counter ──────────────────────────────────────────────
  //
  // Counts SUCCESS events in the live event stream as a proxy for "N leads
  // processed" — accurate and always up-to-date without extra API calls.
  // Total comes from run counters (set by backend at each pipeline stage).

  function stepProgress(stepId: string): { done: number; total: number } | null {
    if (ONE_SHOT_AGENTS.has(stepId)) return null;

    const events       = run?.events ?? [];
    const successCount = countAgentEvents(events, stepId, "success");

    // "total" for each stage = how many leads were eligible for that stage.
    // During a live run these come from the initial snapshot; they're updated
    // continuously because leadsFound/leadsScored are set by runRepo.update()
    // after each batch, and the "done" SSE message carries the final values.
    const total =
      stepId === "analyst" ? (run?.leadsFound   ?? 0) :
      stepId === "writer"  ? (run?.leadsScored  ?? 0) :
      stepId === "tracker" ? (run?.leadsScored  ?? 0) : 0;

    if (successCount === 0 && total === 0) return null;
    return { done: successCount, total };
  }

  return (
    <div className="max-w-6xl w-full">

      {/* Heading */}
      <div className="mb-8" style={{ animation: "lp-slide-up 0.4s ease both" }}>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Run Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discover local businesses, audit their presence, and draft outreach emails.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

        {/* ── LEFT: form + history ─────────────────────────────────────── */}
        <div
          className="flex flex-col gap-6"
          style={{ animation: "lp-slide-up 0.45s ease both", animationDelay: "0.05s", animationFillMode: "both" }}
        >
          {/* Form card */}
          <div
            className={cn(
              "border border-border/60 bg-card/40 transition-all duration-300",
              isActive && "border-lp-amber/20",
            )}
            style={shaking ? { animation: "lp-shake 0.4s ease both" } : undefined}
          >
            {/* Niche input */}
            <div className="p-5 border-b border-border/60">
              <label
                htmlFor="lp-niche"
                className="block text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/50 mb-2.5"
              >
                Business type / niche
              </label>
              <div className="flex items-center gap-3">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" strokeWidth={1.5} />
                <input
                  id="lp-niche"
                  type="text"
                  placeholder="plumbing, dentist, HVAC…"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isActive}
                  autoComplete="off"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/25 outline-none border-b border-transparent focus:border-lp-amber/35 pb-0.5 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* City input */}
            <div className="p-5 border-b border-border/60">
              <label
                htmlFor="lp-city"
                className="block text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/50 mb-2.5"
              >
                City or region
              </label>
              <div className="flex items-center gap-3">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" strokeWidth={1.5} />
                <input
                  id="lp-city"
                  type="text"
                  placeholder="Austin, TX or New York…"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isActive}
                  autoComplete="off"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/25 outline-none border-b border-transparent focus:border-lp-amber/35 pb-0.5 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Run button */}
            <div className="p-5">
              <button
                onClick={handleRun}
                disabled={isActive}
                aria-label={isActive ? "Pipeline running" : "Run the lead pipeline"}
                className={cn(
                  "w-full h-11 flex items-center justify-center gap-2.5",
                  "text-sm font-semibold tracking-wide rounded-full",
                  "transition-all duration-200",
                  isActive
                    ? "bg-lp-amber/12 text-lp-amber/50 cursor-not-allowed border border-lp-amber/20"
                    : "bg-lp-amber text-stone-900 hover:bg-[#d4bb70] active:scale-[0.985] cursor-pointer",
                )}
              >
                {isActive ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-lp-amber/25 border-t-lp-amber/65 animate-spin" />
                    Pipeline running…
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-stone-900" strokeWidth={0} />
                    {isDone || isFailed ? "Run Again" : "Run Pipeline"}
                  </>
                )}
              </button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground/30">
                {isActive
                  ? "Watch the pipeline execute step by step →"
                  : "Fill both fields and press Enter or click"}
              </p>
            </div>
          </div>

          {/* Recent runs */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/35 mb-3">
              Recent runs
            </p>
            <div className="divide-y divide-border/40 border border-border/40">
              {recentRuns.length === 0 ? (
                <div className="px-4 py-4 text-[11px] text-muted-foreground/30 font-mono">
                  No runs yet
                </div>
              ) : (
                recentRuns.slice(0, 5).map((r) => (
                  <Link
                    key={r.id}
                    href={`/dashboard/runs/${r.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-card/40 transition-colors duration-150 group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground/75 group-hover:text-foreground transition-colors duration-150 truncate">
                        {r.niche || r.prompt}
                      </p>
                      <p className="text-[11px] text-muted-foreground/45 truncate">{r.city}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {r.status === "running" || r.status === "queued" ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-lp-amber animate-pulse" />
                      ) : r.status === "failed" ? (
                        <XCircle className="w-3.5 h-3.5 text-lp-red/55" strokeWidth={2} />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-lp-green/55" strokeWidth={2} />
                      )}
                      <span className="text-[11px] font-mono tabular-nums text-muted-foreground/45">
                        {r.leadsDrafted} leads
                      </span>
                      <span className="text-[10px] text-muted-foreground/30 flex items-center gap-1">
                        <Clock className="w-3 h-3" strokeWidth={1.5} />
                        {relativeTime(r.startedAt)}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: pipeline status panel ──────────────────────────────── */}
        <div
          className={cn(
            "border flex flex-col transition-all duration-500",
            isActive  ? "border-lp-amber/20 bg-lp-amber/[0.02]"
              : isDone  ? "border-lp-green/20 bg-lp-green/[0.02]"
              : isFailed ? "border-lp-red/20  bg-lp-red/[0.02]"
              : "border-border/60 bg-card/20",
          )}
          style={{ animation: "lp-slide-up 0.45s ease both", animationDelay: "0.1s", animationFillMode: "both" }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "w-2 h-2 rounded-full transition-colors duration-500",
                  isActive  ? "bg-lp-amber"
                    : isDone  ? "bg-lp-green"
                    : isFailed ? "bg-lp-red"
                    : "bg-border/80",
                )}
                style={isActive ? { animation: "lp-glow-pulse 1.6s ease-in-out infinite" } : undefined}
              />
              <p className="text-sm font-medium text-foreground">Pipeline status</p>
              {runId && (
                <span className="text-[10px] font-mono text-muted-foreground/25 truncate max-w-[120px]">
                  #{runId.slice(0, 8)}
                </span>
              )}
            </div>
            <span
              className={cn(
                "text-[9px] uppercase tracking-[0.18em] font-mono font-semibold transition-colors duration-300",
                isActive   ? "text-lp-amber/70"
                  : isDone ? "text-lp-green/70"
                  : isFailed ? "text-lp-red/70"
                  : "text-muted-foreground/30",
              )}
            >
              {runStatus}
            </span>
          </div>

          {/* Steps list */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* Idle placeholder — no run started yet */}
            {runStatus === "idle" && (
              <div
                className="flex flex-col items-center justify-center gap-4 py-12 text-center"
                style={{ animation: "lp-fade-in 0.4s ease both" }}
              >
                <div className="w-12 h-12 border border-border/40 flex items-center justify-center">
                  <Play className="w-5 h-5 text-muted-foreground/15 translate-x-px" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground/45">Ready to run</p>
                  <p className="text-[11px] text-muted-foreground/25 mt-1 max-w-[28ch] mx-auto leading-relaxed">
                    Fill in a niche and city on the left, then hit Run Pipeline.
                  </p>
                </div>
                {/* Step preview — muted */}
                <div className="w-full mt-2 space-y-0">
                  {STEPS.map((step, idx) => (
                    <div key={step.id}>
                      <div className="flex items-center gap-3 py-2.5 opacity-30">
                        <div className="w-5 h-5 rounded-full border border-border/50 shrink-0" />
                        <div className="flex-1 text-left">
                          <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{step.description}</p>
                        </div>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div className="ml-[9px] w-px h-2.5 bg-border/30" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active / complete steps */}
            {runStatus !== "idle" && (
              <div>
                {STEPS.map((step, idx) => {
                  const status    = stepStatus(step.id);
                  const progress  = stepProgress(step.id);
                  const stepEvts  = (run?.events ?? []).filter(
                    (e) => e.agentName.toLowerCase() === step.id
                  );
                  const Icon      = step.icon;
                  const isSkipped = status === "idle" && (isDone || isFailed);
                  const hasErrors = stepEvts.some((e) => e.level === "error");

                  return (
                    <div key={step.id}>
                      <div
                        className={cn(
                          "flex items-start gap-3 py-3 transition-opacity duration-400",
                          status === "idle" && !isSkipped ? "opacity-35" : "opacity-100",
                        )}
                      >
                        <div className="mt-0.5">
                          <StepDot status={status} />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Step name row */}
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={cn(
                                "text-sm font-medium transition-colors duration-300",
                                status === "running" ? "text-lp-amber"
                                  : status === "done"  ? "text-foreground"
                                  : status === "error" ? "text-lp-red"
                                  : isSkipped         ? "text-muted-foreground/35"
                                  : "text-muted-foreground/60",
                              )}
                            >
                              {step.label}
                            </p>

                            {/* Right-side status badge */}
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Live progress counter — shown for multi-lead steps */}
                              {progress !== null && (status === "running" || status === "done") && (
                                <span
                                  className={cn(
                                    "text-[10px] font-mono tabular-nums",
                                    status === "running"
                                      ? "text-lp-amber/60"
                                      : "text-lp-green/50",
                                  )}
                                >
                                  {progress.total > 0
                                    ? `${progress.done} / ${progress.total}`
                                    : progress.done > 0
                                    ? `${progress.done} done`
                                    : null}
                                </span>
                              )}

                              {status === "running" && (
                                <span
                                  className="text-[9px] uppercase tracking-[0.18em] font-mono text-lp-amber/55"
                                  style={{ animation: "lp-glow-pulse 2s ease-in-out infinite" }}
                                >
                                  running
                                </span>
                              )}
                              {status === "done" && (
                                <span
                                  className={cn(
                                    "text-[9px] uppercase tracking-[0.18em] font-mono",
                                    hasErrors ? "text-lp-amber/55" : "text-lp-green/50",
                                  )}
                                  style={{ animation: "lp-fade-in 0.3s ease both" }}
                                >
                                  {hasErrors ? "partial" : "done"}
                                </span>
                              )}
                              {status === "error" && (
                                <span className="text-[9px] uppercase tracking-[0.18em] font-mono text-lp-red/60">
                                  failed
                                </span>
                              )}
                              {isSkipped && (
                                <span className="text-[9px] uppercase tracking-[0.18em] font-mono text-muted-foreground/25">
                                  skipped
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Step description */}
                          <p className="text-[11px] text-muted-foreground/40 mt-0.5">
                            {step.description}
                          </p>

                          {/* Live log lines from backend events */}
                          {stepEvts.length > 0 && (
                            <div className="mt-2.5 space-y-1">
                              {stepEvts.map((e) => {
                                const isErr  = e.level === "error";
                                const isWarn = e.level === "warning";
                                const isOk   = e.level === "success";
                                return (
                                  <p
                                    key={e.id}
                                    className={cn(
                                      "text-[11px] font-mono leading-relaxed",
                                      isErr  ? "text-lp-red/70"
                                        : isWarn ? "text-lp-amber/55"
                                        : isOk   ? "text-lp-green/65"
                                        : "text-muted-foreground/45",
                                    )}
                                    style={{ animation: "lp-fade-in 0.3s ease both" }}
                                  >
                                    <span
                                      className={cn(
                                        "mr-1.5 select-none",
                                        isErr  ? "text-lp-red/50"
                                          : isWarn ? "text-lp-amber/40"
                                          : isOk   ? "text-lp-green/50"
                                          : "text-lp-amber/20",
                                      )}
                                    >
                                      {isErr ? "✕" : isWarn ? "!" : isOk ? "✓" : "›"}
                                    </span>
                                    {e.message}
                                  </p>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <Icon
                          className={cn(
                            "w-3.5 h-3.5 mt-1 shrink-0 transition-colors duration-300",
                            status === "running" ? "text-lp-amber/45"
                              : status === "done"  ? "text-lp-green/35"
                              : status === "error" ? "text-lp-red/35"
                              : "text-muted-foreground/12",
                          )}
                          strokeWidth={1.5}
                        />
                      </div>

                      {idx < STEPS.length - 1 && (
                        <div
                          className={cn(
                            "ml-[9px] w-px h-3 transition-colors duration-500",
                            status === "done" ? "bg-lp-green/30" : "bg-border/40",
                          )}
                        />
                      )}
                    </div>
                  );
                })}

                {/* Result card — complete */}
                {isDone && run && (
                  <div
                    className="mt-6 border border-lp-green/20 bg-lp-green/[0.04] px-5 py-5"
                    style={{ animation: "lp-slide-up 0.4s ease both" }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="w-4 h-4 text-lp-green" strokeWidth={2} />
                      <p className="text-sm font-semibold text-lp-green">Pipeline complete</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-5">
                      {[
                        { value: run.leadsFound,   label: "businesses found" },
                        { value: run.leadsScored,  label: "leads qualified"  },
                        { value: run.leadsDrafted, label: "emails drafted"   },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <p className="text-2xl font-bold text-foreground font-mono tabular-nums">
                            {stat.value}
                          </p>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-tight">
                            {stat.label}
                          </p>
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/dashboard/approvals"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-lp-amber hover:text-lp-amber/75 transition-colors duration-150 group cursor-pointer"
                    >
                      Review approval queue
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                )}

                {/* Error card */}
                {isFailed && run && (
                  <div
                    className="mt-6 border border-lp-red/20 bg-lp-red/[0.04] px-5 py-5"
                    style={{ animation: "lp-slide-up 0.4s ease both" }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-lp-red" strokeWidth={2} />
                      <p className="text-sm font-semibold text-lp-red">Pipeline failed</p>
                    </div>
                    {run.errorMessage && (
                      <p className="text-[11px] font-mono text-muted-foreground/50 leading-relaxed">
                        {run.errorMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
