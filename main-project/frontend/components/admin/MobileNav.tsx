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
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",             label: "Home",      icon: LayoutDashboard },
  { href: "/dashboard/agent",       label: "Agent",     icon: Zap             },
  { href: "/dashboard/leads",       label: "Leads",     icon: Building2       },
  { href: "/dashboard/runs",        label: "Runs",      icon: Terminal        },
  { href: "/dashboard/approvals",   label: "Approvals", icon: CheckSquare     },
  { href: "/dashboard/analytics",   label: "Analytics", icon: BarChart2       },
  { href: "/dashboard/settings",    label: "Settings",  icon: Settings        },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden shrink-0 h-14 flex items-center border-t border-border bg-card">
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
              "flex-1 flex flex-col items-center justify-center gap-1 h-full transition-colors",
              isActive
                ? "text-lp-amber"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon
              className="w-[18px] h-[18px] shrink-0"
              strokeWidth={isActive ? 2 : 1.5}
            />
            <span className="hidden sm:block text-[8px] font-medium leading-none">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
