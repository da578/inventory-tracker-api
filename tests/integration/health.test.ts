import { describe, expect, it, spyOn } from "bun:test";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "../../src/db";
import { healthModule } from "../../src/modules/health";

// @test:FR-HLTH-01
describe("Health Module", () => {
  const app = new Elysia().use(healthModule);

  it("returns 200 with status ok and connected database", async () => {
    let executeSpy: ReturnType<typeof spyOn> | undefined;
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      // Handle connection pool closure by prior test suites
      executeSpy = spyOn(db, "execute").mockResolvedValue([
        [{ 1: 1 }],
      ] as never);
    }

    try {
      const res = await app.handle(new Request("http://localhost/health"));

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: {
          status: string;
          database: string;
          uptime: number;
          timestamp: string;
        };
      };

      expect(body.success).toBe(true);
      expect(body.data.status).toBe("ok");
      expect(body.data.database).toBe("connected");
      expect(typeof body.data.uptime).toBe("number");
      expect(body.data.uptime).toBeGreaterThanOrEqual(0);
      expect(new Date(body.data.timestamp).toISOString()).toBe(
        body.data.timestamp,
      );
    } finally {
      executeSpy?.mockRestore();
    }
  });

  it("returns 503 when database query fails", async () => {
    const executeSpy = spyOn(db, "execute").mockImplementationOnce(() => {
      throw new Error("Connection failed");
    });

    try {
      const res = await app.handle(new Request("http://localhost/health"));

      expect(res.status).toBe(503);
      const body = (await res.json()) as {
        success: boolean;
        error: {
          code: string;
          message: string;
        };
      };

      expect(body.success).toBe(false);
      expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(body.error.message).toBe("Database connection failed");
    } finally {
      executeSpy.mockRestore();
    }
  });
});
