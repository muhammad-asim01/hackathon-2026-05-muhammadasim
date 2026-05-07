"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requests } from "@/lib/api/requests_helpers";
import { API_URLS } from "@/lib/api/urls_helpers";
import type { Lead, LeadDetail, LeadStatus, PagedResult } from "@/lib/types";

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface LeadFilters {
  status?: LeadStatus | string;
  niche?: string;
  city?: string;
  search?: string;
  scoreGte?: number;
  scoreLte?: number;
  page?: number;
  limit?: number;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useLeads(filters: LeadFilters = {}) {
  return useQuery({
    queryKey: ["leads", "list", filters],
    queryFn: () =>
      requests.get<PagedResult<Lead>>(API_URLS.leads.list, {
        ...filters,
        // Remove undefined values so they don't appear as "undefined" in query string
        ...Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v !== undefined)
        ),
      }),
    staleTime: 30_000,
  });
}

export function useLeadDetail(id: string) {
  return useQuery({
    queryKey: ["leads", "detail", id],
    queryFn: () => requests.get<LeadDetail>(API_URLS.leads.detail(id)),
    staleTime: 30_000,
    enabled: Boolean(id),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useUpdateLead(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { status?: LeadStatus; topIssue?: string }) =>
      requests.patch<Lead>(API_URLS.leads.update(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead updated");
    },
  });
}
