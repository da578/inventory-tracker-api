import { Elysia } from "elysia";
import { authPlugin } from "../../shared/middleware/auth";
import {
  AdjustStockBodySchema,
  AdjustStockHeadersSchema,
  StockHistoryParamSchema,
  StockHistoryQuerySchema,
} from "./model";
import { stockAdjustmentsService } from "./service";

export * from "./domain";
export * from "./model";
export * from "./service";

/**
 * Elysia module managing stock adjustments and audit history logs.
 *
 * @remarks
 * Implements optimistic concurrency control (TM-01), idempotency protection,
 * and immutable audit history for product inventory adjustments.
 *
 * @public
 */
export const stockAdjustmentsModule = new Elysia({ prefix: "/stock" })
  .use(authPlugin)
  .post(
    "/adjust",
    async ({ user, body, headers, set }) => {
      const result = await stockAdjustmentsService.adjust(
        user,
        body,
        headers["idempotency-key"],
        "/stock/adjust",
      );
      set.status = result.status;
      return result.data;
    },
    {
      requireRole: ["admin", "staff"],
      headers: AdjustStockHeadersSchema,
      body: AdjustStockBodySchema,
      detail: {
        tags: ["Stock Adjustments"],
        summary: "Adjust product stock with optimistic locking and idempotency",
      },
    },
  )
  .get(
    "/history/:productId",
    async ({ params, query }) => {
      const { items, meta } = await stockAdjustmentsService.getHistory(
        params.productId,
        query,
      );
      return {
        success: true,
        data: items,
        meta,
      };
    },
    {
      requireRole: ["admin", "staff"],
      params: StockHistoryParamSchema,
      query: StockHistoryQuerySchema,
      detail: {
        tags: ["Stock Adjustments"],
        summary:
          "Get paginated audit history of stock adjustments for a product",
      },
    },
  );
