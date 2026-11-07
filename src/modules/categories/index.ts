import { Elysia, t } from "elysia";
import { authPlugin } from "../../shared/middleware/auth";
import {
  CategoryQuerySchema,
  CreateCategoryBodySchema,
  UpdateCategoryBodySchema,
} from "./model";
import { categoryService } from "./service";

export * from "./domain";
export * from "./model";
export * from "./service";

export const categoriesModule = new Elysia({ prefix: "/categories" })
  .use(authPlugin)
  .post(
    "/",
    async ({ body, set }) => {
      const data = await categoryService.create(body);
      set.status = 201;
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin"],
      body: CreateCategoryBodySchema,
      detail: {
        tags: ["Categories"],
        summary: "Create a new product category (Admin only)",
      },
    },
  )
  .get(
    "/",
    async ({ query }) => {
      const result = await categoryService.list(query);
      return {
        success: true,
        data: result.items,
        meta: result.meta,
      };
    },
    {
      requireRole: ["admin", "staff"],
      query: CategoryQuerySchema,
      detail: {
        tags: ["Categories"],
        summary: "Get paginated categories list (Admin & Staff)",
      },
    },
  )
  .get(
    "/:id",
    async ({ params }) => {
      const data = await categoryService.getById(params.id);
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin", "staff"],
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Categories"],
        summary: "Get category by ID (Admin & Staff)",
      },
    },
  )
  .put(
    "/:id",
    async ({ params, body }) => {
      const data = await categoryService.update(params.id, body);
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin"],
      params: t.Object({ id: t.String() }),
      body: UpdateCategoryBodySchema,
      detail: {
        tags: ["Categories"],
        summary: "Update category attributes (Admin only)",
      },
    },
  )
  .delete(
    "/:id",
    async ({ params }) => {
      const data = await categoryService.delete(params.id);
      return {
        success: true,
        data,
      };
    },
    {
      requireRole: ["admin"],
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Categories"],
        summary: "Delete category (Admin only, restricted if referenced)",
      },
    },
  );
