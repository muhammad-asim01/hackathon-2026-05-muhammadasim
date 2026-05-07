"use client";

import { useEffect, useState } from "react";

interface Props {
  niche?: string;
  city?: string;
}

const BASE_STEPS = [
  {
    num: 1,
    label: "Scout Agent",
    status: "done" as const,
    detail: (city: string) => `Found 12 businesses · ${city}`,
    delay: "0.5s",
  },
  {
    num: 2,
    label: "Analyst Agent",
    status: "done" as const,
    detail: () => "Scored 3 leads ≤ 75  (discarded 9)",
    delay: "1.0s",
  },
  {
    num: 3,
    label: "Writer Agent",
    status: "running" as const,
    detail: () => "Drafting email 2 of 3",
    delay: "1.5s",
  },
  {
    num: 4,
    label: "Tracker Agent",
    status: "pending" as const,
    detail: () => "Waiting for Writer",
    delay: "1.9s",
  },
  {
    num: 5,
    label: "Reporter Agent",
    status: "pending" as const,
    detail: () => "Queued",
    delay: "2.2s",
  },
];

type StepStatus = "done" | "running" | "pending";

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <span className="text-lp-green font-bold text-[13px]">✓</span>;
  if (status === "running") return <span className="text-lp-amber text-[10px]">▶</span>;
  return <span className="text-muted-foreground/40 text-[13px]">◌</span>;
}

export default function PipelineTerminal({ niche = "plumbing", city = "Austin, TX" }: Props) {
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setAnimKey((k) => k + 1), 12000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      key={animKey}
      className="w-full border border-border bg-card overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.4)]"
    >
      {/* Chrome bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-background/60">
        <span className="w-2.5 h-2.5 rounded-full bg-lp-red/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-lp-amber/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-lp-green/60" />
        <span className="ml-3 font-mono text-[11px] text-muted-foreground/60 tracking-wide">
          sift.ai · run #47 · 2m 34s elapsed
        </span>
      </div>

      {/* Body */}
      <div className="p-5 font-mono text-sm space-y-5">
        {/* Command line */}
        <div
          style={{ animation: "lp-fade-in 0.3s ease", animationDelay: "0.1s", animationFillMode: "both" }}
          className="text-[11px] leading-relaxed"
        >
          <span className="text-lp-amber/70">$</span>{" "}
          <span className="text-foreground/80">sift run</span>{" "}
          <span className="text-lp-amber/80">--niche</span>{" "}
          <span className="text-lp-green/80">&quot;{niche}&quot;</span>{" "}
          <span className="text-lp-amber/80">--city</span>{" "}
          <span className="text-lp-green/80">&quot;{city}&quot;</span>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {BASE_STEPS.map((step) => (
            <div
              key={step.num}
              style={{
                animation: "lp-slide-up 0.3s ease",
                animationDelay: step.delay,
                animationFillMode: "both",
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-muted-foreground/40 text-[10px] mt-0.5 w-7 shrink-0 tabular-nums">
                  [{step.num}/5]
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={step.status} />
                    <span
                      className={
                        step.status === "pending"
                          ? "text-muted-foreground/50 text-[11px]"
                          : "text-foreground/90 text-[11px] font-semibold"
                      }
                    >
                      {step.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5 pl-5">
                    {step.detail(city)}
                    {step.status === "running" && (
                      <span
                        className="ml-0.5 inline-block w-[4px] h-[10px] bg-lp-amber align-middle"
                        style={{ animation: "lp-blink 1s step-end infinite" }}
                      />
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div
          style={{ animation: "lp-fade-in 0.3s ease", animationDelay: "2.6s", animationFillMode: "both" }}
        >
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/50 mb-1.5">
            <span>Progress</span>
            <span className="tabular-nums">3 / 12 processed · 47%</span>
          </div>
          <div className="h-[3px] bg-border/60 overflow-hidden">
            <div
              className="h-full bg-lp-amber w-0"
              style={{
                animation: "lp-progress 1.6s cubic-bezier(0.4, 0, 0.2, 1)",
                animationDelay: "2.9s",
                animationFillMode: "both",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2 pt-2 border-t border-border/40"
          style={{ animation: "lp-fade-in 0.3s ease", animationDelay: "3.3s", animationFillMode: "both" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-lp-amber shrink-0"
            style={{ animation: "lp-glow-pulse 2s ease-in-out infinite" }}
          />
          <span className="text-[10px] text-muted-foreground/50">
            Pipeline running — 3 emails pending approval
          </span>
        </div>
      </div>
    </div>
  );
}
