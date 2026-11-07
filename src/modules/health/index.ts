import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "../../db";

/**
 * Health check module for monitoring application and database connectivity.
 *
 * @remarks
 * Exposes the GET /health endpoint to verify MariaDB connectivity and return system uptime.
 *
 * @public
 */
// @impl:FR-HLTH-01
export const healthModule = new Elysia().get(
  "/health",
  async ({ set }) => {
    try {
      await db.execute(sql`SELECT 1`);
      return {
        success: true,
        data: {
          status: "ok",
          database: "connected",
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
      };
    } catch {
      set.status = 503;
      return {
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Database connection failed",
        },
      };
    }
  },
  {
    detail: {
      tags: ["Health"],
      summary: "Database connectivity and system health check",
    },
  },
);
