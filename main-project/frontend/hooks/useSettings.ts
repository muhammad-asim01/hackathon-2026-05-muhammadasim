"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requests } from "@/lib/api/requests_helpers";
import { API_URLS } from "@/lib/api/urls_helpers";
import type { Settings } from "@/lib/types";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => requests.get<Settings>(API_URLS.settings),
    staleTime: 60_000,
  });
}

interface UpdateSettingsInput {
  dailyQuota?: number;
  scoreThreshold?: number;
  emailWordLimit?: number;
  targetNiches?: string[];
  targetCities?: string[];
  fromName?: string | null;
  replyToEmail?: string | null;
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSettingsInput) =>
      requests.patch<Settings>(API_URLS.settings, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });
}
