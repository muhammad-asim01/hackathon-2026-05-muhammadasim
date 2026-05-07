import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — sift.ai",
  description:
    "sift.ai is self-hosted. Your leads, API keys, and email drafts never leave your server. Read our full privacy policy.",
};

export default function PrivacyPage() {
  return (
    <div className="pt-14 pb-28 lg:pt-20 lg:pb-36">
      <div className="max-w-3xl mx-auto px-6">
        <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em] mb-4">
          Legal
        </p>
        <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold tracking-tighter text-foreground leading-tight mb-4">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-12">
          Last updated: 1 January 2025
        </p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              1. Overview
            </h2>
            <p>
              sift.ai is a self-hosted application. The software runs on
              infrastructure you control. We (the sift.ai project maintainers)
              do not collect, store, or transmit your data unless you explicitly
              contact us.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              2. Data you store
            </h2>
            <p>
              When you run sift.ai, the following data is stored in{" "}
              <em>your</em> PostgreSQL database:
            </p>
            <ul className="list-none space-y-2 pl-0">
              {[
                "Business names, addresses, and phone numbers sourced from Google Maps",
                "Website audit scores and PageSpeed results",
                "AI-generated email drafts and their approval status",
                "Google review excerpts used in email personalization",
                "Pipeline run logs and agent event history",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <span className="w-1 h-1 rounded-full bg-lp-amber mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p>
              This data never leaves your server unless you configure Sheets
              sync (which writes to a spreadsheet in your Google account) or
              trigger email sending (which uses your Gmail credentials).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              3. Third-party APIs
            </h2>
            <p>
              sift.ai makes requests to the following external services
              using API keys you supply:
            </p>
            <ul className="list-none space-y-2 pl-0">
              {[
                "Google Maps Platform — to discover local businesses",
                "Google PageSpeed Insights — to audit website performance",
                "Anthropic Claude API — to generate outreach email drafts",
                "Gmail API — to send approved emails from your account",
                "Google Sheets API — to mirror leads to your spreadsheet",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <span className="w-1 h-1 rounded-full bg-lp-amber mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p>
              Each provider&apos;s privacy policy governs how they handle data
              submitted via their APIs. Consult their documentation for details.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              4. Authentication data
            </h2>
            <p>
              Admin login uses NextAuth with Google OAuth. Your Google account
              ID and email address are stored in the database solely to
              identify the authenticated session. No other Google profile data
              is persisted.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              5. Contact
            </h2>
            <p>
              Questions about data handling?{" "}
              <Link
                href="/contact"
                className="text-foreground underline underline-offset-4 hover:text-lp-amber transition-colors duration-200"
              >
                Contact us
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
