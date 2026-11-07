import { type Static, t } from "elysia";

export const CreateCategoryBodySchema = t.Object({
  name: t.String({
    minLength: 3,
    maxLength: 100,
    description: "Category name",
  }),
  description: t.Optional(t.String({ description: "Category description" })),
});

export type CreateCategoryBody = Static<typeof CreateCategoryBodySchema>;

export const UpdateCategoryBodySchema = t.Object({
  name: t.Optional(t.String({ minLength: 3, maxLength: 100 })),
  description: t.Optional(t.String()),
});

export type UpdateCategoryBody = Static<typeof UpdateCategoryBodySchema>;

export const CategoryQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 10 })),
});

export type CategoryQuery = Static<typeof CategoryQuerySchema>;
