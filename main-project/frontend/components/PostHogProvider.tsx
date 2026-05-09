"use client";

/**
 * PostHog provider for Next.js 15 App Router.
 *
 * - Initialises posthog-js once on mount (client-side only).
 * - `capture_pageview: false` — page views tracked manually via
 *   PostHogPageView so Next.js soft-navigations are captured correctly.
 * - Identifies the user when a NextAuth session is present.
 */
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

// ─── Initialiser ──────────────────────────────────────────────────────────────

function PostHogInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (posthog.__loaded) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host:        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      person_profiles: "identified_only",  // only create profiles for signed-in users
      capture_pageview: false,             // handled manually below
      capture_pageleave: true,
    });
  }, []);

  return null;
}

// ─── Page view tracker ────────────────────────────────────────────────────────
// Wrapped in Suspense — useSearchParams() requires it in App Router.

function PageViewCapture() {
  const pathname      = usePathname();
  const searchParams  = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;
    const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

// ─── Identity sync ────────────────────────────────────────────────────────────
// Identifies/resets the PostHog user whenever the NextAuth session changes.

function IdentitySync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (!posthog.__loaded) return;

    if (status === "authenticated" && session?.user?.email) {
      posthog.identify(session.user.email, {
        email: session.user.email,
        name:  session.user.name ?? undefined,
      });
    }

    if (status === "unauthenticated") {
      posthog.reset();
    }
  }, [status, session]);

  return null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogInit />
      <Suspense fallback={null}>
        <PageViewCapture />
      </Suspense>
      <IdentitySync />
      {children}
    </PHProvider>
  );
}
