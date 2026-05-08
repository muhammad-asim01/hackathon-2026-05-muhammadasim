/**
 * JWT authentication middleware.
 *
 * Expects: Authorization: Bearer <token>
 * Verifies the token against NEXTAUTH_SECRET (shared with the frontend).
 * Attaches the decoded session payload to req.user on success.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTE — NextAuth v5 token format:
 *   NextAuth v5 uses JWE (JSON Web Encryption) tokens by default, encrypted
 *   with A256CBC-HS512. The `jsonwebtoken` library only handles JWS (signed)
 *   tokens. For full NextAuth v5 JWE support, add the `jose` package:
 *
 *     npm install jose
 *
 *   Then replace the jwt.verify call with:
 *     import { jwtDecrypt } from "jose";
 *     const secret = new TextEncoder().encode(env.NEXTAUTH_SECRET);
 *     const { payload } = await jwtDecrypt(token, secret);
 *
 *   Alternatively, configure NextAuth to emit HS256 JWS tokens by providing
 *   custom encode/decode functions in the NextAuth config (auth.ts on the
 *   frontend). Either approach works — decide before connecting the frontend.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";
import { UnauthorizedError } from "@/domain/errors";

// ─── Request augmentation ─────────────────────────────────────────────────────

export interface AuthenticatedUser {
  readonly sub: string;
  readonly email: string;
  readonly name?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface JwtPayload {
  sub?: string;
  email?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

function extractBearer(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function decodeToken(token: string): AuthenticatedUser {
  const raw = jwt.verify(token, env.NEXTAUTH_SECRET) as JwtPayload;

  if (!raw.sub || !raw.email) {
    throw new UnauthorizedError("Token payload missing required fields");
  }

  // Spread name conditionally — exactOptionalPropertyTypes requires the key
  // to be absent rather than set to undefined
  return {
    sub: raw.sub,
    email: raw.email,
    ...(raw.name !== undefined && { name: raw.name }),
  };
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Protect a route — throws UnauthorizedError (→ 401) if token is absent or
 * invalid. Call next() only when a valid session is confirmed.
 *
 * Usage:
 *   router.get("/protected", requireAuth, myHandler);
 *
 * In route handlers after this middleware, req.user is guaranteed non-null.
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = extractBearer(req.headers.authorization);

  if (!token) {
    next(new UnauthorizedError("Missing or malformed Authorization header"));
    return;
  }

  // Dev QA bypass — never reaches production (NODE_ENV guard via validated env)
  if (env.NODE_ENV === "development" && token === "dev-qa-bypass") {
    req.user = { sub: "dev", email: "dev@sift.ai.dev", name: "Dev Admin" };
    next();
    return;
  }

  try {
    req.user = decodeToken(token);
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
    } else {
      // jwt.verify throws JsonWebTokenError | TokenExpiredError | NotBeforeError
      next(new UnauthorizedError("Invalid or expired token"));
    }
  }
}

/**
 * Optional auth — resolves req.user if a valid token is present but does NOT
 * block the request if the header is absent. Useful for public endpoints that
 * show more data when authenticated.
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = extractBearer(req.headers.authorization);

  if (!token) {
    next();
    return;
  }

  try {
    req.user = decodeToken(token);
  } catch {
    // Silently ignore bad tokens on optional-auth routes
  }

  next();
}
