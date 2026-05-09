"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

// ─── Google OAuth ─────────────────────────────────────────────────────────────

export async function googleSignIn() {
  await signIn("google", { redirectTo: "/dashboard" });
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function handleSignOut() {
  await signOut({ redirectTo: "/login" });
}

// ─── Email + password login ───────────────────────────────────────────────────
// Called by EmailLoginForm via useActionState.
// Returns { error } on bad credentials; re-throws NEXT_REDIRECT on success.

export interface AuthActionState {
  error?: string;
}

export async function emailSignIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    await signIn("email-password", {
      email:      formData.get("email"),
      password:   formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password. Please try again." };
    }
    throw err; // rethrow NEXT_REDIRECT so the redirect works
  }
  return {};
}

// ─── Register + auto sign-in ──────────────────────────────────────────────────
// 1. Calls POST /api/auth/register on the backend.
// 2. On success, auto-signs-in using the email-password credentials provider.
// Returns { error } on validation/conflict; re-throws NEXT_REDIRECT on success.

export async function registerAndSignIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const name     = (formData.get("name")     as string | null)?.trim() ?? "";
  const email    = (formData.get("email")    as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null)         ?? "";

  // ── Call backend register endpoint ────────────────────────────────────────
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  let res: Response;
  try {
    res = await fetch(`${backendUrl}/auth/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: name || undefined, email, password }),
    });
  } catch {
    return { error: "Could not reach the server. Please try again." };
  }

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: { message?: string } };
    const msg  = json?.error?.message ?? "";
    if (res.status === 409 || msg.toLowerCase().includes("already exists")) {
      return { error: "An account with this email already exists. Please sign in." };
    }
    if (res.status === 400) {
      return { error: msg || "Please check your details and try again." };
    }
    return { error: "Registration failed. Please try again." };
  }

  // ── Registration succeeded — send to login with a success banner ──────────
  redirect("/login?registered=1");
}

// ─── Dev bypass (development only) ───────────────────────────────────────────

export async function devSignIn() {
  if (process.env.NODE_ENV !== "development") return;
  await signIn("dev", { password: "dev", redirectTo: "/dashboard" });
}
