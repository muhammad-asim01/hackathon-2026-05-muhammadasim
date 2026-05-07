"use client";

import { type Session } from "next-auth";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { handleSignOut } from "@/app/actions/auth";

interface UserMenuProps {
  session: Session;
}

export function UserMenu({ session }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3">
      {session.user?.image ? (
        <Image
          src={session.user.image}
          alt={session.user.name ?? "User avatar"}
          width={28}
          height={28}
          className="rounded-full"
          unoptimized
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center text-xs font-medium text-muted-foreground">
          {session.user?.name?.[0]?.toUpperCase() ?? "U"}
        </div>
      )}
      <span className="text-sm text-muted-foreground hidden sm:block truncate max-w-[140px]">
        {session.user?.name}
      </span>
      <form action={handleSignOut}>
        <button
          type="submit"
          aria-label="Sign out"
          className="text-muted-foreground/40 hover:text-foreground transition-colors duration-150 cursor-pointer p-1"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
