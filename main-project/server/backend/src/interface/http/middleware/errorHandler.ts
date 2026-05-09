/**
 * Centralised error-to-HTTP-status mapping middleware.
 *
 * Handles (in order):
 *  1. DomainError subclasses → mapped HTTP status + structured JSON body
 *  2. ZodError (from route-level validation) → 400 with field-level issues
 *  3. Everything else → 500 Internal Server Error
 *
 * Log boundary: errors are logged here (the catch boundary), not at throw site.
 */
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { DomainError } from "@/domain/errors";
import { logger } from "@/utils/logger";
import { Sentry } from "@/instrument";

// ─── Response shape ───────────────────────────────────────────────────────────

interface ErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    issues?: Array<{ path: string; message: string }>;
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// Four-argument signature is required — Express uses arity to detect error middleware
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // ── 1. Known domain errors ──────────────────────────────────────────────
  if (err instanceof DomainError) {
    // 5xx domain errors are unexpected — log at error level with full context
    if (err.httpStatus >= 500) {
      logger.error(
        { err, code: err.code, url: req.url, method: req.method },
        "Domain error (server-side)"
      );
      Sentry.captureException(err, { tags: { code: err.code }, extra: { url: req.url, method: req.method } });
    } else {
      logger.warn(
        { code: err.code, message: err.message, url: req.url },
        "Domain error (client-side)"
      );
    }

    const body: ErrorBody = {
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.retryable && { retryable: true }),
        ...(err.context !== undefined && process.env.NODE_ENV !== "production" && {
          context: err.context,
        }),
      },
    };

    res.status(err.httpStatus).json(body);
    return;
  }

  // ── 2. Zod validation errors (from route handlers) ──────────────────────
  if (err instanceof ZodError) {
    logger.warn(
      { issues: err.issues, url: req.url },
      "Request validation failed"
    );

    const body: ErrorBody = {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        issues: err.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };

    res.status(400).json(body);
    return;
  }

  // ── 3. Unhandled — should never reach here in a well-written codebase ───
  logger.error(
    { err, url: req.url, method: req.method },
    "Unhandled error reached errorHandler"
  );
  Sentry.captureException(err, { extra: { url: req.url, method: req.method } });

  res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  } satisfies ErrorBody);
}
