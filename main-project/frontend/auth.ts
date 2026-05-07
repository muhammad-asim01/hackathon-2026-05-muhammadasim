import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { SignJWT } from "jose";
import { authConfig } from "@/auth.config";

const devCredentials = process.env.NODE_ENV === "development"
  ? [Credentials({
      name: "Dev Login",
      credentials: { password: { label: "Dev password", type: "password" } },
      async authorize(creds) {
        if (creds?.password === "dev") {
          return { id: "dev", name: "Dev Admin", email: "dev@sift.ai.dev" };
        }
        return null;
      },
    })]
  : [];

// Creates a backend-verifiable HS256 JWT signed with NEXTAUTH_SECRET.
// The backend's jwt.verify(token, NEXTAUTH_SECRET) can decode this directly.
async function mintBackendToken(sub: string, email: string, name?: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  return new SignJWT({
    sub,
    email,
    ...(name !== undefined ? { name } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

const config: NextAuthConfig = {
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...devCredentials,
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, account, user }) {
      // Mint a fresh backend token on first sign-in (account / user present)
      // or if the stored token was lost (e.g. after secret rotation).
      const needsMint = !!(account || user) || !token.backendToken;

      if (needsMint && token.sub && token.email) {
        token.backendToken = await mintBackendToken(
          token.sub,
          token.email,
          // token.name is string | null | undefined — coerce null → undefined
          token.name ?? undefined,
        );
      }

      return token;
    },

    async session({ session, token }) {
      // Expose the HS256-signed backend JWT as the accessToken the Axios
      // interceptor attaches to every API request.
      if (token.backendToken) {
        session.accessToken = token.backendToken as string;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
