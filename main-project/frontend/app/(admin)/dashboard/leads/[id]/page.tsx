"use client";

import { use } from "react";
import { useLeadDetail } from "@/hooks/useLeads";
import { LeadDetail } from "@/components/admin/LeadDetail";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default function LeadDetailPage({ params }: Props) {
  const { id } = use(params);
  const { data, isLoading, isError } = useLeadDetail(id);

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl animate-pulse">
        <div className="h-4 w-16 bg-border/40 rounded-none" />
        <div className="h-6 w-64 bg-border/40 rounded-none" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/60 h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Leads
        </Link>
        <p className="text-sm text-lp-red/70">Lead not found or failed to load.</p>
      </div>
    );
  }

  // Pick the first pending email as the active draft, or null if none
  const draft = data.emails.find((e) => e.status === "pending") ?? data.emails[0] ?? null;

  return <LeadDetail lead={data} draft={draft} />;
}
