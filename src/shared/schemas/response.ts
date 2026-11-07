import {
  type Static,
  type TLiteral,
  type TObject,
  type TSchema,
  Type,
} from "@sinclair/typebox";

/**
 * Standard error detail schema for API responses.
 *
 * @public
 */
export const ErrorDetailSchema = Type.Object({
  code: Type.String({ description: "Machine-readable error code" }),
  message: Type.String({ description: "Human-readable error message" }),
  details: Type.Optional(
    Type.Record(Type.String(), Type.Any(), {
      description: "Optional additional context about the error",
    }),
  ),
});

/**
 * Standard error response wrapper.
 *
 * @public
 */
export const ErrorResponseSchema = Type.Object({
  success: Type.Literal(false),
  error: ErrorDetailSchema,
});

/**
 * Standard success response wrapper with optional data and meta.
 *
 * @typeParam TData - The type of the data payload.
 * @typeParam TMeta - The type of the pagination or metadata payload.
 *
 * @public
 */
export function SuccessResponseSchema<TData extends TSchema>(
  dataSchema: TData,
): TObject<{ success: TLiteral<true>; data: TData }>;

export function SuccessResponseSchema<
  TData extends TSchema,
  TMeta extends TSchema,
>(
  dataSchema: TData,
  metaSchema: TMeta,
): TObject<{ success: TLiteral<true>; data: TData; meta: TMeta }>;

export function SuccessResponseSchema<
  TData extends TSchema,
  TMeta extends TSchema,
>(
  dataSchema: TData,
  metaSchema?: TMeta,
): TObject<{
  success: TLiteral<true>;
  data: TData;
  meta?: TMeta;
}> {
  return metaSchema
    ? (Type.Object({
        success: Type.Literal(true),
        data: dataSchema,
        meta: metaSchema,
      }) as TObject<{
        success: TLiteral<true>;
        data: TData;
        meta?: TMeta;
      }>)
    : (Type.Object({
        success: Type.Literal(true),
        data: dataSchema,
      }) as TObject<{
        success: TLiteral<true>;
        data: TData;
        meta?: TMeta;
      }>);
}

/**
 * TypeScript type inference for ErrorResponseSchema.
 *
 * @public
 */
export type ErrorResponse = Static<typeof ErrorResponseSchema>;
