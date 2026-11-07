import { mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Database schema for categories table.
 *
 * @remarks
 * ponytail: Standard category index on name. Upgrade to hierarchical ltree/nested set if deep trees are required.
 *
 * @public
 */
export const categories = mysqlTable("categories", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 100 }).unique().notNull(),
  description: text("description"),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});
