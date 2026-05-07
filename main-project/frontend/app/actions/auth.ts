"use server";

import { signIn, signOut } from "@/auth";

export async function googleSignIn() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function handleSignOut() {
  await signOut({ redirectTo: "/login" });
}

export async function devSignIn() {
  if (process.env.NODE_ENV !== "development") return;
  await signIn("credentials", { password: "dev", redirectTo: "/dashboard" });
}
