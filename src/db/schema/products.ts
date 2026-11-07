import {
  double,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { categories } from "./categories";
import { suppliers } from "./suppliers";

/**
 * Database schema for the products table.
 *
 * @remarks
 * Includes a `version` column for Optimistic Locking (TM-01) to prevent
 * race conditions during concurrent stock adjustments (FR-02).
 * Linked to `categories` and `suppliers` via foreign keys with restrict on delete.
 *
 * @public
 */
export const products = mysqlTable("products", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sku: varchar("sku", { length: 64 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  price: double("price").notNull(),
  quantity: int("quantity").notNull().default(0),
  lowStockThreshold: int("low_stock_threshold").notNull().default(0),
  categoryId: varchar("category_id", { length: 36 })
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
  supplierId: varchar("supplier_id", { length: 36 })
    .notNull()
    .references(() => suppliers.id, { onDelete: "restrict" }),
  version: int("version").notNull().default(1),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});
