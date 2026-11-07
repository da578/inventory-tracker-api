import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { like } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "../../src/db";
import { refreshTokens, users } from "../../src/db/schema";
import { authModule } from "../../src/modules/auth";
import { AppError } from "../../src/shared/errors/app-error";
import { authPlugin } from "../../src/shared/middleware/auth";

// @test:FR-AUTH-01
// @test:FR-AUTH-02
describe("Auth Module", () => {
  const app = new Elysia()
    .error({ AppError })
    .onError(({ code, error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }

      if (code === "VALIDATION") {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request payload",
          },
        };
      }
    })
    .use(authPlugin)
    .use(authModule);

  const testPrefix = `test_auth_${Date.now()}`;
  const testUser = {
    username: `${testPrefix}_alice`,
    password: "Password123!",
    role: "admin" as const,
  };

  const cleanup = async () => {
    await db.delete(users).where(like(users.username, `${testPrefix}%`));
  };

  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("POST /auth/register", () => {
    it("successfully registers a new user with argon2id hash", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testUser),
        }),
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        success: boolean;
        data: {
          id: string;
          username: string;
          role: string;
          createdAt: string;
        };
      };

      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.username).toBe(testUser.username);
      expect(body.data.role).toBe(testUser.role);
      expect(body.data.createdAt).toBeDefined();

      // Check DB entry and argon2id hash
      const [dbUser] = await db
        .select()
        .from(users)
        .where(like(users.username, testUser.username))
        .limit(1);

      expect(dbUser).toBeDefined();
      expect(dbUser.passwordHash.startsWith("$argon2id$")).toBe(true);
      const isPasswordValid = await Bun.password.verify(
        testUser.password,
        dbUser.passwordHash,
      );
      expect(isPasswordValid).toBe(true);
    });

    it("rejects duplicate username with 409 Conflict", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testUser),
        }),
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CONFLICT");
    });

    it("rejects registration with invalid role", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: `${testPrefix}_invalid`,
            password: "password123",
            role: "superman",
          }),
        }),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /auth/login", () => {
    it("successfully logs in, issues tokens and records refresh token", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: testUser.username,
            password: testUser.password,
          }),
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: {
          accessToken: string;
          refreshToken: string;
          user: { id: string; username: string; role: string };
        };
      };

      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.user.username).toBe(testUser.username);
      expect(body.data.user.role).toBe(testUser.role);

      // Verify refresh token in DB
      const [tokenRecord] = await db
        .select()
        .from(refreshTokens)
        .where(like(refreshTokens.token, body.data.refreshToken))
        .limit(1);

      expect(tokenRecord).toBeDefined();
      expect(tokenRecord.userId).toBe(body.data.user.id);
    });

    it("rejects login with wrong password (401)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: testUser.username,
            password: "WrongPassword!",
          }),
        }),
      );

      expect(res.status).toBe(401);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects login for non-existent user (401)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: `${testPrefix}_nonexistent`,
            password: "Password123!",
          }),
        }),
      );

      expect(res.status).toBe(401);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("POST /auth/refresh", () => {
    it("successfully refreshes token and rotates refresh token in DB", async () => {
      // Login first
      const loginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: testUser.username,
            password: testUser.password,
          }),
        }),
      );
      const loginBody = (await loginRes.json()) as {
        data: { refreshToken: string };
      };
      const initialRefreshToken = loginBody.data.refreshToken;

      // Refresh
      const refreshRes = await app.handle(
        new Request("http://localhost/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: initialRefreshToken }),
        }),
      );

      expect(refreshRes.status).toBe(200);
      const refreshBody = (await refreshRes.json()) as {
        success: boolean;
        data: { accessToken: string; refreshToken: string };
      };

      expect(refreshBody.success).toBe(true);
      expect(refreshBody.data.accessToken).toBeDefined();
      expect(refreshBody.data.refreshToken).toBeDefined();
      expect(refreshBody.data.refreshToken).not.toBe(initialRefreshToken);

      // Verify new token exists in DB
      const [newRecord] = await db
        .select()
        .from(refreshTokens)
        .where(like(refreshTokens.token, refreshBody.data.refreshToken))
        .limit(1);
      expect(newRecord).toBeDefined();

      // Verify old token is no longer in DB
      const [oldRecord] = await db
        .select()
        .from(refreshTokens)
        .where(like(refreshTokens.token, initialRefreshToken))
        .limit(1);
      expect(oldRecord).toBeUndefined();

      // Attempting to reuse old refresh token must fail (401)
      const reuseRes = await app.handle(
        new Request("http://localhost/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: initialRefreshToken }),
        }),
      );
      expect(reuseRes.status).toBe(401);
    });

    it("rejects invalid refresh token with 401", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: "invalid.token.here" }),
        }),
      );

      expect(res.status).toBe(401);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects expired refresh token in database with 401", async () => {
      // Create user and expired token
      const expiredUser = {
        id: crypto.randomUUID(),
        username: `${testPrefix}_expired_user`,
        passwordHash: "hash",
        role: "staff" as const,
      };
      await db.insert(users).values(expiredUser);

      // Sign token that is still valid JWT signature but expired in DB record
      const token = await (
        app as unknown as {
          decorator: {
            jwt: { sign: (p: Record<string, unknown>) => Promise<string> };
          };
        }
      ).decorator.jwt.sign({
        id: expiredUser.id,
        username: expiredUser.username,
        role: expiredUser.role,
        exp: "1h",
      });

      const tokenId = crypto.randomUUID();
      await db.insert(refreshTokens).values({
        id: tokenId,
        userId: expiredUser.id,
        token,
        expiresAt: new Date(Date.now() - 10000), // in the past
      });

      const res = await app.handle(
        new Request("http://localhost/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: token }),
        }),
      );

      expect(res.status).toBe(401);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");

      // Verify expired token got cleaned up
      const [remaining] = await db
        .select()
        .from(refreshTokens)
        .where(like(refreshTokens.id, tokenId))
        .limit(1);
      expect(remaining).toBeUndefined();
    });
  });

  describe("GET /auth/me", () => {
    it("returns user data for authenticated user with Bearer token", async () => {
      const loginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: testUser.username,
            password: testUser.password,
          }),
        }),
      );
      const loginBody = (await loginRes.json()) as {
        data: { accessToken: string };
      };
      const token = loginBody.data.accessToken;

      const res = await app.handle(
        new Request("http://localhost/auth/me", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { user: { username: string; role: string } };
      };

      expect(body.success).toBe(true);
      expect(body.data.user.username).toBe(testUser.username);
      expect(body.data.user.role).toBe(testUser.role);
    });

    it("rejects request without Authorization header (401)", async () => {
      const res = await app.handle(new Request("http://localhost/auth/me"));

      expect(res.status).toBe(401);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects request with invalid token (401)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/me", {
          method: "GET",
          headers: { Authorization: "Bearer bad-token" },
        }),
      );

      expect(res.status).toBe(401);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
