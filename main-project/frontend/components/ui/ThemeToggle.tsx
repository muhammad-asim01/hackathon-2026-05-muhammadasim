"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// ── ThemeToggle ────────────────────────────────────────────────────────────────
// Mounted check prevents hydration mismatch: server renders nothing; client
// renders the correct icon after mount once localStorage is read.

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Placeholder with same dimensions — avoids layout shift
    return <div className="w-7 h-7" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="
        relative w-7 h-7 flex items-center justify-center
        rounded-full
        text-muted-foreground hover:text-foreground
        hover:bg-accent/60
        transition-colors duration-150
        cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
      "
    >
      {/* Sun icon — shown in dark mode (click switches to light) */}
      <Sun
        className="absolute w-[15px] h-[15px] transition-all duration-300"
        strokeWidth={1.75}
        style={{
          opacity: isDark ? 1 : 0,
          transform: isDark ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.5)",
        }}
      />
      {/* Moon icon — shown in light mode (click switches to dark) */}
      <Moon
        className="absolute w-[15px] h-[15px] transition-all duration-300"
        strokeWidth={1.75}
        style={{
          opacity: isDark ? 0 : 1,
          transform: isDark ? "rotate(90deg) scale(0.5)" : "rotate(0deg) scale(1)",
        }}
      />
    </button>
  );
}
