import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq, like, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import mysql from "mysql2/promise";
import { db } from "../../src/db";
import {
  idempotencyKeys,
  products,
  stockAdjustments,
  users,
} from "../../src/db/schema";
import {
  stockAdjustmentsModule,
  stockAdjustmentsService,
} from "../../src/modules/stock-adjustments";
import { AppError } from "../../src/shared/errors/app-error";
import { authPlugin } from "../../src/shared/middleware/auth";

// @test:FR-STK-01
// @test:FR-STK-02
describe("Stock Adjustments Module", () => {
  let testPool: mysql.Pool | undefined;

  const app = new Elysia()
    .error({ AppError })
    .onError(({ code, error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }

      if (code === "VALIDATION") {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request payload",
          },
        };
      }
    })
    .use(authPlugin)
    .use(stockAdjustmentsModule);

  const testPrefix = `test_stock_${Date.now()}`;
  const testAdminUser = {
    id: crypto.randomUUID(),
    username: `${testPrefix}_admin`,
    passwordHash: "dummyhash",
    role: "admin" as const,
  };
  const testStaffUser = {
    id: crypto.randomUUID(),
    username: `${testPrefix}_staff`,
    passwordHash: "dummyhash",
    role: "staff" as const,
  };

  let adminToken = "";
  let staffToken = "";

  const signToken = async (user: {
    id: string;
    username: string;
    role: "admin" | "staff";
  }) => {
    return (
      app as unknown as {
        decorator: {
          jwt: { sign: (p: Record<string, unknown>) => Promise<string> };
        };
      }
    ).decorator.jwt.sign(user);
  };

  const cleanup = async () => {
    await db
      .delete(stockAdjustments)
      .where(
        sql`${stockAdjustments.createdBy} IN (${testAdminUser.id}, ${testStaffUser.id})`,
      );
    await db
      .delete(idempotencyKeys)
      .where(like(idempotencyKeys.key, `${testPrefix}%`));
    await db.delete(products).where(like(products.sku, `${testPrefix}%`));
    await db.delete(users).where(eq(users.id, testAdminUser.id));
    await db.delete(users).where(eq(users.id, testStaffUser.id));
  };

  beforeAll(async () => {
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      testPool = mysql.createPool(
        process.env.DATABASE_URL ||
          "mysql://inventory:inventory123@127.0.0.1:3306/inventory_tracker",
      );
      (
        db as unknown as {
          session: { client: unknown };
          $client: unknown;
        }
      ).session.client = testPool;
      (
        db as unknown as {
          session: { client: unknown };
          $client: unknown;
        }
      ).$client = testPool;
    }

    await cleanup();
    await db.insert(users).values([testAdminUser, testStaffUser]);
    adminToken = await signToken(testAdminUser);
    staffToken = await signToken(testStaffUser);
  });

  afterAll(async () => {
    await cleanup();
    if (testPool) {
      await testPool.end();
    }
  });

  describe("POST /stock/adjust", () => {
    let testProduct: { id: string; sku: string; quantity: number };

    beforeAll(async () => {
      const prodId = crypto.randomUUID();
      const sku = `${testPrefix}_ITEM_1`;
      await db.insert(products).values({
        id: prodId,
        sku,
        name: "Test Adjustment Product",
        price: 25.0,
        quantity: 20,
        lowStockThreshold: 5,
        categoryId: "cat-default-0000-0000-000000000001",
        supplierId: "sup-default-0000-0000-000000000001",
        version: 1,
      });
      testProduct = { id: prodId, sku, quantity: 20 };
    });

    it("increases quantity on type IN and logs audit record", async () => {
      const idempKey = `${testPrefix}_key_in_1`;
      const res = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
            "Idempotency-Key": idempKey,
          },
          body: JSON.stringify({
            productId: testProduct.id,
            type: "IN",
            quantity: 10,
            reason: "Initial warehouse shipment",
          }),
        }),
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { id: string; productId: string; quantity: number; type: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.productId).toBe(testProduct.id);
      expect(json.data.type).toBe("IN");
      expect(json.data.quantity).toBe(10);

      // Verify product state
      const [updatedProd] = await db
        .select()
        .from(products)
        .where(eq(products.id, testProduct.id))
        .limit(1);
      expect(updatedProd?.quantity).toBe(30);
      expect(updatedProd?.version).toBe(2);

      // Verify audit log
      const [auditLog] = await db
        .select()
        .from(stockAdjustments)
        .where(eq(stockAdjustments.id, json.data.id))
        .limit(1);
      expect(auditLog).toBeDefined();
      expect(auditLog?.productId).toBe(testProduct.id);
      expect(auditLog?.type).toBe("IN");
      expect(auditLog?.quantity).toBe(10);
      expect(auditLog?.createdBy).toBe(testAdminUser.id);
    });

    it("allows staff to adjust stock", async () => {
      const idempKey = `${testPrefix}_key_staff_1`;
      const res = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${staffToken}`,
            "Idempotency-Key": idempKey,
          },
          body: JSON.stringify({
            productId: testProduct.id,
            type: "IN",
            quantity: 5,
            reason: "Staff restocked shelf",
          }),
        }),
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { createdBy: string; quantity: number };
      };
      expect(json.success).toBe(true);
      expect(json.data.createdBy).toBe(testStaffUser.id);
    });

    it("decreases quantity on type OUT and logs audit record", async () => {
      const idempKey = `${testPrefix}_key_out_1`;
      const res = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
            "Idempotency-Key": idempKey,
          },
          body: JSON.stringify({
            productId: testProduct.id,
            type: "OUT",
            quantity: 8,
            reason: "Customer purchase order fulfilled",
          }),
        }),
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { id: string; quantity: number; type: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.type).toBe("OUT");
      expect(json.data.quantity).toBe(8);

      const [updatedProd] = await db
        .select()
        .from(products)
        .where(eq(products.id, testProduct.id))
        .limit(1);
      // Started with 20 + 10 + 5 - 8 = 27
      expect(updatedProd?.quantity).toBe(27);
    });

    it("returns 422 BUSINESS_RULE_VIOLATION when OUT exceeds available stock", async () => {
      const idempKey = `${testPrefix}_key_out_excess`;
      const res = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
            "Idempotency-Key": idempKey,
          },
          body: JSON.stringify({
            productId: testProduct.id,
            type: "OUT",
            quantity: 99999,
            reason: "Excessive withdrawal request",
          }),
        }),
      );

      expect(res.status).toBe(422);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("BUSINESS_RULE_VIOLATION");

      // Verify product quantity was NOT mutated
      const [prod] = await db
        .select()
        .from(products)
        .where(eq(products.id, testProduct.id))
        .limit(1);
      expect(prod?.quantity).toBe(27);
    });

    it("returns 404 NOT_FOUND for non-existent product ID", async () => {
      const idempKey = `${testPrefix}_key_404`;
      const res = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
            "Idempotency-Key": idempKey,
          },
          body: JSON.stringify({
            productId: crypto.randomUUID(),
            type: "IN",
            quantity: 5,
            reason: "Non-existent product test",
          }),
        }),
      );

      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("rejects reason with length less than 5 characters with 400", async () => {
      const idempKey = `${testPrefix}_key_short_reason`;
      const res = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
            "Idempotency-Key": idempKey,
          },
          body: JSON.stringify({
            productId: testProduct.id,
            type: "IN",
            quantity: 5,
            reason: "four",
          }),
        }),
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects missing Idempotency-Key header with 400", async () => {
      const res = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            productId: testProduct.id,
            type: "IN",
            quantity: 5,
            reason: "Valid reason for adjustment",
          }),
        }),
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("replays exact same request with same Idempotency-Key returning cached response without duplicate stock mutation", async () => {
      const idempKey = `${testPrefix}_key_replay_same`;
      const payload = {
        productId: testProduct.id,
        type: "IN" as const,
        quantity: 12,
        reason: "Valid idempotency replay test",
      };

      // Get quantity before
      const [beforeProd] = await db
        .select()
        .from(products)
        .where(eq(products.id, testProduct.id))
        .limit(1);
      const initialQty = beforeProd?.quantity ?? 0;

      // First call
      const res1 = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
            "Idempotency-Key": idempKey,
          },
          body: JSON.stringify(payload),
        }),
      );
      expect(res1.status).toBe(200);
      const json1 = await res1.json();

      // Quantity should increase by 12
      const [afterProd1] = await db
        .select()
        .from(products)
        .where(eq(products.id, testProduct.id))
        .limit(1);
      expect(afterProd1?.quantity).toBe(initialQty + 12);

      // Count adjustments before replay
      const adjustments1 = await db
        .select()
        .from(stockAdjustments)
        .where(eq(stockAdjustments.productId, testProduct.id));

      // Replay identical request
      const res2 = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
            "Idempotency-Key": idempKey,
          },
          body: JSON.stringify(payload),
        }),
      );
      expect(res2.status).toBe(200);
      const json2 = await res2.json();

      // Cached response payload matches
      expect(json2).toEqual(json1);

      // Product quantity MUST NOT be mutated again
      const [afterProd2] = await db
        .select()
        .from(products)
        .where(eq(products.id, testProduct.id))
        .limit(1);
      expect(afterProd2?.quantity).toBe(initialQty + 12);

      // Audit log count must remain identical
      const adjustments2 = await db
        .select()
        .from(stockAdjustments)
        .where(eq(stockAdjustments.productId, testProduct.id));
      expect(adjustments2.length).toBe(adjustments1.length);
    });

    it("rejects same Idempotency-Key with different payload with 409 Conflict", async () => {
      const idempKey = `${testPrefix}_key_replay_conflict`;
      const originalPayload = {
        productId: testProduct.id,
        type: "IN" as const,
        quantity: 5,
        reason: "Original request payload",
      };

      const res1 = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
            "Idempotency-Key": idempKey,
          },
          body: JSON.stringify(originalPayload),
        }),
      );
      expect(res1.status).toBe(200);

      // Second request with DIFFERENT payload
      const alteredPayload = {
        productId: testProduct.id,
        type: "IN" as const,
        quantity: 99,
        reason: "Altered request payload with same key",
      };

      const res2 = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
            "Idempotency-Key": idempKey,
          },
          body: JSON.stringify(alteredPayload),
        }),
      );

      expect(res2.status).toBe(409);
      const json2 = (await res2.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json2.success).toBe(false);
      expect(json2.error.code).toBe("CONFLICT");
    });

    it("rejects concurrent / outdated version update with 409 Conflict (optimistic locking)", async () => {
      const idempKey = `${testPrefix}_key_optimistic_conflict`;
      const payload = {
        productId: testProduct.id,
        type: "IN" as const,
        quantity: 5,
        reason: "Optimistic locking test payload",
      };

      // Service call with onBeforeUpdate simulating concurrent modification
      await expect(
        stockAdjustmentsService.adjust(
          testAdminUser,
          payload,
          idempKey,
          "/stock/adjust",
          {
            onBeforeUpdate: async () => {
              // Simulate another transaction updating the version behind our back
              await db
                .update(products)
                .set({ version: sql`${products.version} + 1` })
                .where(eq(products.id, testProduct.id));
            },
          },
        ),
      ).rejects.toThrow(AppError);
    });

    it("rejects unauthenticated request with 401 Unauthorized", async () => {
      const res = await app.handle(
        new Request("http://localhost/stock/adjust", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `${testPrefix}_no_auth`,
          },
          body: JSON.stringify({
            productId: testProduct.id,
            type: "IN",
            quantity: 5,
            reason: "No auth header test",
          }),
        }),
      );

      expect(res.status).toBe(401);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /stock/history/:productId", () => {
    let historyProduct: { id: string };

    beforeAll(async () => {
      const prodId = crypto.randomUUID();
      await db.insert(products).values({
        id: prodId,
        sku: `${testPrefix}_HIST_PROD`,
        name: "History Product Test",
        price: 15.0,
        quantity: 100,
        lowStockThreshold: 10,
        categoryId: "cat-default-0000-0000-000000000001",
        supplierId: "sup-default-0000-0000-000000000001",
        version: 1,
      });
      historyProduct = { id: prodId };

      for (let i = 1; i <= 3; i++) {
        await db.insert(stockAdjustments).values({
          id: crypto.randomUUID(),
          productId: prodId,
          type: i % 2 === 0 ? "OUT" : "IN",
          quantity: i * 5,
          reason: `Seeded history adjustment ${i}`,
          createdBy: testAdminUser.id,
          createdAt: new Date(Date.now() - (4 - i) * 10000),
        });
      }
    });

    it("returns paginated stock history ordered by createdAt DESC", async () => {
      const res = await app.handle(
        new Request(
          `http://localhost/stock/history/${historyProduct.id}?page=1&limit=2`,
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          },
        ),
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: Array<{ id: string; productId: string; reason: string }>;
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };

      expect(json.success).toBe(true);
      expect(json.data.length).toBe(2);
      expect(json.meta.page).toBe(1);
      expect(json.meta.limit).toBe(2);
      expect(json.meta.total).toBe(3);
      expect(json.meta.totalPages).toBe(2);

      // Most recent adjustment first (seeded adjustment 3)
      expect(json.data[0]?.reason).toBe("Seeded history adjustment 3");
    });

    it("allows staff to access stock history", async () => {
      const res = await app.handle(
        new Request(`http://localhost/stock/history/${historyProduct.id}`, {
          headers: {
            Authorization: `Bearer ${staffToken}`,
          },
        }),
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: unknown[];
      };
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(3);
    });

    it("returns 404 NOT_FOUND when product does not exist", async () => {
      const nonExistentId = crypto.randomUUID();
      const res = await app.handle(
        new Request(`http://localhost/stock/history/${nonExistentId}`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }),
      );

      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("rejects unauthenticated request with 401 Unauthorized", async () => {
      const res = await app.handle(
        new Request(`http://localhost/stock/history/${historyProduct.id}`),
      );

      expect(res.status).toBe(401);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });
  });
});
