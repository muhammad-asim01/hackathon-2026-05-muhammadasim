import type { Metadata } from "next";
import { AnalyticsCharts } from "@/components/admin/AnalyticsCharts";

export const metadata: Metadata = { title: "Analytics | sift.ai" };

export default function AnalyticsPage() {
  return <AnalyticsCharts />;
}
