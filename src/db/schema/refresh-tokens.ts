import { mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { users } from "./users";

/**
 * Database schema for the refresh_tokens table.
 *
 * @remarks
 * Stores persistent refresh tokens associated with users for JWT session rotation.
 * Linked to `users` via foreign key with cascading deletion.
 *
 * @public
 */
export const refreshTokens = mysqlTable("refresh_tokens", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 500 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
});
