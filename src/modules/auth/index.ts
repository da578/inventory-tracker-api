import { Elysia } from "elysia";
import { authPlugin } from "../../shared/middleware/auth";
import {
  LoginBodySchema,
  RefreshBodySchema,
  RegisterBodySchema,
} from "./model";
import { authService } from "./service";

export * from "./domain";
export * from "./model";
export * from "./service";

/**
 * Elysia module handling user authentication and token management.
 *
 * @remarks
 * Exposes endpoints for user registration, Argon2id credential verification,
 * JWT token refresh with database-backed rotation, and current user profile retrieval.
 *
 * @public
 */
export const authModule = new Elysia({ prefix: "/auth" })
  .use(authPlugin)
  .post(
    "/register",
    async ({ body, set }) => {
      const data = await authService.register(body);
      set.status = 201;
      return {
        success: true,
        data,
      };
    },
    {
      body: RegisterBodySchema,
      detail: {
        tags: ["Auth"],
        summary: "Register a new user",
      },
    },
  )
  .post(
    "/login",
    async ({ body, jwt }) => {
      const data = await authService.login(body, jwt);
      return {
        success: true,
        data,
      };
    },
    {
      body: LoginBodySchema,
      detail: {
        tags: ["Auth"],
        summary: "Log in with username and password",
      },
    },
  )
  .post(
    "/refresh",
    async ({ body, jwt }) => {
      const data = await authService.refresh(body.refreshToken, jwt);
      return {
        success: true,
        data,
      };
    },
    {
      body: RefreshBodySchema,
      detail: {
        tags: ["Auth"],
        summary: "Refresh access token and rotate refresh token",
      },
    },
  )
  .get(
    "/me",
    ({ user }) => {
      return {
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
          },
        },
      };
    },
    {
      requireRole: ["admin", "staff"],
      detail: {
        tags: ["Auth"],
        summary: "Get current authenticated user profile",
      },
    },
  );
