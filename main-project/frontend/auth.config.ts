import type { NextAuthConfig } from "next-auth";

/**
 * Lightweight auth config used exclusively in middleware (Edge Runtime).
 * No providers here — providers require Node.js APIs (crypto, etc.)
 * and would crash the Edge Runtime bundler.
 */
export const authConfig: NextAuthConfig = {
  secret: process.env.NEXTAUTH_SECRET!,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isDashboard = nextUrl.pathname.startsWith("/dashboard");

      if (isDashboard) {
        if (isLoggedIn) return true;
        // Not logged in → redirect to /login with callbackUrl
        const loginUrl = new URL("/login", nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
        return Response.redirect(loginUrl);
      }

      // Already logged in on /login → redirect to dashboard
      if (isLoggedIn && nextUrl.pathname === "/login") {
        return Response.redirect(new URL("/dashboard", nextUrl.origin));
      }

      return true;
    },
  },
  providers: [],
};
