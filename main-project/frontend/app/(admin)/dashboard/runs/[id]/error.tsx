"use client";

import { ErrorPage } from "@/components/admin/ErrorPage";

export default function RunDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPage error={error} reset={reset} section="Run detail" />;
}
