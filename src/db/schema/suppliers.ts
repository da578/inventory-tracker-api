import { mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Database schema for suppliers table.
 *
 * @remarks
 * ponytail: Flat contact columns. Upgrade to dedicated supplier_contacts table if multi-contact support is requested.
 *
 * @public
 */
export const suppliers = mysqlTable("suppliers", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 150 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  address: text("address"),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});
