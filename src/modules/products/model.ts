import { t } from "elysia";

/**
 * Schema for product creation request body.
 *
 * @public
 */
export const CreateProductBodySchema = t.Object({
  sku: t.String({
    minLength: 1,
    maxLength: 64,
    description: "Unique SKU identifier",
  }),
  name: t.String({
    minLength: 1,
    maxLength: 255,
    description: "Product name",
  }),
  price: t.Number({ minimum: 0, description: "Unit price" }),
  quantity: t.Optional(
    t.Integer({
      minimum: 0,
      default: 0,
      description: "Initial stock quantity",
    }),
  ),
  lowStockThreshold: t.Optional(
    t.Integer({
      minimum: 0,
      default: 0,
      description: "Low stock alert threshold",
    }),
  ),
  categoryId: t.String({
    minLength: 1,
    description: "Referenced category UUID",
  }),
  supplierId: t.String({
    minLength: 1,
    description: "Referenced supplier UUID",
  }),
});

/**
 * Type inferred from CreateProductBodySchema.
 *
 * @public
 */
export type CreateProductBody = typeof CreateProductBodySchema.static;

/**
 * Schema for product update request body.
 *
 * @public
 */
export const UpdateProductBodySchema = t.Object({
  sku: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
  name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  price: t.Optional(t.Number({ minimum: 0 })),
  quantity: t.Optional(t.Integer({ minimum: 0 })),
  lowStockThreshold: t.Optional(t.Integer({ minimum: 0 })),
  categoryId: t.Optional(t.String({ minLength: 1 })),
  supplierId: t.Optional(t.String({ minLength: 1 })),
});

/**
 * Type inferred from UpdateProductBodySchema.
 *
 * @public
 */
export type UpdateProductBody = typeof UpdateProductBodySchema.static;

/**
 * Schema for listing products query parameters.
 *
 * @public
 */
export const ProductQuerySchema = t.Object({
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
      description: "Number of items per page",
    }),
  ),
  search: t.Optional(
    t.String({
      description: "Case-insensitive partial match on name or SKU",
    }),
  ),
});

/**
 * Type inferred from ProductQuerySchema.
 *
 * @public
 */
export type ProductQuery = typeof ProductQuerySchema.static;

/**
 * Schema for low-stock products query parameters.
 *
 * @public
 */
export const LowStockQuerySchema = t.Object({
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
      description: "Number of items per page",
    }),
  ),
});

/**
 * Type inferred from LowStockQuerySchema.
 *
 * @public
 */
export type LowStockQuery = typeof LowStockQuerySchema.static;

/**
 * Schema for product route path parameters.
 *
 * @public
 */
export const ProductParamSchema = t.Object({
  id: t.String({ minLength: 1, description: "Product UUID" }),
});

/**
 * Type inferred from ProductParamSchema.
 *
 * @public
 */
export type ProductParam = typeof ProductParamSchema.static;
