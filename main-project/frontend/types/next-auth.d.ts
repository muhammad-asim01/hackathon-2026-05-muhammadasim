import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    /** HS256 JWT signed with NEXTAUTH_SECRET — forwarded to the backend as Bearer token. */
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Backend-verifiable HS256 JWT. Persisted in the encrypted NextAuth session cookie. */
    backendToken?: string;
  }
}
