import { count, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { suppliers } from "../../db/schema";
import { AppError } from "../../shared/errors/app-error";
import { calculatePaginationMeta } from "../products/domain";
import { validateSupplierContact, validateSupplierName } from "./domain";
import type {
  CreateSupplierBody,
  SupplierQuery,
  UpdateSupplierBody,
} from "./model";

// @impl:FR-SUP-01
// @impl:FR-SUP-02
export const supplierService = {
  /**
   * Registers a new supplier.
   *
   * @param input - Creation payload.
   * @returns Persisted supplier record.
   */
  async create(input: CreateSupplierBody) {
    const nameValidation = validateSupplierName(input.name);
    if (!nameValidation.valid) {
      throw new AppError(
        "VALIDATION_ERROR",
        nameValidation.error ?? "Invalid supplier name",
        400,
      );
    }

    const contactValidation = validateSupplierContact(
      input.contactEmail,
      input.contactPhone,
    );
    if (!contactValidation.valid) {
      throw new AppError(
        "VALIDATION_ERROR",
        contactValidation.error ?? "Invalid contact details",
        400,
      );
    }

    const id = crypto.randomUUID();
    const now = new Date();

    await db.insert(suppliers).values({
      id,
      name: input.name.trim(),
      contactEmail: input.contactEmail?.trim() ?? null,
      contactPhone: input.contactPhone?.trim() ?? null,
      address: input.address?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      name: input.name.trim(),
      contactEmail: input.contactEmail?.trim() ?? null,
      contactPhone: input.contactPhone?.trim() ?? null,
      address: input.address?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Returns a paginated list of suppliers.
   *
   * @param query - Pagination parameters.
   * @returns Paginated records and meta envelope.
   */
  async list(query: SupplierQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const [countResult] = await db.select({ count: count() }).from(suppliers);

    const total = Number(countResult?.count ?? 0);
    const meta = calculatePaginationMeta(total, page, limit);

    const items = await db
      .select()
      .from(suppliers)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(suppliers.createdAt));

    return {
      items,
      meta,
    };
  },

  /**
   * Retrieves single supplier by ID.
   *
   * @param id - Supplier UUID.
   * @returns Supplier record.
   */
  async getById(id: string) {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);

    if (!supplier) {
      throw new AppError("NOT_FOUND", "Supplier not found", 404);
    }

    return supplier;
  },

  /**
   * Updates supplier record attributes.
   *
   * @param id - Supplier UUID.
   * @param input - Update payload.
   * @returns Updated supplier record.
   */
  async update(id: string, input: UpdateSupplierBody) {
    await this.getById(id);

    const nameValidation = input.name
      ? validateSupplierName(input.name)
      : { valid: true };
    if (!nameValidation.valid) {
      throw new AppError(
        "VALIDATION_ERROR",
        nameValidation.error ?? "Invalid supplier name",
        400,
      );
    }

    const hasContactUpdate =
      input.contactEmail !== undefined || input.contactPhone !== undefined;
    const contactValidation = hasContactUpdate
      ? validateSupplierContact(input.contactEmail, input.contactPhone)
      : { valid: true };

    if (!contactValidation.valid) {
      throw new AppError(
        "VALIDATION_ERROR",
        contactValidation.error ?? "Invalid contact details",
        400,
      );
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      updatePayload.name = input.name.trim();
    }
    if (input.contactEmail !== undefined) {
      updatePayload.contactEmail = input.contactEmail?.trim() ?? null;
    }
    if (input.contactPhone !== undefined) {
      updatePayload.contactPhone = input.contactPhone?.trim() ?? null;
    }
    if (input.address !== undefined) {
      updatePayload.address = input.address?.trim() ?? null;
    }

    await db.update(suppliers).set(updatePayload).where(eq(suppliers.id, id));

    return this.getById(id);
  },

  /**
   * Deletes a supplier if unreferenced by products.
   *
   * @param id - Supplier UUID.
   */
  async delete(id: string) {
    await this.getById(id);

    try {
      await db.delete(suppliers).where(eq(suppliers.id, id));
      return { message: "Supplier deleted successfully" };
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
          "Supplier cannot be deleted because it is referenced by existing products",
          409,
        );
      }
      throw err;
    }
  },
};
