import { Elysia, t } from "elysia";
import { authPlugin } from "../../shared/middleware/auth";
import {
  CreateSupplierBodySchema,
  SupplierQuerySchema,
  UpdateSupplierBodySchema,
} from "./model";
import { supplierService } from "./service";

export * from "./domain";
export * from "./model";
export * from "./service";

export const suppliersModule = new Elysia({ prefix: "/suppliers" })
  .use(authPlugin)
  .post(
    "/",
    async ({ body, set }) => {
      const data = await supplierService.create(body);
      set.status = 201;
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin"],
      body: CreateSupplierBodySchema,
      detail: {
        tags: ["Suppliers"],
        summary: "Create a new supplier (Admin only)",
      },
    },
  )
  .get(
    "/",
    async ({ query }) => {
      const result = await supplierService.list(query);
      return {
        success: true,
        data: result.items,
        meta: result.meta,
      };
    },
    {
      requireRole: ["admin", "staff"],
      query: SupplierQuerySchema,
      detail: {
        tags: ["Suppliers"],
        summary: "Get paginated suppliers list (Admin & Staff)",
      },
    },
  )
  .get(
    "/:id",
    async ({ params }) => {
      const data = await supplierService.getById(params.id);
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin", "staff"],
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Suppliers"],
        summary: "Get supplier by ID (Admin & Staff)",
      },
    },
  )
  .put(
    "/:id",
    async ({ params, body }) => {
      const data = await supplierService.update(params.id, body);
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin"],
      params: t.Object({ id: t.String() }),
      body: UpdateSupplierBodySchema,
      detail: {
        tags: ["Suppliers"],
        summary: "Update supplier attributes (Admin only)",
      },
    },
  )
  .delete(
    "/:id",
    async ({ params }) => {
      const data = await supplierService.delete(params.id);
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin"],
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Suppliers"],
        summary: "Delete supplier (Admin only, restricted if referenced)",
      },
    },
  );
