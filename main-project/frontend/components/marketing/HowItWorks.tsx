import {
  MapPin,
  ScanLine,
  Target,
  PenLine,
  Send,
} from "lucide-react";

const STEPS = [
  {
    num: 1,
    icon: MapPin,
    title: "Scout local businesses",
    description:
      "Queries Google Maps Places API for businesses in your chosen niche and city. Deduplicates against a 30-day cache so you never bill the same lookup twice.",
    label: "Scout Agent",
  },
  {
    num: 2,
    icon: ScanLine,
    title: "Audit their digital presence",
    description:
      "Crawls their website with Puppeteer, runs Google PageSpeed Insights, and pulls their latest Google reviews to build a full picture of their online health.",
    label: "Analyst Agent",
  },
  {
    num: 3,
    icon: Target,
    title: "Score and filter",
    description:
      "Assigns a 0–100 score based on site speed, mobile responsiveness, and review sentiment. Businesses scoring above 75 are skipped — only real opportunities get through.",
    label: "Scoring Engine",
  },
  {
    num: 4,
    icon: PenLine,
    title: "Draft personalized outreach",
    description:
      "Claude Sonnet 4.6 writes a precise 180-word email referencing a real review, a named site issue, and closes with a question. No generic templates — ever.",
    label: "Writer Agent",
  },
  {
    num: 5,
    icon: Send,
    title: "Approve, track, and report",
    description:
      "Every draft lands in an approval queue — nothing sends without your sign-off. On approval, the lead logs to Postgres and mirrors to Google Sheets automatically.",
    label: "Tracker · Reporter",
  },
] as const;

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 lg:py-32 border-t border-border/40">
      <div className="max-w-7xl mx-auto px-6">

        {/* Section header */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16 mb-16 lg:mb-20">
          <div>
            <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em] mb-4">
              How it works
            </p>
            <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold tracking-tighter text-foreground leading-tight">
              A five-agent pipeline that runs while you sleep.
            </h2>
          </div>
          <div className="flex items-end">
            <p className="text-muted-foreground leading-relaxed max-w-[56ch]">
              Each agent is a focused use-case. No agent calls another directly
              — the orchestrator wires them in sequence and logs every step to
              an audit trail you can replay at any time.
            </p>
          </div>
        </div>

        {/* Steps — horizontal divider style */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div
            aria-hidden
            className="absolute left-[19px] top-8 bottom-8 w-px bg-gradient-to-b from-lp-amber/30 via-border to-transparent hidden md:block"
          />

          <div className="space-y-0 divide-y divide-border/40">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="relative grid grid-cols-1 md:grid-cols-[40px_1fr] gap-5 md:gap-10 py-8 group cursor-default"
                  style={{
                    animation: "lp-slide-up 0.4s ease",
                    animationDelay: `${0.05 + i * 0.08}s`,
                    animationFillMode: "both",
                  }}
                >
                  {/* Step number */}
                  <div className="flex md:flex-col items-center md:items-start gap-3 md:gap-0 md:pt-0.5">
                    <div className="relative z-10 w-10 h-10 rounded-full border border-border bg-background flex items-center justify-center shrink-0 transition-all duration-300 group-hover:border-lp-amber/40 group-hover:bg-lp-amber/5">
                      <span className="text-[11px] font-semibold font-mono text-lp-amber tabular-nums">
                        {String(step.num).padStart(2, "0")}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:gap-8 items-start">
                    <div>
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="w-7 h-7 border border-border/60 bg-background flex items-center justify-center shrink-0 transition-colors duration-300 group-hover:border-lp-amber/20">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground/70 group-hover:text-muted-foreground transition-colors duration-300" strokeWidth={1.5} />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground/40 tracking-[0.12em] uppercase">
                          {step.label}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-foreground tracking-tight mb-1.5">
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-[56ch]">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
