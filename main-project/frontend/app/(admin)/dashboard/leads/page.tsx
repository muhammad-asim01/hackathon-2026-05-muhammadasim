import type { Metadata } from "next";
import { LeadsTable } from "@/components/admin/LeadsTable";

export const metadata: Metadata = { title: "Leads | sift.ai" };

export default function LeadsPage() {
  return <LeadsTable />;
}
