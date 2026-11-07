import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { hasRequiredRole } from "../../modules/auth/domain";
import { UserPayloadSchema } from "../../modules/auth/model";
import { AppError } from "../errors/app-error";

/**
 * Authentication and Authorization plugin.
 *
 * @remarks
 * This plugin registers the JWT utility and provides a `requireRole` macro.
 * The macro can be used in route definitions to enforce authentication and
 * specific role-based access control (RBAC) automatically.
 *
 * @public
 */
export const authPlugin = new Elysia({ name: "auth-plugin" })
  .use(
    jwt({
      name: "jwt",
      secret:
        process.env.JWT_SECRET ||
        "super-secret-fallback-key-change-in-production",
      schema: UserPayloadSchema,
    }),
  )
  .macro({
    /**
     * Enforces authentication and optional role-based authorization.
     *
     * @param roles - Optional array of allowed roles (e.g., ['admin', 'staff']).
     * @returns An object containing the `resolve` lifecycle hook to inject the `user` into the context.
     */
    requireRole: (roles?: ("admin" | "staff")[]) => ({
      resolve: async ({ jwt, headers }) => {
        const authHeader = headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
          throw new AppError(
            "UNAUTHORIZED",
            "Missing or invalid Authorization header",
            401,
          );
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
          throw new AppError("UNAUTHORIZED", "Missing token", 401);
        }

        const payload = await jwt.verify(token);
        if (!payload) {
          throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
        }

        if (roles && !hasRequiredRole(payload.role, roles)) {
          throw new AppError(
            "FORBIDDEN",
            `Requires one of the following roles: ${roles.join(", ")}`,
            403,
          );
        }

        return { user: payload };
      },
    }),
  });
