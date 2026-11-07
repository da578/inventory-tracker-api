import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq, inArray, sql } from "drizzle-orm";
import mysql from "mysql2/promise";
import { db } from "../../src/db";
import { products, users } from "../../src/db/schema";
import { SEED_PRODUCTS, SEED_USERS, seed } from "../../src/db/seed";

describe("Database Seeder", () => {
  let testPool: mysql.Pool | undefined;

  const cleanup = async () => {
    const usernames = SEED_USERS.map((u) => u.username);
    const skus = SEED_PRODUCTS.map((p) => p.sku);

    await db.delete(users).where(inArray(users.username, usernames));
    await db.delete(products).where(inArray(products.sku, skus));
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
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.end();
    }
  });

  it("seeds admin and staff users with argon2id hashed passwords and correct roles", async () => {
    const result = await seed();
    expect(result.usersSeeded).toBe(2);
    expect(result.productsSeeded).toBe(3);

    // Verify admin user
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, "admin"))
      .limit(1);

    expect(adminUser).toBeDefined();
    expect(adminUser.role).toBe("admin");
    expect(adminUser.passwordHash.startsWith("$argon2id$")).toBe(true);

    const isAdminPasswordValid = await Bun.password.verify(
      "Admin123!",
      adminUser.passwordHash,
    );
    expect(isAdminPasswordValid).toBe(true);

    // Verify staff user
    const [staffUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, "staff"))
      .limit(1);

    expect(staffUser).toBeDefined();
    expect(staffUser.role).toBe("staff");
    expect(staffUser.passwordHash.startsWith("$argon2id$")).toBe(true);

    const isStaffPasswordValid = await Bun.password.verify(
      "Staff123!",
      staffUser.passwordHash,
    );
    expect(isStaffPasswordValid).toBe(true);
  });

  it("seeds initial inventory products with expected quantities and low stock thresholds", async () => {
    const [widget] = await db
      .select()
      .from(products)
      .where(eq(products.sku, "PROD-WIDGET-01"))
      .limit(1);

    expect(widget).toBeDefined();
    expect(widget.name).toBe("Industrial Widget A");
    expect(widget.price).toBe(29.99);
    expect(widget.quantity).toBe(100);
    expect(widget.lowStockThreshold).toBe(20);
    expect(widget.quantity > widget.lowStockThreshold).toBe(true);

    const [gadget] = await db
      .select()
      .from(products)
      .where(eq(products.sku, "PROD-GADGET-02"))
      .limit(1);

    expect(gadget).toBeDefined();
    expect(gadget.name).toBe("Standard Gadget B");
    expect(gadget.price).toBe(49.5);
    expect(gadget.quantity).toBe(15);
    expect(gadget.lowStockThreshold).toBe(20);
    expect(gadget.quantity <= gadget.lowStockThreshold).toBe(true);

    const [sensor] = await db
      .select()
      .from(products)
      .where(eq(products.sku, "PROD-SENSOR-03"))
      .limit(1);

    expect(sensor).toBeDefined();
    expect(sensor.name).toBe("Precision Sensor C");
    expect(sensor.price).toBe(12.75);
    expect(sensor.quantity).toBe(5);
    expect(sensor.lowStockThreshold).toBe(10);
    expect(sensor.quantity <= sensor.lowStockThreshold).toBe(true);
  });

  it("is idempotent and safely skips existing users and products on subsequent runs", async () => {
    const secondRun = await seed();
    expect(secondRun.usersSeeded).toBe(0);
    expect(secondRun.productsSeeded).toBe(0);

    const allSeededUsers = await db
      .select()
      .from(users)
      .where(
        inArray(
          users.username,
          SEED_USERS.map((u) => u.username),
        ),
      );
    expect(allSeededUsers.length).toBe(2);

    const allSeededProducts = await db
      .select()
      .from(products)
      .where(
        inArray(
          products.sku,
          SEED_PRODUCTS.map((p) => p.sku),
        ),
      );
    expect(allSeededProducts.length).toBe(3);
  });
});
