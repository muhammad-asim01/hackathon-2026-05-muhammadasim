-- Make passwordHash nullable (Google users have no password)
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Add provider column (default "email" for existing rows)
ALTER TABLE "User" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'email';

-- Add googleId column (null for email/password users)
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;

-- Unique index for Google account lookups
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- Index for fast googleId lookups
CREATE INDEX "User_googleId_idx" ON "User"("googleId");
