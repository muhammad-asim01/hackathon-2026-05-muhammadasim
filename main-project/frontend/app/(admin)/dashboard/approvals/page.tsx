import type { Metadata } from "next";
import { ApprovalsQueue } from "@/components/admin/ApprovalsQueue";

export const metadata: Metadata = { title: "Approvals | sift.ai" };

export default function ApprovalsPage() {
  return <ApprovalsQueue />;
}
