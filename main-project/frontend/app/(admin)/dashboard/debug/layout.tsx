/**
 * Debug layout — gates access to the debug console in development only.
 * In production / staging, returns 404 so the route is invisible to scanners.
 */
import { notFound } from "next/navigation";

export default function DebugLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <>{children}</>;
}
