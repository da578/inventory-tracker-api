import { and, count, desc, eq, like, lte, ne, or } from "drizzle-orm";
import { db } from "../../db";
import { categories, products, suppliers } from "../../db/schema";
import { AppError } from "../../shared/errors/app-error";
import {
  calculatePaginationMeta,
  escapeLikePattern,
  isLowStock,
} from "./domain";
import type {
  CreateProductBody,
  LowStockQuery,
  ProductQuery,
  UpdateProductBody,
} from "./model";

/**
 * Service encapsulating business logic for product management, search, and pagination.
 *
 * @remarks
 * ponytail: Search uses SQL LIKE on name and SKU. Upgrade to MariaDB FULLTEXT index when catalogue exceeds 50k rows.
 *
 * @public
 */
// @impl:FR-PROD-01
// @impl:FR-PROD-02
// @impl:FR-PROD-03
// @impl:FR-PROD-04
export const productsService = {
  /**
   * Validates SKU uniqueness.
   */
  async validateSkuAvailability(sku: string, excludeId?: string) {
    const condition = excludeId
      ? and(eq(products.sku, sku), ne(products.id, excludeId))
      : eq(products.sku, sku);

    const [conflict] = await db
      .select({ id: products.id })
      .from(products)
      .where(condition)
      .limit(1);

    if (conflict) {
      throw new AppError(
        "CONFLICT",
        "Product with this SKU already exists",
        409,
      );
    }
  },

  /**
   * Validates that the referenced category exists.
   */
  async validateCategoryExists(categoryId: string) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!category) {
      throw new AppError("NOT_FOUND", "Referenced category not found", 404);
    }
  },

  /**
   * Validates that the referenced supplier exists.
   */
  async validateSupplierExists(supplierId: string) {
    const [supplier] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);

    if (!supplier) {
      throw new AppError("NOT_FOUND", "Referenced supplier not found", 404);
    }
  },

  /**
   * Creates a new product in the catalog.
   *
   * @param input - Product creation payload.
   * @returns Newly created product record.
   */
  async create(input: CreateProductBody) {
    await this.validateSkuAvailability(input.sku);
    await this.validateCategoryExists(input.categoryId);
    await this.validateSupplierExists(input.supplierId);

    const id = crypto.randomUUID();
    const now = new Date();
    const newProduct = {
      id,
      sku: input.sku,
      name: input.name,
      price: input.price,
      quantity: input.quantity ?? 0,
      lowStockThreshold: input.lowStockThreshold ?? 0,
      categoryId: input.categoryId,
      supplierId: input.supplierId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.insert(products).values(newProduct);
    } catch (err: unknown) {
      const anyErr = err as Record<string, unknown> | null;
      const cause = anyErr?.cause as Record<string, unknown> | undefined;
      const code = anyErr?.code || cause?.code;
      const combinedMsg = `${anyErr?.message || ""} ${anyErr?.sqlMessage || ""} ${cause?.message || ""} ${cause?.sqlMessage || ""}`;

      if (
        code === "ER_DUP_ENTRY" ||
        combinedMsg.includes("ER_DUP_ENTRY") ||
        combinedMsg.includes("Duplicate entry")
      ) {
        throw new AppError(
          "CONFLICT",
          "Product with this SKU already exists",
          409,
        );
      }
      throw err;
    }

    return newProduct;
  },

  /**
   * Retrieves a product by its unique identifier.
   *
   * @param id - Product UUID.
   * @returns Found product record.
   */
  async getById(id: string) {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }

    return product;
  },

  /**
   * Retrieves a paginated list of products, optionally filtered by search text matching name or SKU.
   *
   * @param query - Pagination and optional search query parameters.
   * @returns Products list and pagination metadata.
   */
  async list(query: ProductQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const rawSearch = query.search?.trim();
    const search = rawSearch ? escapeLikePattern(rawSearch) : undefined;
    const searchCondition = search
      ? or(
          like(products.name, `%${search}%`),
          like(products.sku, `%${search}%`),
        )
      : undefined;

    const [countResult] = await db
      .select({ count: count() })
      .from(products)
      .where(searchCondition);

    const total = Number(countResult?.count ?? 0);
    const paginationMeta = calculatePaginationMeta(total, page, limit);

    const items = await db
      .select()
      .from(products)
      .where(searchCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(products.createdAt));

    return {
      items,
      meta: {
        ...paginationMeta,
        total_pages: paginationMeta.totalPages,
      },
    };
  },

  /**
   * Retrieves products whose current quantity is at or below their low stock threshold.
   *
   * @param query - Pagination parameters.
   * @returns Low stock products and pagination metadata.
   */
  async getLowStock(query: LowStockQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const condition = lte(products.quantity, products.lowStockThreshold);

    const [countResult] = await db
      .select({ count: count() })
      .from(products)
      .where(condition);

    const total = Number(countResult?.count ?? 0);
    const paginationMeta = calculatePaginationMeta(total, page, limit);

    const items = await db
      .select()
      .from(products)
      .where(condition)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(products.createdAt));

    const lowStockItems = items.filter((item) =>
      isLowStock(item.quantity, item.lowStockThreshold),
    );

    return {
      items: lowStockItems,
      meta: {
        ...paginationMeta,
        total_pages: paginationMeta.totalPages,
      },
    };
  },

  /**
   * Updates an existing product's fields.
   *
   * @param id - Product UUID to update.
   * @param input - Fields to update.
   * @returns Updated product record.
   */
  async update(id: string, input: UpdateProductBody) {
    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }

    if (input.sku && input.sku !== existing.sku) {
      await this.validateSkuAvailability(input.sku, id);
    }

    const updateValues: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.sku !== undefined) {
      updateValues.sku = input.sku;
    }
    if (input.name !== undefined) {
      updateValues.name = input.name;
    }
    if (input.price !== undefined) {
      updateValues.price = input.price;
    }
    if (input.quantity !== undefined) {
      updateValues.quantity = input.quantity;
    }
    if (input.lowStockThreshold !== undefined) {
      updateValues.lowStockThreshold = input.lowStockThreshold;
    }
    if (input.categoryId !== undefined) {
      await this.validateCategoryExists(input.categoryId);
      updateValues.categoryId = input.categoryId;
    }
    if (input.supplierId !== undefined) {
      await this.validateSupplierExists(input.supplierId);
      updateValues.supplierId = input.supplierId;
    }

    try {
      await db.update(products).set(updateValues).where(eq(products.id, id));
    } catch (err: unknown) {
      const anyErr = err as Record<string, unknown> | null;
      const cause = anyErr?.cause as Record<string, unknown> | undefined;
      const code = anyErr?.code || cause?.code;
      const combinedMsg = `${anyErr?.message || ""} ${anyErr?.sqlMessage || ""} ${cause?.message || ""} ${cause?.sqlMessage || ""}`;

      if (
        code === "ER_DUP_ENTRY" ||
        combinedMsg.includes("ER_DUP_ENTRY") ||
        combinedMsg.includes("Duplicate entry")
      ) {
        throw new AppError(
          "CONFLICT",
          "Product with this SKU already exists",
          409,
        );
      }
      throw err;
    }

    const [updated] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    return updated;
  },

  /**
   * Deletes a product by ID.
   *
   * @param id - Product UUID to delete.
   * @returns Confirmation message and deleted ID.
   */
  async delete(id: string) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }

    try {
      await db.delete(products).where(eq(products.id, id));
    } catch (err: unknown) {
      const anyErr = err as Record<string, unknown> | null;
      const cause = anyErr?.cause as Record<string, unknown> | undefined;

      const code = anyErr?.code || cause?.code;
      const combinedMsg = `${anyErr?.message || ""} ${anyErr?.sqlMessage || ""} ${cause?.message || ""} ${cause?.sqlMessage || ""}`;

      const isFkConflict =
        code === "ER_ROW_IS_REFERENCED" ||
        code === "ER_ROW_IS_REFERENCED_2" ||
        combinedMsg.includes("ER_ROW_IS_REFERENCED") ||
        combinedMsg.includes("ER_ROW_IS_REFERENCED_2") ||
        combinedMsg.includes("foreign key constraint fails");

      if (isFkConflict) {
        throw new AppError(
          "CONFLICT",
          "Product cannot be deleted because it has associated stock adjustment records",
          409,
        );
      }
      throw err;
    }

    return { id, message: "Product deleted successfully" };
  },
};
