import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CTABanner() {
  return (
    <section className="relative py-24 lg:py-32 border-t border-border/40 overflow-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 55% at 50% 110%, rgba(202,177,106,0.16) 0%, transparent 65%)",
        }}
      />
      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-30"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(202,177,106,0.05) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(202,177,106,0.05) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 50% 100%, black 20%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 80% at 50% 100%, black 20%, transparent 80%)",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <p
          className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em] mb-5"
          style={{ animation: "lp-fade-in 0.5s ease", animationFillMode: "both" }}
        >
          Get started today
        </p>
        <h2
          className="font-display text-[1.875rem] md:text-4xl lg:text-[2.75rem] font-bold tracking-tighter text-foreground leading-tight mb-5"
          style={{
            animation: "lp-slide-up 0.5s ease",
            animationDelay: "0.1s",
            animationFillMode: "both",
          }}
        >
          Stop prospecting manually.
          <br className="hidden sm:block" />
          <span className="text-lp-amber"> Let the pipeline run for you.</span>
        </h2>
        <p
          className="text-base lg:text-lg text-muted-foreground leading-relaxed max-w-[50ch] mx-auto mb-8"
          style={{
            animation: "lp-slide-up 0.5s ease",
            animationDelay: "0.2s",
            animationFillMode: "both",
          }}
        >
          Set a niche, set a city, and let sift.ai handle the scouting, scoring,
          and drafting. You show up to close — nothing else.
        </p>
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
          style={{
            animation: "lp-slide-up 0.5s ease",
            animationDelay: "0.3s",
            animationFillMode: "both",
          }}
        >
          <Button asChild size="lg">
            <Link href="/dashboard">
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
        <p
          className="mt-5 text-xs text-muted-foreground/40"
          style={{
            animation: "lp-fade-in 0.5s ease",
            animationDelay: "0.45s",
            animationFillMode: "both",
          }}
        >
          No credit card required · Self-hosted · MIT licensed
        </p>
      </div>
    </section>
  );
}
