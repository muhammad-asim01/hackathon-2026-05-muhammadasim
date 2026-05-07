"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "/#features", label: "Features", match: null },
  { href: "/#how-it-works", label: "How it works", match: null },
  { href: "/pricing", label: "Pricing", match: "/pricing" },
  { href: "/compare", label: "Compare", match: "/compare" },
] as const;

export default function MarketingNav() {

  const checkEnvLoads = process.env.NEXT_PUBLIC_API_URL!

  console.log({checkEnvLoads})
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (match: string | null) =>
    match !== null && pathname === match;

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50",
        "transition-all duration-300",
        isScrolled
          ? "bg-background/92 backdrop-blur-xl border-b border-border/60 shadow-[0_1px_0_rgba(202,177,106,0.04)]"
          : "bg-transparent",
      ].join(" ")}
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <div className="w-7 h-7 bg-lp-amber flex items-center justify-center rounded-sm transition-all duration-200 group-hover:bg-lp-amber/90 group-hover:scale-[1.05]">
            <Zap className="w-4 h-4 text-lp-charcoal" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-foreground">
            sift.ai
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-0.5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "relative px-4 py-2 text-sm transition-colors duration-200 rounded-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive(link.match)
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {link.label}
              {isActive(link.match) && (
                <span className="absolute bottom-0 left-4 right-4 h-px bg-lp-amber/70 rounded-full" />
              )}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard">Get started</Link>
          </Button>
        </div>

        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 mt-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={[
                    "px-4 py-3 text-[15px] transition-colors duration-200",
                    isActive(link.match)
                      ? "text-lp-amber bg-lp-amber/5 border-l-2 border-lp-amber/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent border-l-2 border-transparent",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-border mt-4 pt-4 flex flex-col gap-2 px-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    Log in
                  </Link>
                </Button>
                <Button asChild className="w-full">
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                    Get started
                  </Link>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
