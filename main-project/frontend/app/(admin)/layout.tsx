import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/admin/AppSidebar";
import { AppHeader } from "@/components/admin/AppHeader";
import { MobileNav } from "@/components/admin/MobileNav";

// Force dynamic rendering on every request — ensures auth() always reads the
// current session cookie instead of a cached result. Combined with the
// Cache-Control: no-store header in next.config.ts, this prevents stale
// dashboard pages from being served after sign-out.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader session={session} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
