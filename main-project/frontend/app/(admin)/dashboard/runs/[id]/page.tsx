import type { Metadata } from "next";
import { RunDetailClient } from "@/components/admin/RunDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Run ${id} | sift.ai` };
}

export default async function RunDetailPage({ params }: Props) {
  const { id } = await params;
  return <RunDetailClient id={id} />;
}
