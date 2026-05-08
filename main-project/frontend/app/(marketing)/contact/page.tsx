import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Have a question about sift.ai? Feature request, bug report, or just curious how the pipeline works. We read every message and respond within 24 hours.",
};

export default function ContactPage() {
  return (
    <div className="pt-14 pb-28 lg:pt-20 lg:pb-36">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-16 lg:gap-24 items-start">
          {/* Left */}
          <div>
            <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em] mb-4">
              Contact
            </p>
            <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold tracking-tighter text-foreground leading-tight mb-6">
              Get in touch.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-[44ch]">
              Have a question about pricing, a feature request, or want to
              report a bug? We read every message.
            </p>
            <div className="mt-10 space-y-4 text-sm text-muted-foreground">
              <p>
                <span className="text-foreground font-medium">
                  Response time:
                </span>{" "}
                Within 24 hours on business days
              </p>
              <p>
                <span className="text-foreground font-medium">Bug reports:</span>{" "}
                Please include your sift.ai version and the exact error message
              </p>
              <p>
                <span className="text-foreground font-medium">
                  Feature requests:
                </span>{" "}
                Describe your current workaround — it helps us prioritize
              </p>
            </div>
          </div>

          {/* Form */}
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
