/**
 * Auth routes.
 *
 * POST /api/auth/register      — create a new email/password account
 * POST /api/auth/login         — validate credentials (called by NextAuth credentials provider)
 * POST /api/auth/google-sync   — upsert a Google OAuth user (server-to-server, internal secret)
 * GET  /api/auth/me            — return the current authenticated user
 */
import { Router } from "express";
import { z } from "zod";
import { env } from "@/config/env";
import { requireAuth } from "@/interface/http/middleware/auth";
import { UnauthorizedError, ValidationError } from "@/domain/errors";
import type { RegisterUser } from "@/application/use-cases/auth/RegisterUser";
import type { LoginUser }    from "@/application/use-cases/auth/LoginUser";
import type { SyncGoogleUser } from "@/application/use-cases/auth/SyncGoogleUser";

export const authRouter = Router();

// ─── Lazy injection (avoids circular import with container.ts) ────────────────

let registerUserUC: RegisterUser;
let loginUserUC:    LoginUser;
let syncGoogleUserUC: SyncGoogleUser;

export function registerAuthUseCases(
  register: RegisterUser,
  login: LoginUser,
  syncGoogle: SyncGoogleUser,
): void {
  registerUserUC    = register;
  loginUserUC       = login;
  syncGoogleUserUC  = syncGoogle;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name:     z.string().trim().optional(),
});

const loginSchema = z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const googleSyncSchema = z.object({
  email:    z.string().email("Invalid email address"),
  googleId: z.string().min(1, "googleId is required"),
  name:     z.string().optional(),
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────

authRouter.post("/register", async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request"));
    return;
  }

  try {
    const user = await registerUserUC.execute(parsed.data);
    res.status(201).json({ ok: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post("/login", async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request"));
    return;
  }

  try {
    const user = await loginUserUC.execute(parsed.data);
    res.json({ ok: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/google-sync ───────────────────────────────────────────────
// Server-to-server only — called from frontend auth.ts signIn callback.
// Protected by the shared NEXTAUTH_SECRET in the x-internal-secret header.

authRouter.post("/google-sync", async (req, res, next) => {
  // Validate internal shared secret — rejects all external callers
  const secret = req.headers["x-internal-secret"];
  if (!secret || secret !== env.NEXTAUTH_SECRET) {
    next(new UnauthorizedError("Forbidden"));
    return;
  }

  const parsed = googleSyncSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request"));
    return;
  }

  try {
    const user = await syncGoogleUserUC.execute(parsed.data);
    res.json({ ok: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, data: req.user });
});
