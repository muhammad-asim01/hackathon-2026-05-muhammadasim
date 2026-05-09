import type { PrismaClient, UserRole } from "@prisma/client";
import type { IUserRepository, UserRecord, PublicUser } from "@/application/ports/IUserRepository";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPublicUser(user: {
  id: string;
  email: string;
  passwordHash: string | null;
  name: string | null;
  role: UserRole;
  provider: string;
  googleId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  // Strip passwordHash and googleId — never expose these externally
  const { passwordHash: _hash, googleId: _gid, ...rest } = user;
  return rest;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    name?: string;
    role?: UserRole;
  }): Promise<PublicUser> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        provider: "email",
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
      },
    });
    return toPublicUser(user);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  // ── Google OAuth upsert ────────────────────────────────────────────────────
  // Uses googleId as the stable lookup key. On first sign-in the row is
  // created; on subsequent sign-ins name / email is refreshed in case the
  // user updated their Google profile.

  async upsertGoogleUser(data: {
    email: string;
    name?: string;
    googleId: string;
  }): Promise<PublicUser> {
    const user = await this.prisma.user.upsert({
      where: { googleId: data.googleId },
      update: {
        email: data.email,
        ...(data.name !== undefined ? { name: data.name } : {}),
      },
      create: {
        email: data.email,
        passwordHash: null,
        provider: "google",
        googleId: data.googleId,
        role: "ADMIN",   // Google sign-in grants admin access
        ...(data.name !== undefined ? { name: data.name } : {}),
      },
    });
    return toPublicUser(user);
  }
}
