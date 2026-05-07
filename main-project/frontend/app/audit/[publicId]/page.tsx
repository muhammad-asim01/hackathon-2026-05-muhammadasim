import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { PublicAuditLead } from "@/lib/types";
import { AuditReport } from "@/components/audit/AuditReport";

interface Props {
  params: Promise<{ publicId: string }>;
}

// ─── Server-side data fetch (no auth — public endpoint) ───────────────────────

async function fetchAudit(publicId: string): Promise<PublicAuditLead | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;

  try {
    const res = await fetch(`${apiUrl}/public/audit/${publicId}`, {
      // Revalidate frequently so score appears shortly after pipeline runs
      next: { revalidate: 30 },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const json = (await res.json()) as { ok: boolean; data: PublicAuditLead };
    return json.data;
  } catch {
    return null;
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const lead = await fetchAudit(publicId);
  if (!lead) return { title: "Audit Not Found | sift.ai" };
  return {
    title: `Digital Audit — ${lead.businessName} | sift.ai`,
    description: `Automated digital presence audit for ${lead.businessName}, ${lead.city}.${
      lead.digitalScore !== undefined ? ` Score: ${lead.digitalScore}/100.` : ""
    }`,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AuditPage({ params }: Props) {
  const { publicId } = await params;
  const lead = await fetchAudit(publicId);
  if (!lead) notFound();
  return <AuditReport lead={lead} />;
}
