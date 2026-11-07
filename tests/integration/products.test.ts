import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq, like, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import mysql from "mysql2/promise";
import { db } from "../../src/db";
import { products, stockAdjustments, users } from "../../src/db/schema";
import { productsModule } from "../../src/modules/products";
import { AppError } from "../../src/shared/errors/app-error";
import { authPlugin } from "../../src/shared/middleware/auth";

// @test:FR-PROD-01
// @test:FR-PROD-02
// @test:FR-PROD-03
// @test:FR-PROD-04
describe("Products Module", () => {
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
    .use(productsModule);

  const testPrefix = `test_prod_${Date.now()}`;
  const defaultCategoryId = "cat-default-0000-0000-000000000001";
  const defaultSupplierId = "sup-default-0000-0000-000000000001";
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
      .where(eq(stockAdjustments.createdBy, testAdminUser.id));
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

  describe("POST /products", () => {
    it("allows admin to create a product", async () => {
      const payload = {
        sku: `${testPrefix}_SKU1`,
        name: "Test Widget Alpha",
        price: 29.99,
        quantity: 50,
        lowStockThreshold: 10,
        categoryId: defaultCategoryId,
        supplierId: defaultSupplierId,
      };

      const res = await app.handle(
        new Request("http://localhost/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(payload),
        }),
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        success: boolean;
        data: {
          id: string;
          sku: string;
          name: string;
          price: number;
          quantity: number;
          lowStockThreshold: number;
          version: number;
        };
      };

      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.sku).toBe(payload.sku);
      expect(body.data.name).toBe(payload.name);
      expect(body.data.price).toBe(payload.price);
      expect(body.data.quantity).toBe(payload.quantity);
      expect(body.data.lowStockThreshold).toBe(payload.lowStockThreshold);
      expect(body.data.version).toBe(1);

      // Verify in DB
      const [dbProd] = await db
        .select()
        .from(products)
        .where(eq(products.id, body.data.id))
        .limit(1);

      expect(dbProd).toBeDefined();
      expect(dbProd.sku).toBe(payload.sku);
    });

    it("rejects non-existent category or supplier with 404 Not Found", async () => {
      const res = await app.handle(
        new Request("http://localhost/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            sku: `${testPrefix}_SKU_BAD_CAT`,
            name: "Bad Cat Item",
            price: 10.0,
            categoryId: "non-existent-cat-uuid",
            supplierId: defaultSupplierId,
          }),
        }),
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("rejects duplicate SKU with 409 Conflict", async () => {
      const payload = {
        sku: `${testPrefix}_SKU1`,
        name: "Test Widget Duplicate",
        price: 19.99,
        quantity: 10,
        lowStockThreshold: 5,
        categoryId: defaultCategoryId,
        supplierId: defaultSupplierId,
      };

      const res = await app.handle(
        new Request("http://localhost/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(payload),
        }),
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CONFLICT");
    });

    it("rejects creation by staff with 403 Forbidden", async () => {
      const res = await app.handle(
        new Request("http://localhost/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${staffToken}`,
          },
          body: JSON.stringify({
            sku: `${testPrefix}_SKU_STAFF`,
            name: "Staff Created Widget",
            price: 9.99,
            quantity: 5,
            lowStockThreshold: 2,
            categoryId: defaultCategoryId,
            supplierId: defaultSupplierId,
          }),
        }),
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("rejects unauthenticated request with 401 Unauthorized", async () => {
      const res = await app.handle(
        new Request("http://localhost/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sku: `${testPrefix}_SKU_NOAUTH`,
            name: "No Auth Widget",
            price: 9.99,
            categoryId: defaultCategoryId,
            supplierId: defaultSupplierId,
          }),
        }),
      );

      expect(res.status).toBe(401);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /products", () => {
    const createdIds: string[] = [];

    beforeAll(async () => {
      // Seed a few products for search and pagination tests
      const seedData = [
        {
          sku: `${testPrefix}_PAG_A`,
          name: "Hammer Heavy Duty",
          price: 15.5,
          quantity: 20,
          lowStockThreshold: 5,
          categoryId: defaultCategoryId,
          supplierId: defaultSupplierId,
        },
        {
          sku: `${testPrefix}_PAG_B`,
          name: "Screwdriver Phillips",
          price: 8.0,
          quantity: 4,
          lowStockThreshold: 5,
          categoryId: defaultCategoryId,
          supplierId: defaultSupplierId,
        },
        {
          sku: `${testPrefix}_PAG_C`,
          name: "Wrench Adjustable",
          price: 12.0,
          quantity: 2,
          lowStockThreshold: 10,
          categoryId: defaultCategoryId,
          supplierId: defaultSupplierId,
        },
        {
          sku: `${testPrefix}_PAG_D`,
          name: "Hammer Small Precision",
          price: 14.0,
          quantity: 15,
          lowStockThreshold: 2,
          categoryId: defaultCategoryId,
          supplierId: defaultSupplierId,
        },
      ];

      for (const item of seedData) {
        const res = await app.handle(
          new Request("http://localhost/products", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(item),
          }),
        );
        const data = (await res.json()) as { data: { id: string } };
        createdIds.push(data.data.id);
      }
    });

    it("allows staff to list products with pagination meta", async () => {
      const res = await app.handle(
        new Request("http://localhost/products?page=1&limit=2", {
          method: "GET",
          headers: { Authorization: `Bearer ${staffToken}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: Array<{ id: string; sku: string }>;
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };

      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(2);
      expect(body.meta.total).toBeGreaterThanOrEqual(4);
      expect(body.meta.totalPages).toBe(Math.ceil(body.meta.total / 2));
    });

    it("filters products by partial match on name (case-insensitive)", async () => {
      const res = await app.handle(
        new Request(`http://localhost/products?search=hammer&limit=10`, {
          method: "GET",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: Array<{ name: string; sku: string }>;
      };

      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      for (const item of body.data) {
        const matches =
          item.name.toLowerCase().includes("hammer") ||
          item.sku.toLowerCase().includes("hammer");
        expect(matches).toBe(true);
      }
    });

    it("filters products by partial match on sku (case-insensitive)", async () => {
      const res = await app.handle(
        new Request(
          `http://localhost/products?search=${testPrefix.toLowerCase()}_pag_b`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${adminToken}` },
          },
        ),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: Array<{ sku: string; name: string }>;
      };

      expect(body.success).toBe(true);
      expect(body.data.length).toBe(1);
      expect(body.data[0].sku).toBe(`${testPrefix}_PAG_B`);
    });
  });

  describe("GET /products/low-stock", () => {
    it("returns only products where quantity <= lowStockThreshold", async () => {
      const res = await app.handle(
        new Request("http://localhost/products/low-stock?page=1&limit=50", {
          method: "GET",
          headers: { Authorization: `Bearer ${staffToken}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: Array<{
          id: string;
          name: string;
          quantity: number;
          lowStockThreshold: number;
        }>;
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };

      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toBeDefined();
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(50);
      expect(body.meta.totalPages).toBeDefined();

      for (const prod of body.data) {
        expect(prod.quantity).toBeLessThanOrEqual(prod.lowStockThreshold);
      }
    });
  });

  describe("GET /products/:id", () => {
    let existingProductId = "";

    beforeAll(async () => {
      const [prod] = await db
        .select()
        .from(products)
        .where(like(products.sku, `${testPrefix}%`))
        .limit(1);
      existingProductId = prod.id;
    });

    it("returns product details by ID for staff", async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${existingProductId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${staffToken}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { id: string; sku: string; name: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(existingProductId);
    });

    it("returns 404 for non-existent product ID", async () => {
      const nonExistentId = crypto.randomUUID();
      const res = await app.handle(
        new Request(`http://localhost/products/${nonExistentId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PUT /products/:id", () => {
    let updateProductId = "";

    beforeAll(async () => {
      const createRes = await app.handle(
        new Request("http://localhost/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            sku: `${testPrefix}_FOR_UPDATE`,
            name: "Original Name",
            price: 10.0,
            quantity: 20,
            lowStockThreshold: 5,
            categoryId: defaultCategoryId,
            supplierId: defaultSupplierId,
          }),
        }),
      );
      const created = (await createRes.json()) as { data: { id: string } };
      updateProductId = created.data.id;
    });

    it("allows admin to update product fields", async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${updateProductId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            name: "Updated Name",
            price: 15.5,
            lowStockThreshold: 8,
          }),
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: {
          id: string;
          name: string;
          price: number;
          lowStockThreshold: number;
        };
      };

      expect(body.success).toBe(true);
      expect(body.data.id).toBe(updateProductId);
      expect(body.data.name).toBe("Updated Name");
      expect(body.data.price).toBe(15.5);
      expect(body.data.lowStockThreshold).toBe(8);
    });

    it("rejects update with conflicting SKU with 409 Conflict", async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${updateProductId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ sku: `${testPrefix}_SKU1` }),
        }),
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CONFLICT");
    });

    it("rejects update by staff with 403 Forbidden", async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${updateProductId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${staffToken}`,
          },
          body: JSON.stringify({ name: "Forbidden Update" }),
        }),
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("rejects update with non-existent product ID with 404", async () => {
      const nonExistentId = crypto.randomUUID();
      const res = await app.handle(
        new Request(`http://localhost/products/${nonExistentId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ name: "Non-existent" }),
        }),
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("DELETE /products/:id", () => {
    let deletableProductId = "";
    let productWithAdjustmentId = "";

    beforeAll(async () => {
      const res1 = await app.handle(
        new Request("http://localhost/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            sku: `${testPrefix}_DELETABLE`,
            name: "Deletable Item",
            price: 5.0,
            quantity: 10,
            lowStockThreshold: 2,
            categoryId: defaultCategoryId,
            supplierId: defaultSupplierId,
          }),
        }),
      );
      const body1 = (await res1.json()) as { data: { id: string } };
      deletableProductId = body1.data.id;

      const res2 = await app.handle(
        new Request("http://localhost/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            sku: `${testPrefix}_RESTRICTED`,
            name: "Restricted Delete Item",
            price: 25.0,
            quantity: 100,
            lowStockThreshold: 10,
            categoryId: defaultCategoryId,
            supplierId: defaultSupplierId,
          }),
        }),
      );
      const body2 = (await res2.json()) as { data: { id: string } };
      productWithAdjustmentId = body2.data.id;

      await db.insert(stockAdjustments).values({
        id: crypto.randomUUID(),
        productId: productWithAdjustmentId,
        type: "IN",
        quantity: 100,
        reason: "Initial test inventory load",
        createdBy: testAdminUser.id,
      });
    });

    it("rejects delete by staff with 403 Forbidden", async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${deletableProductId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${staffToken}` },
        }),
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("returns 409 Conflict when deleting a product with existing stock adjustments", async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${productWithAdjustmentId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CONFLICT");
      expect(body.error.message).toContain(
        "Product cannot be deleted because it has associated stock adjustment records",
      );
    });

    it("allows admin to delete an unreferenced product", async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${deletableProductId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
      };
      expect(body.success).toBe(true);

      // Verify product is gone
      const [deleted] = await db
        .select()
        .from(products)
        .where(eq(products.id, deletableProductId))
        .limit(1);
      expect(deleted).toBeUndefined();
    });

    it("returns 404 for non-existent product ID", async () => {
      const nonExistentId = crypto.randomUUID();
      const res = await app.handle(
        new Request(`http://localhost/products/${nonExistentId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
