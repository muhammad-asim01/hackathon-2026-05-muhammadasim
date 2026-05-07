"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requests } from "@/lib/api/requests_helpers";
import { API_URLS } from "@/lib/api/urls_helpers";
import type { EmailDraft } from "@/lib/types";

// ─── Query ────────────────────────────────────────────────────────────────────

export function useApprovals(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["approvals", "list", params],
    queryFn: () => requests.get<EmailDraft[]>(API_URLS.emails.list, params),
    staleTime: 0, // always fresh — approval queue is real-time
  });
}

// ─── Shared invalidation helper ───────────────────────────────────────────────

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["approvals"] });
  void qc.invalidateQueries({ queryKey: ["leads"] });
  void qc.invalidateQueries({ queryKey: ["analytics"] }); // fixes dashboard KPI tiles not updating
}

// ─── Mutations ────────────────────────────────────────────────────────────────

interface ApproveInput {
  id: string;
  /** Override recipient — required when the draft has no stored recipientEmail */
  recipientEmail?: string;
}

export function useApproveEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recipientEmail }: ApproveInput) =>
      requests.post<EmailDraft>(
        API_URLS.emails.approve(id),
        recipientEmail ? { recipientEmail } : undefined
      ),
    // Optimistic update — card flips to "sent" immediately; rolls back on error.
    // The backend marks SENT (not APPROVED) so we mirror the real final state.
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ["approvals"] });
      const previous = qc.getQueriesData<EmailDraft[]>({ queryKey: ["approvals"] });
      qc.setQueriesData<EmailDraft[]>({ queryKey: ["approvals"] }, (old) =>
        old?.map((d) =>
          d.id === id
            ? { ...d, status: "sent" as const, sentAt: new Date().toISOString() }
            : d
        ) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Failed to send email — please try again");
    },
    onSuccess: (data) => {
      invalidateAll(qc);
      const to = data.recipientEmail;
      toast.success(to ? `Email sent to ${to}` : "Email approved & sent");
    },
  });
}

export function useRejectEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      requests.post<EmailDraft>(API_URLS.emails.reject(id)),
    // Optimistic update — card shows resolved state instantly; rolls back on error
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["approvals"] });
      const previous = qc.getQueriesData<EmailDraft[]>({ queryKey: ["approvals"] });
      qc.setQueriesData<EmailDraft[]>({ queryKey: ["approvals"] }, (old) =>
        old?.map((d) => (d.id === id ? { ...d, status: "rejected" as const } : d)) ?? []
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      ctx?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Failed to discard draft — please try again");
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Draft discarded");
    },
  });
}

export function useEditEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, subject, body }: { id: string; subject?: string; body?: string }) =>
      requests.patch<EmailDraft>(API_URLS.emails.update(id), { subject, body }),
    onError: () => {
      toast.error("Failed to save changes — please try again");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("Draft saved");
    },
  });
}
