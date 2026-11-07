import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { products } from "./products";
import { users } from "./users";

/**
 * Database schema for the stock_adjustments table.
 *
 * @remarks
 * Acts as an immutable audit log for all stock mutations.
 * Linked to `products` and `users` via foreign keys.
 *
 * @public
 */
export const stockAdjustments = mysqlTable("stock_adjustments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: varchar("product_id", { length: 36 })
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  type: mysqlEnum("type", ["IN", "OUT"]).notNull(),
  quantity: int("quantity").notNull(),
  reason: text("reason").notNull(),
  createdBy: varchar("created_by", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
});
