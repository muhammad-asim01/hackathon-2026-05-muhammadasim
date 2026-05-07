import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Settings | sift.ai" };

export default function SettingsPage() {
  return <SettingsForm />;
}
