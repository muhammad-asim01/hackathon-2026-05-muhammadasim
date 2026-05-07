import type { Metadata } from "next";
import { RunsList } from "@/components/admin/RunsList";

export const metadata: Metadata = { title: "Runs | sift.ai" };

export default function RunsPage() {
  return <RunsList />;
}
