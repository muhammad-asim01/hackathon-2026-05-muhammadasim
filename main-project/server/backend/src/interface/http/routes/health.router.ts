/**
 * GET /api/health
 *
 * Lightweight liveness + readiness probe.
 * Returns { ok: true, db: "up" } when the database connection is healthy.
 * Returns 503 with { ok: false, db: "down" } on database failure so load
 * balancers / container orchestrators (ECS health checks) can drain traffic.
 *
 * No auth required — this endpoint is intentionally public.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { container } from "@/config/container";
import { logger } from "@/utils/logger";

const router = Router();

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    // Cheapest possible DB round-trip — validates the connection pool is alive
    await container.prisma.$queryRaw`SELECT 1`;

    res.json({
      ok: true,
      db: "up",
      env: process.env.NODE_ENV ?? "unknown",
    });
  } catch (err) {
    logger.error({ err }, "Health check: database unreachable");

    res.status(503).json({
      ok: false,
      db: "down",
      error: "Database connection failed",
    });
  }
});

export { router as healthRouter };
