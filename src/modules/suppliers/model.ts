import { type Static, t } from "elysia";

export const CreateSupplierBodySchema = t.Object({
  name: t.String({
    minLength: 2,
    maxLength: 150,
    description: "Supplier company name",
  }),
  contactEmail: t.Optional(t.String({ description: "Supplier contact email" })),
  contactPhone: t.Optional(
    t.String({ minLength: 8, description: "Supplier contact telephone" }),
  ),
  address: t.Optional(t.String({ description: "Physical warehouse address" })),
});

export type CreateSupplierBody = Static<typeof CreateSupplierBodySchema>;

export const UpdateSupplierBodySchema = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 150 })),
  contactEmail: t.Optional(t.String()),
  contactPhone: t.Optional(t.String({ minLength: 8 })),
  address: t.Optional(t.String()),
});

export type UpdateSupplierBody = Static<typeof UpdateSupplierBodySchema>;

export const SupplierQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 10 })),
});

export type SupplierQuery = Static<typeof SupplierQuerySchema>;
