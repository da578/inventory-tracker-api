import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { products, stockAdjustments } from "../../db/schema";
import { AppError } from "../../shared/errors/app-error";
import {
  checkIdempotency,
  generateRequestHash,
  saveIdempotency,
} from "../../shared/services/idempotency";
import type { UserPayload } from "../auth/model";
import { calculatePaginationMeta } from "../products/domain";
import {
  calculateNewQuantity,
  validateAdjustmentReason,
  validateStockAvailability,
} from "./domain";
import type { AdjustStockBody, StockHistoryQuery } from "./model";

/**
 * Service encapsulating business logic for stock adjustments and audit history.
 *
 * @remarks
 * ponytail: Audit logs query directly with SQL count. Upgrade to materialized counter if audit log exceeds 10M rows.
 *
 * @public
 */
// @impl:FR-STK-01
// @impl:FR-STK-02
export const stockAdjustmentsService = {
  /**
   * Adjusts stock quantity for a product under an ACID transaction with optimistic locking and idempotency.
   *
   * @param user - Authenticated user initiating the adjustment.
   * @param input - Stock adjustment payload.
   * @param idempotencyKey - Unique idempotency key from header.
   * @param path - Request path for hash calculation.
   * @param options - Optional hooks for testing race conditions.
   * @returns The status code and response payload.
   */
  async adjust(
    user: UserPayload,
    input: AdjustStockBody,
    idempotencyKey: string,
    path: string = "/stock/adjust",
    options?: { onBeforeUpdate?: () => Promise<void> },
  ) {
    const reasonValidation = validateAdjustmentReason(input.reason);
    if (!reasonValidation.valid) {
      throw new AppError(
        "VALIDATION_ERROR",
        reasonValidation.error ?? "Invalid adjustment reason",
        400,
      );
    }

    const requestHash = await generateRequestHash(
      "POST",
      path,
      JSON.stringify(input),
    );

    const cached = await checkIdempotency(
      idempotencyKey,
      "stock_adjustment",
      requestHash,
    );
    if (cached) {
      return {
        status: cached.responseStatus,
        data: JSON.parse(cached.responseBody) as {
          success: boolean;
          data: unknown;
        },
      };
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, input.productId))
          .limit(1);

        if (!product) {
          throw new AppError("NOT_FOUND", "Product not found", 404);
        }

        const availability = validateStockAvailability(
          product.quantity,
          input.quantity,
          input.type,
        );
        if (!availability.valid) {
          throw new AppError(
            "BUSINESS_RULE_VIOLATION",
            availability.error ?? "Insufficient stock for deduction",
            422,
          );
        }

        if (options?.onBeforeUpdate) {
          await options.onBeforeUpdate();
        }

        const newQuantity = calculateNewQuantity(
          product.quantity,
          input.quantity,
          input.type,
        );
        const [updateRes] = await tx
          .update(products)
          .set({
            quantity: newQuantity,
            version: sql`${products.version} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, product.id),
              eq(products.version, product.version),
            ),
          );

        if (updateRes.affectedRows === 0) {
          throw new AppError(
            "CONFLICT",
            "Optimistic locking conflict. The product has been modified by another transaction.",
            409,
          );
        }

        const adjustmentId = crypto.randomUUID();
        const now = new Date();
        const adjustment = {
          id: adjustmentId,
          productId: input.productId,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason,
          createdBy: user.id,
          createdAt: now,
        };

        await tx.insert(stockAdjustments).values(adjustment);

        const responsePayload = {
          success: true,
          data: adjustment,
        };

        await saveIdempotency(
          idempotencyKey,
          "stock_adjustment",
          requestHash,
          200,
          JSON.stringify(responsePayload),
          86400000,
          tx,
        );

        return {
          status: 200,
          data: responsePayload,
        };
      });

      return result;
    } catch (err: unknown) {
      const anyErr = err as Record<string, unknown> | null;
      const cause = anyErr?.cause as Record<string, unknown> | undefined;
      const code = anyErr?.code || cause?.code;
      const combinedMsg = `${anyErr?.message || ""} ${cause?.message || ""}`;

      const isCheckRead =
        code === "ER_CHECKREAD" ||
        combinedMsg.includes("ER_CHECKREAD") ||
        combinedMsg.includes("Record has changed since last read");

      if (isCheckRead) {
        throw new AppError(
          "CONFLICT",
          "Optimistic locking conflict. The product has been modified by another transaction.",
          409,
        );
      }

      const isDupEntry =
        code === "ER_DUP_ENTRY" ||
        combinedMsg.includes("ER_DUP_ENTRY") ||
        combinedMsg.includes("Duplicate entry");

      if (!isDupEntry) {
        throw err;
      }

      const cachedReplay = await checkIdempotency(
        idempotencyKey,
        "stock_adjustment",
        requestHash,
      );
      if (cachedReplay) {
        return {
          status: cachedReplay.responseStatus,
          data: JSON.parse(cachedReplay.responseBody) as {
            success: boolean;
            data: unknown;
          },
        };
      }

      throw err;
    }
  },

  /**
   * Retrieves paginated adjustment audit records for a given product.
   *
   * @param productId - Target product UUID.
   * @param query - Pagination parameters.
   * @returns Paginated adjustment log and metadata.
   */
  async getHistory(productId: string, query: StockHistoryQuery) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const [countResult] = await db
      .select({ count: count() })
      .from(stockAdjustments)
      .where(eq(stockAdjustments.productId, productId));

    const total = Number(countResult?.count ?? 0);
    const meta = calculatePaginationMeta(total, page, limit);

    const items = await db
      .select()
      .from(stockAdjustments)
      .where(eq(stockAdjustments.productId, productId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(stockAdjustments.createdAt));

    return {
      items,
      meta,
    };
  },
};
