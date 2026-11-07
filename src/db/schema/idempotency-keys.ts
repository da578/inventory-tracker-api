import {
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Database schema for the idempotency_keys table.
 *
 * @remarks
 * Ensures that stock adjustment requests (FR-02) are processed exactly once,
 * preventing double-submission or race conditions on network retries.
 *
 * @public
 */
export const idempotencyKeys = mysqlTable("idempotency_keys", {
  key: varchar("key", { length: 255 }).primaryKey(),
  scope: varchar("scope", { length: 64 }).notNull(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  responseStatus: int("response_status").notNull(),
  responseBody: text("response_body").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
