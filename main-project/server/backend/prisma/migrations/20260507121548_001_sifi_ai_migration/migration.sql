-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('DISCOVERED', 'AUDITED', 'EMAIL_DRAFTED', 'PENDING_APPROVAL', 'APPROVED', 'EMAIL_SENT', 'REPLIED', 'COLD', 'SKIPPED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "EventLevel" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "EmailCadence" AS ENUM ('DAY_0', 'DAY_3');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "gmapsPlaceId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "contactEmail" TEXT,
    "googleRating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "digitalScore" INTEGER,
    "reviewSentiment" TEXT,
    "topIssue" TEXT,
    "reviewExcerpt" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'DISCOVERED',
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runId" TEXT NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "pageSpeedScore" INTEGER,
    "mobileScore" INTEGER,
    "loadTimeMs" INTEGER,
    "hasSSL" BOOLEAN NOT NULL DEFAULT false,
    "hasMobileMeta" BOOLEAN NOT NULL DEFAULT false,
    "hasMetaTags" BOOLEAN NOT NULL DEFAULT false,
    "hasCTA" BOOLEAN NOT NULL DEFAULT false,
    "reviewSummary" JSONB NOT NULL DEFAULT '{}',
    "rawFindings" JSONB NOT NULL DEFAULT '{}',
    "auditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "cadence" "EmailCadence" NOT NULL DEFAULT 'DAY_0',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "recipientEmail" TEXT,
    "approvedBy" TEXT,
    "sentAt" TIMESTAMP(3),
    "gmailMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "leadsFound" INTEGER NOT NULL DEFAULT 0,
    "leadsScored" INTEGER NOT NULL DEFAULT 0,
    "leadsDrafted" INTEGER NOT NULL DEFAULT 0,
    "leadsEmailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "level" "EventLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "dailyQuota" INTEGER NOT NULL DEFAULT 3,
    "scoreThreshold" INTEGER NOT NULL DEFAULT 75,
    "emailWordLimit" INTEGER NOT NULL DEFAULT 180,
    "targetNiches" TEXT[],
    "targetCities" TEXT[],
    "fromName" TEXT,
    "replyToEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Niche" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Niche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapsCache" (
    "placeId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapsCache_pkey" PRIMARY KEY ("placeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_publicId_key" ON "Lead"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_gmapsPlaceId_key" ON "Lead"("gmapsPlaceId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_digitalScore_idx" ON "Lead"("digitalScore");

-- CreateIndex
CREATE INDEX "Lead_niche_idx" ON "Lead"("niche");

-- CreateIndex
CREATE INDEX "Lead_city_idx" ON "Lead"("city");

-- CreateIndex
CREATE INDEX "Lead_discoveredAt_idx" ON "Lead"("discoveredAt");

-- CreateIndex
CREATE INDEX "Lead_status_digitalScore_niche_discoveredAt_idx" ON "Lead"("status", "digitalScore", "niche", "discoveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Audit_leadId_key" ON "Audit"("leadId");

-- CreateIndex
CREATE INDEX "Email_status_idx" ON "Email"("status");

-- CreateIndex
CREATE INDEX "Email_leadId_idx" ON "Email"("leadId");

-- CreateIndex
CREATE INDEX "Email_status_createdAt_idx" ON "Email"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PipelineRun_status_idx" ON "PipelineRun"("status");

-- CreateIndex
CREATE INDEX "PipelineRun_startedAt_idx" ON "PipelineRun"("startedAt");

-- CreateIndex
CREATE INDEX "RunEvent_runId_idx" ON "RunEvent"("runId");

-- CreateIndex
CREATE INDEX "RunEvent_runId_createdAt_idx" ON "RunEvent"("runId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Niche_slug_key" ON "Niche"("slug");

-- CreateIndex
CREATE INDEX "MapsCache_expiresAt_idx" ON "MapsCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunEvent" ADD CONSTRAINT "RunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
