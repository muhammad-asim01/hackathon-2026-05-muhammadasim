import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: [
    /*
     * Match all (admin) routes under /dashboard and the /login page.
     * Exclude Next.js internals (_next/static, _next/image) and static files
     * so the auth middleware never runs on assets — keeps edge function fast.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
