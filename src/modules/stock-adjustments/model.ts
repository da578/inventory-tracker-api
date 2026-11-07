import { t } from "elysia";

/**
 * Schema for stock adjustment request body.
 *
 * @remarks
 * Validates stock mutation payload enforcing UUID product identifier,
 * adjustment type ('IN' or 'OUT'), positive quantity, and descriptive reason.
 *
 * @public
 */
export const AdjustStockBodySchema = t.Object({
  productId: t.String({
    format: "uuid",
    description: "UUID of the product to adjust stock for",
  }),
  type: t.Union([t.Literal("IN"), t.Literal("OUT")], {
    description: "Adjustment type: IN (restock) or OUT (deduction)",
  }),
  quantity: t.Integer({
    minimum: 1,
    description: "Positive integer quantity to adjust",
  }),
  reason: t.String({
    minLength: 5,
    maxLength: 255,
    description:
      "Audit trail justification for the adjustment (5-255 characters)",
  }),
});

/**
 * Type inferred from AdjustStockBodySchema.
 *
 * @public
 */
export type AdjustStockBody = typeof AdjustStockBodySchema.static;

/**
 * Schema for stock adjustment headers requiring an idempotency key.
 *
 * @remarks
 * Enforces `Idempotency-Key` header on all adjustment mutations to prevent double-execution.
 *
 * @public
 */
export const AdjustStockHeadersSchema = t.Object({
  "idempotency-key": t.String({
    minLength: 1,
    description: "Unique idempotency key for safely retrying adjustments",
  }),
  authorization: t.Optional(
    t.String({
      description: "Bearer JWT authorization token",
    }),
  ),
});

/**
 * Type inferred from AdjustStockHeadersSchema.
 *
 * @public
 */
export type AdjustStockHeaders = typeof AdjustStockHeadersSchema.static;

/**
 * Schema for stock history route parameters.
 *
 * @public
 */
export const StockHistoryParamSchema = t.Object({
  productId: t.String({
    minLength: 1,
    description: "Product UUID to fetch adjustment history for",
  }),
});

/**
 * Type inferred from StockHistoryParamSchema.
 *
 * @public
 */
export type StockHistoryParam = typeof StockHistoryParamSchema.static;

/**
 * Schema for stock history pagination query parameters.
 *
 * @public
 */
export const StockHistoryQuerySchema = t.Object({
  page: t.Optional(
    t.Integer({
      minimum: 1,
      default: 1,
      description: "Page number (1-indexed)",
    }),
  ),
  limit: t.Optional(
    t.Integer({
      minimum: 1,
      maximum: 100,
      default: 10,
      description: "Number of records per page",
    }),
  ),
});

/**
 * Type inferred from StockHistoryQuerySchema.
 *
 * @public
 */
export type StockHistoryQuery = typeof StockHistoryQuerySchema.static;
