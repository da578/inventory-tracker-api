import { type Static, Type } from "@sinclair/typebox";

/**
 * Standard query parameters for paginated list endpoints.
 *
 * @remarks
 * Enforces sensible defaults and limits to prevent abuse (e.g., max limit of 100).
 * Sorting is optional and defaults to 'desc' for chronological logs if applicable.
 *
 * @public
 */
export const ListQuerySchema = Type.Object({
  page: Type.Optional(
    Type.Integer({
      minimum: 1,
      default: 1,
      description: "Page number (1-indexed)",
    }),
  ),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 10,
      description: "Number of items per page",
    }),
  ),
  sort: Type.Optional(Type.String({ description: "Field to sort by" })),
  order: Type.Optional(
    Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
      default: "desc",
      description: "Sort direction",
    }),
  ),
});

/**
 * Standard metadata payload for paginated responses.
 *
 * @public
 */
export const PaginatedMetaSchema = Type.Object({
  page: Type.Integer({ description: "Current page number" }),
  limit: Type.Integer({ description: "Number of items per page" }),
  total: Type.Integer({
    description: "Total number of items across all pages",
  }),
  total_pages: Type.Integer({ description: "Total number of pages" }),
});

/**
 * TypeScript type inferences.
 *
 * @public
 */
export type ListQuery = Static<typeof ListQuerySchema>;
export type PaginatedMeta = Static<typeof PaginatedMetaSchema>;
