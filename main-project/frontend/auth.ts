import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { SignJWT } from "jose";
import { authConfig } from "@/auth.config";

// Backend URL — used for credentials login and Google sync
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

interface BackendUser {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
}

// ─── Email + password credentials provider ────────────────────────────────────
// Delegates auth to POST /api/auth/login on the backend.

const emailPasswordCredentials = Credentials({
  id: "email-password",
  name: "Email",
  credentials: {
    email:    { label: "Email",    type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(creds) {
    if (!creds?.email || !creds?.password) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: creds.email, password: creds.password }),
      });
      if (!res.ok) return null;
      const json = await res.json() as { ok: boolean; data: BackendUser };
      if (!json.ok || !json.data?.id) return null;
      return {
        id:    json.data.id,
        email: json.data.email,
        name:  json.data.name ?? undefined,
        role:  json.data.role,
      };
    } catch {
      return null;
    }
  },
});

// ─── Dev bypass (development only) ───────────────────────────────────────────
// Set NEXTAUTH_DEV_PASSWORD in .env.local — never hardcode.

const DEV_PASSWORD = process.env.NEXTAUTH_DEV_PASSWORD ?? "";

const devCredentials = process.env.NODE_ENV === "development" && DEV_PASSWORD
  ? [Credentials({
      id:   "dev",
      name: "Dev Login",
      credentials: { password: { label: "Dev password", type: "password" } },
      async authorize(creds) {
        if (DEV_PASSWORD && creds?.password === DEV_PASSWORD) {
          return { id: "dev", name: "Dev Admin", email: "dev@sift.ai.dev", role: "ADMIN" as const };
        }
        return null;
      },
    })]
  : [];

// ─── Mint backend JWT ─────────────────────────────────────────────────────────
// Creates a HS256 token the Express backend can verify with NEXTAUTH_SECRET.

async function mintBackendToken(
  sub: string,
  email: string,
  name?: string,
  role?: string,
): Promise<string> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  return new SignJWT({
    sub,
    email,
    ...(name !== undefined ? { name } : {}),
    ...(role !== undefined ? { role } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(secret);
}

// ─── NextAuth config ──────────────────────────────────────────────────────────

const config: NextAuthConfig = {
  ...authConfig,
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    emailPasswordCredentials,
    ...devCredentials,
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, account, user }) {
      // Persist role from credentials authorize() on first sign-in
      if (user && "role" in user) {
        token.role = (user as { role?: string }).role;
      }
      // Google OAuth users always get ADMIN role
      if (account?.provider === "google" && !token.role) {
        token.role = "ADMIN";
      }

      // Mint a fresh backend JWT on first sign-in or if the stored token is gone
      const needsMint = !!(account || user) || !token.backendToken;
      if (needsMint && token.sub && token.email) {
        token.backendToken = await mintBackendToken(
          token.sub,
          token.email,
          token.name ?? undefined,
          token.role as string | undefined,
        );
      }

      return token;
    },

    async session({ session, token }) {
      // Expose the HS256 backend JWT so Axios can attach it to API requests
      if (token.backendToken) {
        session.accessToken = token.backendToken as string;
      }
      return session;
    },
  },
  events: {
    // Sync Google OAuth users into the User table on every sign-in.
    // Uses NextAuth's event system (fire-and-forget) so a DB failure
    // never blocks the login flow.
    async signIn({ user, account }) {
      if (account?.provider !== "google") return;
      if (!user.email || !account.providerAccountId) return;

      try {
        await fetch(`${BACKEND_URL}/auth/google-sync`, {
          method:  "POST",
          headers: {
            "Content-Type":      "application/json",
            "x-internal-secret": process.env.NEXTAUTH_SECRET!,
          },
          body: JSON.stringify({
            email:    user.email,
            googleId: account.providerAccountId,
            name:     user.name ?? undefined,
          }),
        });
      } catch {
        // Silently swallow — a DB sync failure must not block sign-in
      }
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
