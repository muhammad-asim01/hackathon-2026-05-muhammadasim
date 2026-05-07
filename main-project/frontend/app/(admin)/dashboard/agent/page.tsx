import type { Metadata } from "next";
import { AgentPanel } from "@/components/admin/AgentPanel";

export const metadata: Metadata = {
  title: "Agent | sift.ai",
  description: "Run the sift.ai pipeline agent.",
};

export default function AgentPage() {
  return (
    <div className="p-6 lg:p-8">
      <AgentPanel />
    </div>
  );
}
