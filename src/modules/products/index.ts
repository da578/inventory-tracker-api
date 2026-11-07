import { Elysia } from "elysia";
import { authPlugin } from "../../shared/middleware/auth";
import {
  CreateProductBodySchema,
  LowStockQuerySchema,
  ProductParamSchema,
  ProductQuerySchema,
  UpdateProductBodySchema,
} from "./model";
import { productsService } from "./service";

export * from "./domain";
export * from "./model";
export * from "./service";

/**
 * Elysia module handling product catalog, inventory queries, and maintenance.
 *
 * @remarks
 * Exposes endpoints for managing products, search filtering, pagination,
 * low-stock threshold queries, and role-based access control.
 *
 * @public
 */
export const productsModule = new Elysia({ prefix: "/products" })
  .use(authPlugin)
  .post(
    "/",
    async ({ body, set }) => {
      const data = await productsService.create(body);
      set.status = 201;
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin"],
      body: CreateProductBodySchema,
      detail: {
        tags: ["Products"],
        summary: "Create a new product (Admin only)",
      },
    },
  )
  .get(
    "/",
    async ({ query }) => {
      const { items, meta } = await productsService.list(query);
      return {
        success: true,
        data: items,
        meta,
      };
    },
    {
      requireRole: ["admin", "staff"],
      query: ProductQuerySchema,
      detail: {
        tags: ["Products"],
        summary: "List products with search and pagination",
      },
    },
  )
  .get(
    "/low-stock",
    async ({ query }) => {
      const { items, meta } = await productsService.getLowStock(query);
      return {
        success: true,
        data: items,
        meta,
      };
    },
    {
      requireRole: ["admin", "staff"],
      query: LowStockQuerySchema,
      detail: {
        tags: ["Products"],
        summary: "List products with stock at or below low-stock threshold",
      },
    },
  )
  .get(
    "/:id",
    async ({ params }) => {
      const data = await productsService.getById(params.id);
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin", "staff"],
      params: ProductParamSchema,
      detail: {
        tags: ["Products"],
        summary: "Get product details by ID",
      },
    },
  )
  .put(
    "/:id",
    async ({ params, body }) => {
      const data = await productsService.update(params.id, body);
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin"],
      params: ProductParamSchema,
      body: UpdateProductBodySchema,
      detail: {
        tags: ["Products"],
        summary: "Update product by ID (Admin only)",
      },
    },
  )
  .delete(
    "/:id",
    async ({ params }) => {
      const data = await productsService.delete(params.id);
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin"],
      params: ProductParamSchema,
      detail: {
        tags: ["Products"],
        summary: "Delete product by ID (Admin only)",
      },
    },
  );
