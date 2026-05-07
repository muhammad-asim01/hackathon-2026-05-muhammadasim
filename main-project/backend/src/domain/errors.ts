/**
 * Domain error hierarchy.
 *
 * Rules (from CLAUDE.md):
 *  - Use-cases throw only DomainError subclasses — never raw Error.
 *  - errorHandler middleware maps DomainError.code → HTTP status (centralised).
 *  - External API failures are wrapped in ExternalServiceError with retryable flag.
 *  - Log errors at the boundary where caught, not where thrown.
 */

// ─── Base ─────────────────────────────────────────────────────────────────────

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly retryable: boolean = false;

  constructor(
    message: string,
    public readonly context?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = this.constructor.name;
    // Ensure proper prototype chain in transpiled code
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── 4xx Client Errors ───────────────────────────────────────────────────────

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND" as const;
  readonly httpStatus = 404;
}

export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR" as const;
  readonly httpStatus = 400;
}

export class UnauthorizedError extends DomainError {
  readonly code = "UNAUTHORIZED" as const;
  readonly httpStatus = 401;
}

export class ForbiddenError extends DomainError {
  readonly code = "FORBIDDEN" as const;
  readonly httpStatus = 403;
}

export class ConflictError extends DomainError {
  readonly code = "CONFLICT" as const;
  readonly httpStatus = 409;
}

export class RateLimitError extends DomainError {
  readonly code = "RATE_LIMIT_EXCEEDED" as const;
  readonly httpStatus = 429;
  override readonly retryable = true;
}

// ─── 5xx Server / External Errors ────────────────────────────────────────────

/**
 * Wraps failures from external APIs (Google Maps, PageSpeed, Gmail, Sheets).
 * Set retryable=true for transient network/timeout errors,
 * retryable=false for authentication or quota errors.
 */
export class ExternalServiceError extends DomainError {
  readonly code = "EXTERNAL_SERVICE_ERROR" as const;
  readonly httpStatus = 502;
  override readonly retryable: boolean;

  constructor(
    message: string,
    retryable: boolean,
    context?: Readonly<Record<string, unknown>>
  ) {
    super(message, context);
    this.retryable = retryable;
  }
}

export class InternalError extends DomainError {
  readonly code = "INTERNAL_ERROR" as const;
  readonly httpStatus = 500;
}

// ─── Domain-specific Errors ───────────────────────────────────────────────────

export class LeadNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Lead not found: ${id}`, { id });
  }
}

export class RunNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Pipeline run not found: ${id}`, { id });
  }
}

export class DraftNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Email draft not found: ${id}`, { id });
  }
}

export class RunAlreadyActiveError extends ConflictError {
  constructor(niche: string, city: string) {
    super(`A pipeline run for ${niche} / ${city} is already active`, {
      niche,
      city,
    });
  }
}

export class DailyQuotaExceededError extends RateLimitError {
  constructor(api: string, limit: number) {
    super(`Daily quota exceeded for ${api} (limit: ${limit})`, { api, limit });
  }
}

// ─── Type guard ───────────────────────────────────────────────────────────────

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
