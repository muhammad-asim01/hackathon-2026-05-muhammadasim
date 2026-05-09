"use client";

import Link from "next/link";
import { useActionState } from "react";
import { emailSignIn, type AuthActionState } from "@/app/actions/auth";

const initial: AuthActionState = {};

export function EmailLoginForm() {
  const [state, action, pending] = useActionState(emailSignIn, initial);

  return (
    <form action={action} className="space-y-4">
      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="block text-xs font-medium text-muted-foreground">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@agency.com"
          className="w-full h-10 px-3 bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-lp-amber/60 transition-colors duration-150"
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="block text-xs font-medium text-muted-foreground">
            Password
          </label>
          {/* Placeholder — wire up forgot-password page when ready */}
          <span className="text-[11px] text-muted-foreground/40">
            Forgot password?
          </span>
        </div>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="w-full h-10 px-3 bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-lp-amber/60 transition-colors duration-150"
        />
      </div>

      {/* Error */}
      {state.error && (
        <p className="text-xs text-lp-red leading-snug" role="alert">
          {state.error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="w-full h-11 flex items-center justify-center bg-lp-amber text-[#0c0a09] text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity duration-150 cursor-pointer disabled:cursor-not-allowed"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      {/* Signup link */}
      <p className="text-center text-xs text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="text-lp-amber hover:opacity-80 transition-opacity font-medium">
          Create one
        </Link>
      </p>
    </form>
  );
}
