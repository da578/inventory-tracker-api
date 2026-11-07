import { eq } from "drizzle-orm";
import { db } from "../../db";
import { refreshTokens, users } from "../../db/schema";
import { AppError } from "../../shared/errors/app-error";
import { calculateTokenExpiry, isTokenExpired } from "./domain";
import type { LoginBody, RegisterBody, UserPayload } from "./model";

const REFRESH_TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Interface representing JWT sign and verify operations.
 *
 * @public
 */
export interface JwtHandler {
  sign: (
    payload: UserPayload & {
      nbf?: string | number;
      exp?: string | number;
      iat?: boolean;
      iss?: string;
      sub?: string;
      aud?: string | string[];
      jti?: string;
    },
  ) => Promise<string>;
  verify: (token?: string) => Promise<unknown>;
}

/**
 * Authentication service encapsulating user registration, argon2id authentication,
 * and JWT refresh token rotation lifecycle.
 *
 * @remarks
 * ponytail: Refresh tokens are rotated on each use. Upgrade to family revocation / reuse detection if multi-device token tracking is required.
 *
 * @public
 */
// @impl:FR-AUTH-01
// @impl:FR-AUTH-02
export const authService = {
  /**
   * Registers a new user with Argon2id password hashing.
   *
   * @param input - Registration payload containing username, password, and role.
   * @returns Created user summary without sensitive hash data.
   */
  async register(input: RegisterBody): Promise<{
    id: string;
    username: string;
    role: "admin" | "staff";
    createdAt: Date;
  }> {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, input.username))
      .limit(1);

    if (existing) {
      throw new AppError("CONFLICT", "Username already exists", 409);
    }

    const passwordHash = await Bun.password.hash(input.password, {
      algorithm: "argon2id",
    });

    const id = crypto.randomUUID();
    const createdAt = new Date();

    try {
      await db.insert(users).values({
        id,
        username: input.username,
        passwordHash,
        role: input.role,
        createdAt,
      });
    } catch (err: unknown) {
      const errorMsg = String(err);
      if (
        errorMsg.includes("ER_DUP_ENTRY") ||
        errorMsg.includes("Duplicate entry")
      ) {
        throw new AppError("CONFLICT", "Username already exists", 409);
      }
      throw err;
    }

    return {
      id,
      username: input.username,
      role: input.role,
      createdAt,
    };
  },

  /**
   * Verifies user credentials, issues access/refresh tokens, and persists the refresh token.
   *
   * @param input - Login credentials.
   * @param jwt - JWT handler for signing tokens.
   * @returns Tokens and user payload.
   */
  async login(
    input: LoginBody,
    jwt: JwtHandler,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserPayload;
  }> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, input.username))
      .limit(1);

    if (!user) {
      throw new AppError("UNAUTHORIZED", "Invalid username or password", 401);
    }

    const isValid = await Bun.password.verify(
      input.password,
      user.passwordHash,
    );
    if (!isValid) {
      throw new AppError("UNAUTHORIZED", "Invalid username or password", 401);
    }

    const userPayload: UserPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = await jwt.sign({
      ...userPayload,
      jti: crypto.randomUUID(),
      exp: "12h",
    });

    const refreshToken = await jwt.sign({
      ...userPayload,
      jti: crypto.randomUUID(),
      exp: "3d",
    });

    const expiresAt = calculateTokenExpiry(REFRESH_TOKEN_TTL_MS);

    await db.insert(refreshTokens).values({
      id: crypto.randomUUID(),
      userId: user.id,
      token: refreshToken,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: userPayload,
    };
  },

  /**
   * Validates refresh token, rotates it in the database, and issues a new access/refresh pair.
   *
   * @param token - Existing refresh token.
   * @param jwt - JWT handler for verifying and signing tokens.
   * @returns Newly generated access token and rotated refresh token.
   */
  async refresh(
    token: string,
    jwt: JwtHandler,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = (await jwt.verify(token)) as UserPayload | false;
    if (!payload) {
      throw new AppError(
        "UNAUTHORIZED",
        "Invalid or expired refresh token",
        401,
      );
    }

    const [record] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token))
      .limit(1);

    if (!record) {
      throw new AppError(
        "UNAUTHORIZED",
        "Invalid or expired refresh token",
        401,
      );
    }

    if (isTokenExpired(new Date(record.expiresAt))) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, record.id));
      throw new AppError(
        "UNAUTHORIZED",
        "Invalid or expired refresh token",
        401,
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, record.userId))
      .limit(1);

    if (!user) {
      throw new AppError("UNAUTHORIZED", "User not found", 401);
    }

    const userPayload: UserPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = await jwt.sign({
      ...userPayload,
      jti: crypto.randomUUID(),
      exp: "12h",
    });

    const newRefreshToken = await jwt.sign({
      ...userPayload,
      jti: crypto.randomUUID(),
      exp: "3d",
    });

    const expiresAt = calculateTokenExpiry(REFRESH_TOKEN_TTL_MS);

    // Rotate token: revoke old token and insert new active token
    await db.delete(refreshTokens).where(eq(refreshTokens.id, record.id));
    await db.insert(refreshTokens).values({
      id: crypto.randomUUID(),
      userId: user.id,
      token: newRefreshToken,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  },
};
