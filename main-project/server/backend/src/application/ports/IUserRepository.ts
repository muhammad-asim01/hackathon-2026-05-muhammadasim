import type { UserRole } from "@prisma/client";

// ─── Domain record types ──────────────────────────────────────────────────────

/** Full user record including password hash — only used internally. */
export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string | null;   // null for Google / OAuth users
  readonly name: string | null;
  readonly role: UserRole;
  readonly provider: string;              // "email" | "google"
  readonly googleId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Safe public projection — password hash stripped. */
export interface PublicUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: UserRole;
  readonly provider: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ─── Port interface ───────────────────────────────────────────────────────────

export interface IUserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(data: {
    email: string;
    passwordHash: string;
    name?: string;
    role?: UserRole;
  }): Promise<PublicUser>;
  existsByEmail(email: string): Promise<boolean>;
  /** Create or update a Google OAuth user by their Google account ID. */
  upsertGoogleUser(data: {
    email: string;
    name?: string | undefined;
    googleId: string;
  }): Promise<PublicUser>;
}
