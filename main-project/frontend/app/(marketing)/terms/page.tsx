import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "MIT-licensed and self-hosted. You control the data. Read the sift.ai terms of service before installing or using the software.",
};

const SECTIONS = [
  {
    title: "1. Acceptance",
    body: `By installing, running, or using sift.ai software you agree to these terms. If you disagree, do not use the software.`,
  },
  {
    title: "2. License",
    body: `sift.ai is released under the MIT License. You may use, copy, modify, and distribute the software, including for commercial purposes, subject to the MIT License terms. The license text is included in the source repository.`,
  },
  {
    title: "3. Responsible use",
    body: `You are solely responsible for how you use sift.ai. This includes compliance with applicable anti-spam laws (CAN-SPAM, GDPR, CASL, and equivalents), Google API terms of service, and email provider terms. Do not use sift.ai to send unsolicited bulk email or to collect data you are not authorized to collect.`,
  },
  {
    title: "4. API usage and billing",
    body: `sift.ai uses third-party APIs (Google Maps, Anthropic, Gmail, PageSpeed Insights, Google Sheets). All API costs are billed directly to your accounts with those providers. sift.ai is not responsible for overages, quota exhaustion, or billing disputes with any external provider.`,
  },
  {
    title: "5. Data and privacy",
    body: `See our Privacy Policy for details on what data sift.ai stores and how it flows. Because sift.ai is self-hosted, you are the data controller for all business and lead data in your installation.`,
  },
  {
    title: "6. Disclaimer of warranties",
    body: `sift.ai is provided "as is" without warranty of any kind. The maintainers make no guarantees regarding uptime, accuracy of AI-generated content, API reliability, or fitness for a particular purpose.`,
  },
  {
    title: "7. Limitation of liability",
    body: `To the fullest extent permitted by law, the sift.ai contributors shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the software, including lost revenue, lost leads, or reputational damage.`,
  },
  {
    title: "8. Changes to these terms",
    body: `We may update these terms at any time. Continued use after an update constitutes acceptance. Material changes will be noted in the changelog.`,
  },
  {
    title: "9. Contact",
    body: "",
    hasContact: true,
  },
] as const;

export default function TermsPage() {
  return (
    <div className="pt-14 pb-28 lg:pt-20 lg:pb-36">
      <div className="max-w-3xl mx-auto px-6">
        <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em] mb-4">
          Legal
        </p>
        <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold tracking-tighter text-foreground leading-tight mb-4">
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground mb-12">
          Last updated: 1 January 2025
        </p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">
          {SECTIONS.map((section) => (
            <section key={section.title} className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                {section.title}
              </h2>
              {"hasContact" in section && section.hasContact ? (
                <p>
                  Legal questions?{" "}
                  <Link
                    href="/contact"
                    className="text-foreground underline underline-offset-4 hover:text-lp-amber transition-colors duration-200"
                  >
                    Contact us
                  </Link>
                  . We will respond within five business days.
                </p>
              ) : (
                <p>{section.body}</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
