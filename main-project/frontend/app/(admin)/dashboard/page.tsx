import type { Metadata } from "next";
import { DashboardOverview } from "@/components/admin/DashboardOverview";

export const metadata: Metadata = {
  title: "Dashboard | sift.ai",
  description: "sift.ai pipeline overview.",
};

export default function DashboardPage() {
  return <DashboardOverview />;
}
