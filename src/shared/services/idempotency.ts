import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { idempotencyKeys } from "../../db/schema/idempotency-keys";
import { AppError } from "../errors/app-error";

/**
 * Database client or transaction context for database operations.
 *
 * @public
 */
export type DbOrTx =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Generates a SHA-256 hash of the request components for idempotency validation.
 *
 * @remarks
 * Used to ensure that retried requests contain the exact same payload as the original request.
 *
 * @param method - HTTP method (e.g., 'POST').
 * @param path - Request path (e.g., '/stock/adjust').
 * @param body - Stringified request body.
 * @returns A hexadecimal SHA-256 hash string.
 *
 * @example
 * ```ts
 * const hash = await generateRequestHash("POST", "/api", '{"foo":"bar"}');
 * ```
 *
 * @public
 */
export async function generateRequestHash(
  method: string,
  path: string,
  body: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${method}${path}${body}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Checks if an idempotency key already exists and is valid.
 *
 * @remarks
 * If the key exists but is expired, it throws a 400 Bad Request.
 * If the key exists with a different request hash, it throws a 409 Conflict.
 * If valid, it returns the cached response to prevent re-execution.
 *
 * @param key - The idempotency key from the request header.
 * @param scope - The scope of the operation (e.g., 'stock_adjustment').
 * @param requestHash - The generated hash of the current request.
 * @param executor - Optional database client or transaction instance. Defaults to `db`.
 * @returns The cached response object if valid, or null if it's a new request.
 *
 * @throws {@link AppError}
 * Thrown with code 'CONFLICT' if the key exists with a different payload, or 'BAD_REQUEST' if expired.
 *
 * @example
 * ```ts
 * const cached = await checkIdempotency("key-123", "stock", "hash-abc");
 * ```
 *
 * @public
 */
export async function checkIdempotency(
  key: string,
  scope: string,
  requestHash: string,
  executor: DbOrTx = db,
): Promise<{ responseStatus: number; responseBody: string } | null> {
  const existing = await executor.query.idempotencyKeys.findFirst({
    where: and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)),
  });

  if (!existing) {
    return null;
  }
  if (existing.expiresAt < new Date()) {
    throw new AppError(
      "BAD_REQUEST",
      "Idempotency key has expired. Please retry without the key.",
      400,
    );
  }

  if (existing.requestHash !== requestHash) {
    throw new AppError(
      "CONFLICT",
      "Idempotency key already exists with a different request payload",
      409,
    );
  }

  return {
    responseStatus: existing.responseStatus,
    responseBody: existing.responseBody,
  };
}

/**
 * Saves the idempotency record to the database after a successful operation.
 *
 * @remarks
 * Caches the response so subsequent requests with the same key can be served immediately.
 *
 * @param key - The idempotency key.
 * @param scope - The scope of the operation.
 * @param requestHash - The generated hash of the request.
 * @param responseStatus - The HTTP status code of the response.
 * @param responseBody - The stringified response body.
 * @param ttlMs - Time-to-live in milliseconds. Defaults to 24 hours.
 * @param executor - Optional database client or transaction instance. Defaults to `db`.
 *
 * @example
 * ```ts
 * await saveIdempotency("key-123", "stock", "hash-abc", 201, '{"success":true}');
 * ```
 *
 * @public
 */
export async function saveIdempotency(
  key: string,
  scope: string,
  requestHash: string,
  responseStatus: number,
  responseBody: string,
  ttlMs: number = 86400000,
  executor: DbOrTx = db,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  await executor.insert(idempotencyKeys).values({
    key,
    scope,
    requestHash,
    responseStatus,
    responseBody,
    expiresAt,
  });
}
