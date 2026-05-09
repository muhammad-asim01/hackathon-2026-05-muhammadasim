/**
 * useTrack — PostHog event tracking hook for sift.ai.
 *
 * Separate from useAnalytics.ts (which queries the backend API).
 * This hook fires PostHog events for product analytics.
 *
 * Usage:
 *   const { track } = useTrack();
 *   track("pipeline_run_started", { niche: "dentist", city: "Austin TX" });
 */
"use client";

import { usePostHog } from "posthog-js/react";

// ─── Typed event catalogue ────────────────────────────────────────────────────

type TrackingEvent =
  // Pipeline
  | { event: "pipeline_run_started";   props: { niche?: string; city?: string } }
  | { event: "pipeline_run_completed"; props: { leads_found: number; leads_drafted: number } }
  | { event: "pipeline_run_failed";    props: { error?: string } }
  // Leads
  | { event: "lead_viewed";            props: { lead_id: string; score?: number; niche?: string } }
  | { event: "lead_status_changed";    props: { lead_id: string; status: string } }
  // Emails
  | { event: "email_approved";         props: { email_id: string } }
  | { event: "email_rejected";         props: { email_id: string } }
  // Auth
  | { event: "user_signed_in";         props: { method: "google" | "email" } }
  | { event: "user_signed_out";        props: Record<string, never> }
  // Settings
  | { event: "settings_saved";         props: { changed_fields?: string[] } }
  // Audit report (public prospect page)
  | { event: "audit_report_viewed";    props: { public_id: string; score?: number } };

type EventName  = TrackingEvent["event"];
type EventProps<E extends EventName> = Extract<TrackingEvent, { event: E }>["props"];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTrack() {
  const posthog = usePostHog();

  function track<E extends EventName>(event: E, props: EventProps<E>) {
    posthog?.capture(event, props as Record<string, unknown>);
  }

  return { track };
}
