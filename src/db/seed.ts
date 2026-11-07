import { eq } from "drizzle-orm";
import { db as defaultDb, poolConnection } from "./index";
import { categories, products, suppliers, users } from "./schema";

/**
 * Default administrative and staff accounts to seed.
 */
export const SEED_USERS = [
  {
    username: "admin",
    password: "Admin123!",
    role: "admin" as const,
  },
  {
    username: "staff",
    password: "Staff123!",
    role: "staff" as const,
  },
];

/**
 * Initial sample categories to seed.
 */
export const SEED_CATEGORIES = [
  {
    id: "cat-default-0000-0000-000000000001",
    name: "General",
    description: "General product category",
  },
  {
    id: "cat-default-0000-0000-000000000002",
    name: "Electronics",
    description: "Electronic sensors and devices",
  },
];

/**
 * Initial sample suppliers to seed.
 */
export const SEED_SUPPLIERS = [
  {
    id: "sup-default-0000-0000-000000000001",
    name: "Default Supplier",
    contactEmail: "supplier@example.com",
    contactPhone: "08123456789",
    address: "Central Warehouse, Industrial Park Block A",
  },
  {
    id: "sup-default-0000-0000-000000000002",
    name: "Acme Industrial Components",
    contactEmail: "acme@example.com",
    contactPhone: "08987654321",
    address: "South Supply Hub, Suite 404",
  },
];

/**
 * Initial sample inventory products to seed.
 */
export const SEED_PRODUCTS = [
  {
    sku: "PROD-WIDGET-01",
    name: "Industrial Widget A",
    price: 29.99,
    quantity: 100,
    lowStockThreshold: 20,
    categoryId: "cat-default-0000-0000-000000000001",
    supplierId: "sup-default-0000-0000-000000000001",
  },
  {
    sku: "PROD-GADGET-02",
    name: "Standard Gadget B",
    price: 49.5,
    quantity: 15,
    lowStockThreshold: 20,
    categoryId: "cat-default-0000-0000-000000000001",
    supplierId: "sup-default-0000-0000-000000000001",
  },
  {
    sku: "PROD-SENSOR-03",
    name: "Precision Sensor C",
    price: 12.75,
    quantity: 5,
    lowStockThreshold: 10,
    categoryId: "cat-default-0000-0000-000000000002",
    supplierId: "sup-default-0000-0000-000000000002",
  },
];

export interface SeedResult {
  usersSeeded: number;
  categoriesSeeded: number;
  suppliersSeeded: number;
  productsSeeded: number;
}

/**
 * Seeds initial users, categories, suppliers, and products into the database.
 * Operation is idempotent: existing records are skipped.
 *
 * @param database - Optional Drizzle database instance (defaults to shared app db).
 * @returns Summary of newly seeded records count.
 */
export async function seed(database = defaultDb): Promise<SeedResult> {
  let usersSeeded = 0;
  let categoriesSeeded = 0;
  let suppliersSeeded = 0;
  let productsSeeded = 0;

  for (const user of SEED_USERS) {
    const [existing] = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, user.username))
      .limit(1);

    if (existing) {
      continue;
    }

    const passwordHash = await Bun.password.hash(user.password, {
      algorithm: "argon2id",
    });

    await database.insert(users).values({
      id: crypto.randomUUID(),
      username: user.username,
      passwordHash,
      role: user.role,
    });
    usersSeeded++;
  }

  for (const cat of SEED_CATEGORIES) {
    const [existing] = await database
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, cat.id))
      .limit(1);

    if (existing) {
      continue;
    }

    await database.insert(categories).values({
      id: cat.id,
      name: cat.name,
      description: cat.description,
    });
    categoriesSeeded++;
  }

  for (const sup of SEED_SUPPLIERS) {
    const [existing] = await database
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.id, sup.id))
      .limit(1);

    if (existing) {
      continue;
    }

    await database.insert(suppliers).values({
      id: sup.id,
      name: sup.name,
      contactEmail: sup.contactEmail,
      contactPhone: sup.contactPhone,
      address: sup.address,
    });
    suppliersSeeded++;
  }

  for (const product of SEED_PRODUCTS) {
    const [existing] = await database
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, product.sku))
      .limit(1);

    if (existing) {
      continue;
    }

    await database.insert(products).values({
      id: crypto.randomUUID(),
      sku: product.sku,
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      lowStockThreshold: product.lowStockThreshold,
      categoryId: product.categoryId,
      supplierId: product.supplierId,
    });
    productsSeeded++;
  }

  return { usersSeeded, categoriesSeeded, suppliersSeeded, productsSeeded };
}

if (import.meta.main) {
  try {
    console.log("Seeding MariaDB database...");
    const result = await seed();
    console.log(
      `Database seeded successfully: ${result.usersSeeded} users, ${result.categoriesSeeded} categories, ${result.suppliersSeeded} suppliers, ${result.productsSeeded} products added.`,
    );
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  } finally {
    await poolConnection.end();
  }
}
