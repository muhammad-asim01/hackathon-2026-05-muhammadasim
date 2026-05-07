import type { Metadata } from "next";
import { googleSignIn, devSignIn } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your sift.ai dashboard.",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
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

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-8 h-8 bg-lp-amber flex items-center justify-center shrink-0">
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
          <span className="font-semibold text-base text-foreground tracking-tight">
            sift.ai
          </span>
        </div>

        {/* Card */}
        <div className="border border-border bg-card">
          <div className="px-8 pt-8 pb-6 border-b border-border/60">
            <h1 className="font-display text-[1.35rem] font-bold text-foreground tracking-tight leading-snug mb-2">
              Sign in to your dashboard
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Access your lead pipeline, approval queue, and run history.
            </p>
          </div>

          <div className="px-8 py-6 space-y-3">
            <form action={googleSignIn}>
              <button
                type="submit"
                className="w-full h-11 flex items-center justify-center gap-3 border border-border bg-background hover:bg-card text-sm font-medium text-foreground transition-colors duration-200 cursor-pointer"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </form>

            {process.env.NODE_ENV === "development" && (
              <form action={devSignIn}>
                <button
                  type="submit"
                  className="w-full h-9 flex items-center justify-center border border-lp-amber/30 bg-lp-amber/5 text-xs font-mono text-lp-amber/70 hover:bg-lp-amber/10 transition-colors cursor-pointer"
                >
                  Dev Login (QA only)
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/40 leading-relaxed">
          Only your Google account ID and email address are stored.
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
