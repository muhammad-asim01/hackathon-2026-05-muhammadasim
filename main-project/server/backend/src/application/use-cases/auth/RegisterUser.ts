import bcrypt from "bcryptjs";
import type { IUserRepository, PublicUser } from "@/application/ports/IUserRepository";
import { ConflictError, ValidationError } from "@/domain/errors";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface RegisterUserInput {
  email: string;
  password: string;
  name?: string | undefined;
}

// ─── Use-case ─────────────────────────────────────────────────────────────────

export class RegisterUser {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(input: RegisterUserInput): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    const { password } = input;
    const name = input.name?.trim() || undefined;

    // ── Validation ───────────────────────────────────────────────────────────
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError("A valid email address is required");
    }
    if (!password || password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }

    // ── Uniqueness check ─────────────────────────────────────────────────────
    const exists = await this.userRepo.existsByEmail(email);
    if (exists) {
      throw new ConflictError("An account with this email already exists");
    }

    // ── Hash + persist ───────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12);

    return this.userRepo.create({
      email,
      passwordHash,
      ...(name !== undefined ? { name } : {}),
    });
  }
}
