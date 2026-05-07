import {
  BrainCircuit,
  Gauge,
  ShieldCheck,
  Radio,
  FileSpreadsheet,
  Cpu,
} from "lucide-react";

const FEATURES = [
  {
    id: "ai-email",
    icon: BrainCircuit,
    title: "AI-Crafted Outreach",
    description:
      "Claude Sonnet 4.6 writes exactly 180 words per email, referencing a real Google review and a named website flaw. Every draft is unique — no merge tags, no templates.",
    span: "col-span-2",
    featured: true,
  },
  {
    id: "smart-score",
    icon: Gauge,
    title: "Smart Scoring",
    description:
      "Businesses scored 0–100 on PageSpeed, mobile, and review quality. Scores above 75 are automatically skipped.",
    span: "col-span-1",
    featured: false,
  },
  {
    id: "approval-queue",
    icon: ShieldCheck,
    title: "Approval Queue",
    description:
      "Nothing sends without your sign-off. Every draft waits in the queue with a one-click approve or discard.",
    span: "col-span-1",
    featured: false,
  },
  {
    id: "live-pipeline",
    icon: Radio,
    title: "Live Pipeline Status",
    description:
      "Server-Sent Events stream real-time agent progress directly to the dashboard. Watch Scout → Writer run step by step.",
    span: "col-span-2",
    featured: false,
  },
  {
    id: "sheets-sync",
    icon: FileSpreadsheet,
    title: "Google Sheets Auto-Sync",
    description:
      "Every approved lead mirrors to a Sheets CRM in real-time. Works with your existing workflow — no CSV exports.",
    span: "col-span-2",
    featured: false,
  },
  {
    id: "rate-aware",
    icon: Cpu,
    title: "Rate-Aware Engine",
    description:
      "Built-in Maps deduplication with 30-day cache. Daily caps hard-wired in — the free tier stays free.",
    span: "col-span-1",
    featured: false,
  },
] as const;

export default function FeaturesBento() {
  return (
    <section id="features" className="py-24 lg:py-32 border-t border-border/40">
      <div className="max-w-7xl mx-auto px-6">

        {/* Section header */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16 mb-12 lg:mb-16">
          <div>
            <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em] mb-4">
              Features
            </p>
            <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold tracking-tighter text-foreground leading-tight">
              Built for the solo operator. Not a sales team.
            </h2>
          </div>
          <div className="flex items-end">
            <p className="text-muted-foreground leading-relaxed max-w-[56ch]">
              One person. One dashboard. A full pipeline that runs on its own
              schedule and surfaces only what needs your attention.
            </p>
          </div>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border/60 border border-border/60">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.id}
                className={[
                  "relative flex flex-col gap-5 p-7 lg:p-8",
                  "bg-background hover:bg-card/50",
                  "transition-colors duration-200 cursor-default group",
                  feature.span === "col-span-2" ? "md:col-span-2" : "md:col-span-1",
                  feature.featured ? "lg:p-10" : "",
                ].join(" ")}
                style={{
                  animation: "lp-slide-up 0.4s ease",
                  animationDelay: `${0.04 + i * 0.06}s`,
                  animationFillMode: "both",
                }}
              >
                {/* Featured accent bar */}
                {feature.featured && (
                  <div
                    aria-hidden
                    className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-lp-amber/60 via-lp-amber/20 to-transparent"
                  />
                )}

                <div
                  className={[
                    "w-9 h-9 border flex items-center justify-center shrink-0",
                    "transition-all duration-200",
                    feature.featured
                      ? "border-lp-amber/30 bg-lp-amber/8"
                      : "border-border/60 bg-background group-hover:border-lp-amber/20",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "w-4 h-4 transition-colors duration-200",
                      feature.featured
                        ? "text-lp-amber"
                        : "text-muted-foreground/60 group-hover:text-muted-foreground",
                    ].join(" ")}
                    strokeWidth={1.5}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
