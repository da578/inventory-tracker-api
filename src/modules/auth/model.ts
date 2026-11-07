import { t } from "elysia";

/**
 * Schema for JWT token payload and authenticated user identity.
 *
 * @remarks
 * Used by authPlugin to sign and verify JWT tokens and inject `user` into Elysia context.
 *
 * @public
 */
export const UserPayloadSchema = t.Object({
  id: t.String(),
  username: t.String(),
  role: t.Union([t.Literal("admin"), t.Literal("staff")]),
});

/**
 * Type inferred from UserPayloadSchema.
 *
 * @public
 */
export type UserPayload = typeof UserPayloadSchema.static;

/**
 * Schema for user registration request body.
 *
 * @public
 */
export const RegisterBodySchema = t.Object({
  username: t.String({ minLength: 1, maxLength: 255 }),
  password: t.String({ minLength: 1 }),
  role: t.Union([t.Literal("admin"), t.Literal("staff")]),
});

/**
 * Type inferred from RegisterBodySchema.
 *
 * @public
 */
export type RegisterBody = typeof RegisterBodySchema.static;

/**
 * Schema for user login request body.
 *
 * @public
 */
export const LoginBodySchema = t.Object({
  username: t.String({ minLength: 1 }),
  password: t.String({ minLength: 1 }),
});

/**
 * Type inferred from LoginBodySchema.
 *
 * @public
 */
export type LoginBody = typeof LoginBodySchema.static;

/**
 * Schema for refresh token request body.
 *
 * @public
 */
export const RefreshBodySchema = t.Object({
  refreshToken: t.String({ minLength: 1 }),
});

/**
 * Type inferred from RefreshBodySchema.
 *
 * @public
 */
export type RefreshBody = typeof RefreshBodySchema.static;
