import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a sift.ai account to access your lead pipeline.",
};

export default function SignupPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background relative overflow-hidden">

      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(202,177,106,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Grid texture */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(202,177,106,0.05) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(202,177,106,0.05) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 85%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[400px] px-6">

        {/* Logo — click navigates to marketing home */}
        <Link
          href="/"
          className="flex items-center justify-center gap-2.5 mb-10 group"
        >
          <div className="w-8 h-8 bg-lp-amber flex items-center justify-center shrink-0 transition-opacity duration-150 group-hover:opacity-75">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M8 1L14 5V11L8 15L2 11V5L8 1Z"
                stroke="#0c0a09"
                strokeWidth="1.5"
                fill="none"
              />
              <path d="M8 4L11 6.5V9.5L8 12L5 9.5V6.5L8 4Z" fill="#0c0a09" />
            </svg>
          </div>
          <span className="font-semibold text-base text-foreground tracking-tight transition-opacity duration-150 group-hover:opacity-75">
            sift.ai
          </span>
        </Link>

        {/* Card */}
        <div className="border border-border bg-card">
          <div className="px-8 pt-8 pb-6 border-b border-border/60">
            <h1 className="font-display text-[1.35rem] font-bold text-foreground tracking-tight leading-snug mb-2">
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Start finding and contacting leads in minutes.
            </p>
          </div>

          <div className="px-8 py-6">
            <SignupForm />
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/40 leading-relaxed">
          Only your name, email, and a hashed password are stored.
          <br />
          See our{" "}
          <a
            href="/privacy"
            className="underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            privacy policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
