"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requests } from "@/lib/api/requests_helpers";
import { API_URLS } from "@/lib/api/urls_helpers";
import type { PipelineRun } from "@/lib/types";

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useRuns(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["runs", "list", params],
    queryFn: () => requests.get<PipelineRun[]>(API_URLS.runs.list, params),
    staleTime: 30_000,
    // Poll every 5 s while any run is active; stop when all are terminal
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasActive = data.some(
        (r) => r.status === "running" || r.status === "queued"
      );
      return hasActive ? 5_000 : false;
    },
  });
}

export function useRunDetail(id: string) {
  return useQuery({
    queryKey: ["runs", "detail", id],
    queryFn: () => requests.get<PipelineRun>(API_URLS.runs.detail(id)),
    staleTime: 30_000,
    enabled: Boolean(id),
    // Poll every 3 s while the run is still in progress
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.status === "running" || data.status === "queued" ? 3_000 : false;
    },
  });
}

// ─── Run pipeline mutation ────────────────────────────────────────────────────
// Returns { runId } immediately — pipeline runs in background.
// Use useAgent.ts / useStartPipeline for the AgentPanel live-progress view.

interface RunPipelineInput {
  prompt: string;
  scoreThreshold?: number;
  wordLimit?: number;
}

export function useRunPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RunPipelineInput) =>
      requests.post<{ runId: string }>(API_URLS.runs.start, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["runs"] });
      toast.success("Pipeline started");
    },
    onError: () => {
      toast.error("Failed to start pipeline");
    },
  });
}
