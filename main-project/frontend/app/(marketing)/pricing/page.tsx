import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Pricing — Free to start, upgrade when it earns its keep",
  description:
    "sift.ai is free to start. Upgrade when the pipeline earns its keep. All plans include Scout, Analyst, Writer, and Tracker agents — only lead volume and automation depth differ.",
};

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Kick the tyres. No limits on time.",
    cta: "Get started",
    ctaHref: "/dashboard",
    highlight: false,
    features: [
      { label: "5 leads per run", included: true },
      { label: "Manual run (click to start)", included: true },
      { label: "AI email drafts", included: true },
      { label: "Dashboard with lead list", included: true },
      { label: "Approval queue", included: false },
      { label: "Daily cron at 9 am", included: false },
      { label: "Google Sheets auto-sync", included: false },
      { label: "Multiple niches per run", included: false },
      { label: "Email send history", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    period: "per month",
    description: "For agencies actively working a pipeline.",
    cta: "Start Pro",
    ctaHref: "/dashboard",
    highlight: true,
    features: [
      { label: "50 leads per run", included: true },
      { label: "Manual run (click to start)", included: true },
      { label: "AI email drafts", included: true },
      { label: "Dashboard with lead list", included: true },
      { label: "Approval queue", included: true },
      { label: "Daily cron at 9 am", included: true },
      { label: "Google Sheets auto-sync", included: true },
      { label: "Multiple niches per run (up to 5)", included: true },
      { label: "Email send history", included: true },
    ],
  },
  {
    id: "agency",
    name: "Agency",
    price: "$129",
    period: "per month",
    description: "Unlimited reach across multiple cities.",
    cta: "Start Agency",
    ctaHref: "/dashboard",
    highlight: false,
    features: [
      { label: "Unlimited leads per run", included: true },
      { label: "Manual run (click to start)", included: true },
      { label: "AI email drafts", included: true },
      { label: "Dashboard with lead list", included: true },
      { label: "Approval queue", included: true },
      { label: "Daily cron (custom time)", included: true },
      { label: "Google Sheets auto-sync", included: true },
      { label: "Unlimited niches + multiple cities", included: true },
      { label: "White-label audit PDF reports", included: true },
    ],
  },
] as const;

const FAQ = [
  {
    q: "Is sift.ai really self-hosted?",
    a: "Yes. You deploy sift.ai to your own server — Oracle Cloud, Hetzner, any VPS. We never touch your leads, API keys, or email drafts.",
  },
  {
    q: "What will API costs actually run me?",
    a: "Google Maps free tier covers 200 calls/day — more than enough for 3 targeted businesses. A Claude Sonnet draft costs roughly $0.003. Most days cost under $0.05 in API fees.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Yes. Every plan is month-to-month with zero lock-in. Downgrade to Free anytime and keep full access to your existing lead data.",
  },
  {
    q: "Do I need technical skills to get started?",
    a: "Basic comfort with a terminal and environment variables. The quickstart guide walks you through setup in roughly 20 minutes.",
  },
  {
    q: "Can I upgrade or downgrade mid-month?",
    a: "Yes. Upgrades activate immediately and are prorated. Downgrades take effect at the start of your next billing cycle.",
  },
  {
    q: "What counts as a 'lead'?",
    a: "A lead is any business the Scout Agent discovers in a run. Only businesses scoring ≤ 75 on the digital audit advance to email drafting — everything above that threshold is silently skipped.",
  },
] as const;

export default function PricingPage() {
  return (
    <div className="pt-14 pb-28 lg:pt-20 lg:pb-36">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header — two-column like other sections */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16 mb-14 lg:mb-16">
          <div>
            <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em] mb-4">
              Pricing
            </p>
            <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold tracking-tighter text-foreground leading-tight">
              Simple pricing.
              <br />No surprises.
            </h1>
          </div>
          <div className="flex items-end">
            <p className="text-muted-foreground leading-relaxed max-w-[52ch]">
              Start free and upgrade when the pipeline earns its keep. All plans
              include the full AI pipeline — only limits differ.
            </p>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border/60 border border-border/60">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={[
                "relative flex flex-col p-8",
                tier.highlight
                  ? "bg-card"
                  : "bg-background",
              ].join(" ")}
            >
              {/* Pro top accent line */}
              {tier.highlight && (
                <div
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lp-amber/70 to-transparent"
                />
              )}

              {/* Tier header */}
              <div className="flex items-start justify-between gap-3 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h2 className="text-[15px] font-semibold text-foreground">
                      {tier.name}
                    </h2>
                    {tier.highlight && (
                      <Badge variant="warning" className="text-[10px] px-2 py-0.5">
                        Popular
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tier.description}
                  </p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-7">
                <div className="flex items-baseline gap-1">
                  <span className="text-[2rem] font-bold text-foreground tracking-tight">
                    {tier.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {tier.period}
                  </span>
                </div>
              </div>

              {/* CTA */}
              <Button
                asChild
                variant={tier.highlight ? "default" : "outline"}
                className="mb-7 w-full"
                shape="sharp"
              >
                <Link href={tier.ctaHref}>{tier.cta}</Link>
              </Button>

              {/* Divider */}
              <div className="border-t border-border/40 mb-6" />

              {/* Features */}
              <ul className="flex flex-col gap-2.5 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-2.5 text-sm">
                    {feature.included ? (
                      <Check className="w-4 h-4 text-lp-green mt-0.5 shrink-0" strokeWidth={2} />
                    ) : (
                      <Minus className="w-4 h-4 text-muted-foreground/30 mt-0.5 shrink-0" strokeWidth={1.5} />
                    )}
                    <span className={feature.included ? "text-foreground" : "text-muted-foreground/40"}>
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Note */}
        <p className="mt-8 text-center text-sm text-muted-foreground/60">
          All plans are self-hosted on your own infrastructure. API costs
          (Google Maps, Anthropic) billed directly to your accounts.{" "}
          <Link
            href="/contact"
            className="text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors duration-200"
          >
            Questions? Contact us.
          </Link>
        </p>

        {/* FAQ */}
        <div className="mt-20 lg:mt-24 border-t border-border/40 pt-16 lg:pt-20">
          <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em] mb-8">
            FAQ
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
            {FAQ.map((item) => (
              <div key={item.q}>
                <p className="text-[15px] font-semibold text-foreground mb-2.5 leading-snug">
                  {item.q}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
