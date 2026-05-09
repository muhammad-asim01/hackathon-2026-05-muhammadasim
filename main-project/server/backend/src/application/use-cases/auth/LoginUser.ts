import bcrypt from "bcryptjs";
import type { IUserRepository, PublicUser } from "@/application/ports/IUserRepository";
import { UnauthorizedError } from "@/domain/errors";

// Dummy hash used when user is not found — prevents timing attacks by ensuring
// bcrypt.compare() always runs, regardless of whether the email exists.
const DUMMY_HASH = "$2b$12$invalidhashfortimingprotectionXXXXXXXXXXXXXX";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface LoginUserInput {
  email: string;
  password: string;
}

// ─── Use-case ─────────────────────────────────────────────────────────────────

export class LoginUser {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(input: LoginUserInput): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    const { password } = input;

    // Always fetch — null means user doesn't exist
    const user = await this.userRepo.findByEmail(email);

    // Always call bcrypt.compare to prevent timing-based email enumeration.
    // Google-only users have no passwordHash — use dummy so timing is identical.
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Strip the password hash before returning
    const { passwordHash: _hash, ...publicUser } = user;
    return publicUser;
  }
}
