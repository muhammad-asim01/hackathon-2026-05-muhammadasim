"use client";

import { useQuery } from "@tanstack/react-query";
import { requests } from "@/lib/api/requests_helpers";
import { API_URLS } from "@/lib/api/urls_helpers";
import type { AnalyticsSummary } from "@/lib/types";

export interface FunnelPoint {
  name: string;
  value: number;
}

export interface ScoreBucket {
  range: string;
  count: number;
}

export interface NicheRow {
  niche: string;
  leads: number;
  approved: number;
  sent: number;
}

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => requests.get<AnalyticsSummary>(API_URLS.analytics.summary),
    staleTime: 60_000,
  });
}

export function useAnalyticsFunnel() {
  return useQuery({
    queryKey: ["analytics", "funnel"],
    queryFn: () => requests.get<FunnelPoint[]>(API_URLS.analytics.funnel),
    staleTime: 60_000,
  });
}

export function useAnalyticsScoreDistribution() {
  return useQuery({
    queryKey: ["analytics", "scoreDistribution"],
    queryFn: () => requests.get<ScoreBucket[]>(API_URLS.analytics.scoreDistribution),
    staleTime: 60_000,
  });
}

export interface NicheBreakdownResult {
  data: NicheRow[];
  total: number;
}

export function useAnalyticsNicheBreakdown(params?: { limit?: number; offset?: number }) {
  const limit  = params?.limit  ?? 10;
  const offset = params?.offset ?? 0;
  return useQuery({
    queryKey: ["analytics", "nicheBreakdown", limit, offset],
    queryFn: () =>
      requests.get<NicheBreakdownResult>(API_URLS.analytics.nicheBreakdown, { limit, offset }),
    staleTime: 60_000,
  });
}
