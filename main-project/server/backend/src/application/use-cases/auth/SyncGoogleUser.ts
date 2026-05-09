import type { IUserRepository, PublicUser } from "@/application/ports/IUserRepository";
import { ValidationError } from "@/domain/errors";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface SyncGoogleUserInput {
  email: string;
  googleId: string;
  name?: string | undefined;
}

// ─── Use-case ─────────────────────────────────────────────────────────────────

/**
 * Called server-to-server from the Next.js auth.ts signIn callback whenever
 * a user authenticates via Google OAuth. Creates the user row on first sign-in
 * and refreshes their name / email on subsequent sign-ins.
 */
export class SyncGoogleUser {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(input: SyncGoogleUserInput): Promise<PublicUser> {
    if (!input.email || !input.googleId) {
      throw new ValidationError("email and googleId are required");
    }

    return this.userRepo.upsertGoogleUser({
      email: input.email.trim().toLowerCase(),
      googleId: input.googleId,
      ...(input.name !== undefined ? { name: input.name.trim() || undefined } : {}),
    });
  }
}
