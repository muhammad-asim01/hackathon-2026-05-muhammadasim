"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAndSignIn, type AuthActionState } from "@/app/actions/auth";

const initial: AuthActionState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(registerAndSignIn, initial);

  return (
    <form action={action} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="signup-name" className="block text-xs font-medium text-muted-foreground">
          Name <span className="text-muted-foreground/40">(optional)</span>
        </label>
        <input
          id="signup-name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Jane Smith"
          className="w-full h-10 px-3 bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-lp-amber/60 transition-colors duration-150"
        />
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="signup-email" className="block text-xs font-medium text-muted-foreground">
          Email
        </label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-password" className="block text-xs font-medium text-muted-foreground">
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Min. 8 characters"
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
        {pending ? "Creating account…" : "Create account"}
      </button>

      {/* Sign in link */}
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-lp-amber hover:opacity-80 transition-opacity font-medium">
          Sign in
        </Link>
      </p>
    </form>
  );
}
