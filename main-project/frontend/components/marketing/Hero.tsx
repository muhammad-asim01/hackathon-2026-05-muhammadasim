"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Play } from "lucide-react";
import PipelineTerminal from "./PipelineTerminal";

/* ─── Examples cycling through the prompt ─────────────────────────────── */
const EXAMPLES = [
  { niche: "plumbing", city: "Austin, TX" },
  { niche: "dentist", city: "Chicago, IL" },
  { niche: "HVAC", city: "Denver, CO" },
  { niche: "landscaping", city: "Phoenix, AZ" },
  { niche: "electrician", city: "Miami, FL" },
] as const;

type Phase =
  | "typing-niche"
  | "pause-niche"
  | "typing-city"
  | "hold"
  | "clear-city"
  | "clear-niche"
  | "pause-next";

const DELAYS: Record<Phase, number> = {
  "typing-niche":  72,
  "pause-niche":   260,
  "typing-city":   52,
  "hold":          2700,
  "clear-city":    36,
  "clear-niche":   46,
  "pause-next":    320,
};

const PROOF = [
  "47 leads found in 4 days",
  "3 active agencies",
  "Austin, TX pilot",
] as const;

/* ─── Blinking cursor ─────────────────────────────────────────────────── */
function Cursor() {
  return (
    <span
      aria-hidden
      className="inline-block w-[1.5px] h-[0.9em] bg-lp-amber/80 align-middle mx-px"
      style={{ animation: "lp-blink 1s step-end infinite" }}
    />
  );
}

