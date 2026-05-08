"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  Building2,
  Terminal,
  CheckSquare,
  BarChart2,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",             label: "Dashboard",  icon: LayoutDashboard },
  { href: "/dashboard/agent",       label: "Agent",      icon: Zap             },
  { href: "/dashboard/leads",       label: "Leads",      icon: Building2       },
  { href: "/dashboard/runs",        label: "Runs",       icon: Terminal        },
  { href: "/dashboard/approvals",   label: "Approvals",  icon: CheckSquare     },
  { href: "/dashboard/analytics",   label: "Analytics",  icon: BarChart2       },
  // { href: "/dashboard/settings",    label: "Settings",   icon: Settings        },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 hidden md:flex flex-col border-r border-border bg-card h-full">

      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border/60 shrink-0">
        <div className="w-6 h-6 bg-lp-amber flex items-center justify-center shrink-0">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M8 1L14 5V11L8 15L2 11V5L8 1Z"
              stroke="#0c0a09"
              strokeWidth="1.5"
              fill="none"
            />
            <path d="M8 4L11 6.5V9.5L8 12L5 9.5V6.5L8 4Z" fill="#0c0a09" />
          </svg>
        </div>
        <span className="font-semibold text-sm text-foreground tracking-tight">
          sift.ai
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm transition-colors duration-150",
                isActive
                  ? "bg-lp-amber/10 text-lp-amber"
                  : "text-muted-foreground hover:text-foreground hover:bg-border/30"
              )}
            >
              <item.icon
                className="w-4 h-4 shrink-0"
                strokeWidth={isActive ? 2 : 1.5}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border/60 shrink-0 space-y-1">
        {/* Debug link — dev only */}
        {process.env.NODE_ENV !== "production" && (
          <Link
            href="/dashboard/debug"
            className={cn(
              "flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors duration-150",
              pathname.startsWith("/dashboard/debug")
                ? "bg-lp-amber/10 text-lp-amber"
                : "text-muted-foreground/30 hover:text-muted-foreground/60"
            )}
          >
            <FlaskConical className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            Debug
          </Link>
        )}
        <p className="px-3 text-[10px] text-muted-foreground/30 tabular-nums">
          v0.1-alpha · Phase 1C
        </p>
      </div>
    </aside>
  );
}
