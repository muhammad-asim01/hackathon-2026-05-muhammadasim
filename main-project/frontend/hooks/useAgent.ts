"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSession } from "next-auth/react";
import { requests } from "@/lib/api/requests_helpers";
import { API_URLS } from "@/lib/api/urls_helpers";
import type { PipelineRun, RunEvent } from "@/lib/types";

// ─── Start pipeline mutation ──────────────────────────────────────────────────

interface StartInput {
  prompt: string;
  scoreThreshold?: number;
  wordLimit?: number;
}

interface StartResult {
  runId: string;
}

export function useStartPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartInput) =>
      requests.post<StartResult>(API_URLS.runs.start, input),
    onSuccess: () => {
      // Refresh the runs list so the new run appears immediately
      void qc.invalidateQueries({ queryKey: ["runs"] });
    },
    onError: () => {
      toast.error("Failed to start pipeline — check backend logs");
    },
  });
}

// ─── Live run — EventSource SSE ───────────────────────────────────────────────
// Opens SSE first, buffers events into pendingRef until the initial snapshot
// resolves. This prevents events that arrive before the snapshot from being
// silently dropped when prev is undefined.
//
// Flow:
//  1. Open SSE immediately (events go to pendingRef if snapshot not yet set)
//  2. Fetch initial snapshot → merge pendingRef into it → setRun
//  3. Subsequent events merge directly into run.events (prev is now defined)
//  4. "done" message → merge remaining pendingRef → replace state → close SSE

export function useLiveRun(runId: string | null) {
  const [run, setRun] = useState<PipelineRun | undefined>(undefined);
  // Buffer for events that arrive before the initial snapshot is ready
  const pendingRef = useRef<RunEvent[]>([]);
  const qc = useQueryClient();

  // Stable callback — invalidates all pages that depend on pipeline output.
  // Called once when the SSE "done" message arrives so approvals, leads, and
  // run-list all auto-refresh without the user having to navigate away and back.
  const invalidateAfterRun = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["approvals"] });
    void qc.invalidateQueries({ queryKey: ["leads"] });
    void qc.invalidateQueries({ queryKey: ["runs"] });
    void qc.invalidateQueries({ queryKey: ["analytics"] });
  }, [qc]);

  useEffect(() => {
    if (!runId) {
      setRun(undefined);
      pendingRef.current = [];
      return;
    }

    const id = runId;
    let source: EventSource | null = null;
    let cancelled = false;

    async function start() {
      pendingRef.current = [];

      // Resolve auth token — EventSource cannot send headers, so use ?token= param
      const session = await getSession();
      const token =
        (session as { accessToken?: string } | null)?.accessToken ??
        (process.env.NODE_ENV === "development" ? "dev-qa-bypass" : "");

      if (cancelled) return;

      // ── Step 1: open SSE before snapshot so no events are missed ──────────
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const url = `${baseUrl}${API_URLS.runs.events(id)}?token=${encodeURIComponent(token)}`;
      source = new EventSource(url);

      source.onmessage = (e: MessageEvent) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(e.data as string) as { type: string; data?: unknown };

          if (msg.type === "event") {
            const evt = msg.data as RunEvent;
            setRun((prev) => {
              if (!prev) {
                // Snapshot not yet arrived — buffer so we can merge later
                if (!pendingRef.current.some((x) => x.id === evt.id)) {
                  pendingRef.current = [...pendingRef.current, evt];
                }
                return prev;
              }
              // Dedup: don't append the same event twice on reconnect
              if (prev.events?.some((x) => x.id === evt.id)) return prev;
              return { ...prev, events: [...(prev.events ?? []), evt] };
            });
          } else if (msg.type === "done") {
            // Final DTO carries all events + final counters — merge in any
            // buffered events (edge case: done arrives before snapshot resolves)
            const fullRun = msg.data as PipelineRun;
            const allEvents = [...(fullRun.events ?? [])];
            for (const buffered of pendingRef.current) {
              if (!allEvents.some((x) => x.id === buffered.id)) {
                allEvents.push(buffered);
              }
            }
            pendingRef.current = [];
            setRun({ ...fullRun, events: allEvents });
            source?.close();
            // Bust all dependent caches — approvals, leads, runs, analytics
            // so every page is fresh as soon as the user navigates to it.
            invalidateAfterRun();
          }
        } catch {
          // Ignore malformed SSE frames
        }
      };

      source.onerror = async () => {
        source?.close();
        // SSE dropped mid-pipeline — fall back to a one-shot REST fetch so the
        // UI reflects the final state rather than staying stuck on "running".
        if (!cancelled) {
          try {
            const snapshot = await requests.get<PipelineRun>(API_URLS.runs.detail(id));
            if (!cancelled) {
              setRun(snapshot);
              if (snapshot.status === "complete" || snapshot.status === "failed") {
                invalidateAfterRun();
              }
            }
          } catch {
            // If the fallback also fails, leave the existing partial state in place
          }
        }
      };

      // ── Step 2: fetch snapshot AFTER SSE is listening ──────────────────────
      // Any events that arrived during the async snapshot fetch are in pendingRef
      // and get merged in below.
      try {
        const initial = await requests.get<PipelineRun>(API_URLS.runs.detail(id));
        if (cancelled) return;

        // Merge buffered events (arrived before snapshot) into snapshot
        const buffered = pendingRef.current;
        const allEvents = [...(initial.events ?? [])];
        for (const evt of buffered) {
          if (!allEvents.some((x) => x.id === evt.id)) allEvents.push(evt);
        }
        pendingRef.current = [];

        setRun({ ...initial, events: allEvents });

        if (initial.status === "complete" || initial.status === "failed") {
          source?.close();
          // Also invalidate if the run was already done when the snapshot arrived
          // (e.g. page refresh mid-run that has since completed)
          invalidateAfterRun();
          return;
        }
      } catch {
        // Snapshot fetch failed — SSE is already open and will populate state
        // via the pendingRef buffer + the "done" message merge path above
      }
    }

    void start();

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [runId, invalidateAfterRun]);

  return { data: run };
}

// ─── Recent runs (last 5, for the sidebar history list) ──────────────────────

export function useRecentRuns() {
  return useQuery({
    queryKey: ["runs", "list", { limit: 5 }],
    queryFn: () => requests.get<PipelineRun[]>(API_URLS.runs.list, { limit: 5 }),
    staleTime: 30_000,
  });
}