export default function Hero() {
  /* terminal reset */
  const [runKey, setRunKey]     = useState(0);
  const [scanning, setScanning] = useState(false);

  /* typewriter */
  const [exIdx, setExIdx]           = useState(0);
  const [typedNiche, setTypedNiche] = useState("");
  const [typedCity,  setTypedCity]  = useState("");
  const [phase, setPhase]           = useState<Phase>("typing-niche");
  const [frozen, setFrozen]         = useState(false);

  const ex = EXAMPLES[exIdx];

  /* ── typewriter state-machine ──────────────────────────────────────── */
  useEffect(() => {
    if (frozen) return;

    const t = setTimeout(() => {
      switch (phase) {
        case "typing-niche":
          if (typedNiche.length < ex.niche.length) {
            setTypedNiche(ex.niche.slice(0, typedNiche.length + 1));
          } else {
            setPhase("pause-niche");
          }
          break;
        case "pause-niche":
          setPhase("typing-city");
          break;
        case "typing-city":
          if (typedCity.length < ex.city.length) {
            setTypedCity(ex.city.slice(0, typedCity.length + 1));
          } else {
            setPhase("hold");
          }
          break;
        case "hold":
          setPhase("clear-city");
          break;
        case "clear-city":
          if (typedCity.length > 0) setTypedCity((s) => s.slice(0, -1));
          else setPhase("clear-niche");
          break;
        case "clear-niche":
          if (typedNiche.length > 0) setTypedNiche((s) => s.slice(0, -1));
          else setPhase("pause-next");
          break;
        case "pause-next":
          setExIdx((i) => (i + 1) % EXAMPLES.length);
          setPhase("typing-niche");
          break;
      }
    }, DELAYS[phase]);

    return () => clearTimeout(t);
  }, [phase, typedNiche, typedCity, ex, frozen]);

  /* ── Run Scan ──────────────────────────────────────────────────────── */
  function handleRunScan() {
    if (scanning) return;
    setScanning(true);
    setFrozen(true);
    setRunKey((k) => k + 1);
    setTimeout(() => {
      setScanning(false);
      setFrozen(false);
    }, 4200);
  }

  /* ── Derived display state ─────────────────────────────────────────── */
  const nicheCursor =
    !frozen && (phase === "typing-niche");
  const showCityBlock =
    phase === "pause-niche" ||
    phase === "typing-city" ||
    phase === "hold" ||
    phase === "clear-city";
  const cityCursor =
    !frozen && (phase === "pause-niche" || phase === "typing-city" || phase === "hold");

  return (
    <section className="relative min-h-[100dvh] overflow-hidden flex flex-col pt-16">

      {/* ── Ambient glow ───────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 60% at -5% 5%, rgba(202,177,106,0.18) 0%, transparent 60%)",
            "radial-gradient(ellipse 50% 40% at 105% 95%, rgba(202,177,106,0.08) 0%, transparent 55%)",
          ].join(", "),
        }}
      />

      {/* ── Grid texture ───────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(202,177,106,0.06) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(202,177,106,0.06) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 30% 40%, black 20%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 80% at 30% 40%, black 20%, transparent 85%)",
        }}
      />

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex items-center w-full">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[58fr_42fr] gap-12 lg:gap-14 items-center">

            {/* ── LEFT ─────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-6">

              {/* Eyebrow */}
              <div
                style={{
                  animation: "lp-slide-up 0.5s ease",
                  animationDelay: "0.1s",
                  animationFillMode: "both",
                }}
              >
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-lp-amber/30 bg-lp-amber/[0.08] text-lp-amber text-xs font-medium tracking-wide">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-lp-amber"
                    style={{ animation: "lp-glow-pulse 2.5s ease-in-out infinite" }}
                  />
                  AI-Powered Lead Engine
                </span>
              </div>

              {/* Headline */}
              <div
                style={{
                  animation: "lp-slide-up 0.55s ease",
                  animationDelay: "0.2s",
                  animationFillMode: "both",
                }}
              >
                <h1 className="font-display text-[1.875rem] sm:text-[2.5rem] md:text-5xl lg:text-[3.5rem] xl:text-[4rem] 2xl:text-[4.5rem] font-bold tracking-tighter leading-[1.04] text-foreground">
                  Your next client is
                  <br />
                  <span className="text-lp-amber">hiding in plain sight.</span>
                </h1>
              </div>

              {/* Subtitle */}
              <div
                style={{
                  animation: "lp-slide-up 0.55s ease",
                  animationDelay: "0.32s",
                  animationFillMode: "both",
                }}
              >
                <p className="text-base lg:text-lg text-muted-foreground leading-relaxed max-w-[50ch]">
                  sift.ai scans Google Maps for local businesses losing customers
                  to weak websites, scores each one automatically, and drafts a
                  personalized 180-word pitch — waiting in your approval queue
                  before anything ever sends.
                </p>
              </div>

              {/* ── Interactive prompt + Run Scan ──────────────────────── */}
              <div
                style={{
                  animation: "lp-slide-up 0.55s ease",
                  animationDelay: "0.44s",
                  animationFillMode: "both",
                }}
                className="flex flex-col gap-0"
              >
                {/* Prompt box */}
                <div
                  className={[
                    "border px-4 py-3.5 font-mono transition-all duration-500",
                    scanning
                      ? "border-lp-amber/35 bg-lp-amber/[0.05] shadow-[0_0_24px_rgba(202,177,106,0.08)]"
                      : "border-border/60 bg-card/50",
                  ].join(" ")}
                >
                  <div className="flex items-baseline flex-wrap gap-x-2 text-[11px] sm:text-[13px] leading-[1.9]">
                    {/* Prompt prefix */}
                    <span className="text-muted-foreground/35 select-none">$</span>
                    <span className="text-foreground/55">sift run</span>

                    {/* --niche "value" — tight unit, no gap inside quotes */}
                    <span className="inline-flex items-baseline">
                      <span className="text-lp-amber/80">--niche</span>
                      <span className="text-lp-green/85 ml-1">
                        &quot;{typedNiche}
                      </span>
                      {nicheCursor && <Cursor />}
                      <span className="text-lp-green/85">&quot;</span>
                    </span>

                    {/* --city "value" — appears after niche is typed */}
                    {showCityBlock && (
                      <span
                        className="inline-flex items-baseline"
                        style={{ animation: "lp-fade-in 0.2s ease both" }}
                      >
                        <span className="text-lp-amber/80">--city</span>
                        <span className="text-lp-green/85 ml-1">
                          &quot;{typedCity}
                        </span>
                        {cityCursor && <Cursor />}
                        <span className="text-lp-green/85">&quot;</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Run Scan button */}
                <button
                  onClick={handleRunScan}
                  disabled={scanning}
                  aria-label="Run a simulated lead scan"
                  className={[
                    "h-11 text-sm font-semibold tracking-wide",
                    "flex items-center justify-center gap-2.5",
                    "border-x border-b transition-all duration-200",
                    scanning
                      ? "border-lp-amber/25 bg-lp-amber/10 text-lp-amber/60 cursor-default"
                      : "border-lp-amber bg-lp-amber text-stone-900 hover:bg-[#d4bb70] active:scale-[0.985] cursor-pointer",
                  ].join(" ")}
                >
                  {scanning ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-lp-amber/30 border-t-lp-amber/70 animate-spin" />
                      Scanning…
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-stone-900" strokeWidth={0} />
                      Run Scan
                    </>
                  )}
                </button>

                {/* Hint */}
                <p className="mt-2 text-[11px] text-muted-foreground/35 text-center">
                  {scanning
                    ? "Pipeline initiated — watch the terminal →"
                    : "Click to simulate a live discovery run"}
                </p>
              </div>

              {/* Secondary CTAs */}
              <div
                className="flex items-center gap-5"
                style={{
                  animation: "lp-slide-up 0.55s ease",
                  animationDelay: "0.56s",
                  animationFillMode: "both",
                }}
              >
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors duration-200"
                >
                  Start for free
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <span className="text-border/60">·</span>
                <Link
                  href="/#how-it-works"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  See how it works
                </Link>
              </div>

              {/* Social proof */}
              <div
                className="flex flex-wrap items-center gap-x-5 gap-y-2"
                style={{
                  animation: "lp-slide-up 0.55s ease",
                  animationDelay: "0.66s",
                  animationFillMode: "both",
                }}
              >
                {PROOF.map((point) => (
                  <div
                    key={point}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground/70"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-lp-green/80 shrink-0" />
                    {point}
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT — Terminal ─────────────────────────────────────── */}
            <div
              style={{
                animation: "lp-slide-in-right 0.6s ease",
                animationDelay: "0.5s",
                animationFillMode: "both",
              }}
            >
              <PipelineTerminal
                key={runKey}
                niche={ex.niche}
                city={ex.city}
              />
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
