import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { categories } from "../../db/schema";
import { AppError } from "../../shared/errors/app-error";
import { calculatePaginationMeta } from "../products/domain";
import { validateCategoryName } from "./domain";
import type {
  CategoryQuery,
  CreateCategoryBody,
  UpdateCategoryBody,
} from "./model";

// @impl:FR-CAT-01
// @impl:FR-CAT-02
// @impl:FR-CAT-03
export const categoryService = {
  /**
   * Creates a new category record.
   *
   * @param input - Creation payload.
   * @returns Persisted category entity.
   */
  async create(input: CreateCategoryBody) {
    const validation = validateCategoryName(input.name);
    if (!validation.valid) {
      throw new AppError(
        "VALIDATION_ERROR",
        validation.error ?? "Invalid category name",
        400,
      );
    }

    const trimmedName = input.name.trim();

    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(sql`LOWER(${categories.name}) = LOWER(${trimmedName})`)
      .limit(1);

    if (existing) {
      throw new AppError(
        "CONFLICT",
        `Category with name "${trimmedName}" already exists`,
        409,
      );
    }

    const id = crypto.randomUUID();
    const now = new Date();

    await db.insert(categories).values({
      id,
      name: trimmedName,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      name: trimmedName,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Returns a paginated list of categories.
   *
   * @param query - Pagination parameters.
   * @returns Paginated records and meta envelope.
   */
  async list(query: CategoryQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const [countResult] = await db.select({ count: count() }).from(categories);

    const total = Number(countResult?.count ?? 0);
    const meta = calculatePaginationMeta(total, page, limit);

    const items = await db
      .select()
      .from(categories)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(categories.createdAt));

    return {
      items,
      meta,
    };
  },

  /**
   * Retrieves single category by ID.
   *
   * @param id - Category UUID.
   * @returns Category record.
   */
  async getById(id: string) {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!category) {
      throw new AppError("NOT_FOUND", "Category not found", 404);
    }

    return category;
  },

  /**
   * Updates category attributes.
   *
   * @param id - Category UUID.
   * @param input - Update payload.
   * @returns Updated category record.
   */
  async update(id: string, input: UpdateCategoryBody) {
    await this.getById(id);

    const validName = await this.validateNameForUpdate(id, input.name);

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validName !== undefined) {
      updatePayload.name = validName;
    }
    if (input.description !== undefined) {
      updatePayload.description = input.description;
    }

    await db.update(categories).set(updatePayload).where(eq(categories.id, id));

    return this.getById(id);
  },

  /**
   * Helper to validate category name on update.
   */
  async validateNameForUpdate(
    id: string,
    name?: string,
  ): Promise<string | undefined> {
    if (!name) {
      return undefined;
    }

    const validation = validateCategoryName(name);
    if (!validation.valid) {
      throw new AppError(
        "VALIDATION_ERROR",
        validation.error ?? "Invalid category name",
        400,
      );
    }

    const trimmedName = name.trim();
    const [duplicate] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        sql`LOWER(${categories.name}) = LOWER(${trimmedName}) AND ${categories.id} != ${id}`,
      )
      .limit(1);

    if (duplicate) {
      throw new AppError(
        "CONFLICT",
        `Category with name "${trimmedName}" already exists`,
        409,
      );
    }

    return trimmedName;
  },

  /**
   * Deletes a category if unreferenced by products.
   *
   * @param id - Category UUID.
   */
  async delete(id: string) {
    await this.getById(id);

    try {
      await db.delete(categories).where(eq(categories.id, id));
      return { message: "Category deleted successfully" };
    } catch (err: unknown) {
      const anyErr = err as Record<string, unknown> | null;
      const cause = anyErr?.cause as Record<string, unknown> | undefined;
      const code = anyErr?.code || cause?.code;

      if (
        code === "ER_ROW_IS_REFERENCED" ||
        code === "ER_ROW_IS_REFERENCED_2"
      ) {
        throw new AppError(
          "CONFLICT",
          "Category cannot be deleted because it is referenced by existing products",
          409,
        );
      }
      throw err;
    }
  },
};
