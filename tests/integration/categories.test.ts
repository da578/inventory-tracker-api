import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { categoriesModule } from "../../src/modules/categories";
import { AppError } from "../../src/shared/errors/app-error";
import { authPlugin } from "../../src/shared/middleware/auth";

// @test:FR-CAT-01
// @test:FR-CAT-02
// @test:FR-CAT-03
describe("Categories Module - Integration", () => {
  const app = new Elysia()
    .error({ AppError })
    .onError(({ error, set }) => {
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
    })
    .use(authPlugin)
    .use(categoriesModule);

  const getAdminToken = async () => {
    const authApp = new Elysia().use(authPlugin);
    const jwt = (authApp as any).decorator?.jwt;
    return await jwt.sign({
      id: "admin-id-123",
      username: "admin",
      role: "admin",
    });
  };

  const getStaffToken = async () => {
    const authApp = new Elysia().use(authPlugin);
    const jwt = (authApp as any).decorator?.jwt;
    return await jwt.sign({
      id: "staff-id-123",
      username: "staff",
      role: "staff",
    });
  };

  it("allows admin to create a category and enforces case-insensitive uniqueness", async () => {
    const adminToken = await getAdminToken();
    const uniqueSuffix = Date.now().toString().slice(-4);
    const categoryName = `Tools-${uniqueSuffix}`;

    const createRes = await app.handle(
      new Request("http://localhost/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: categoryName,
          description: "Testing category",
        }),
      }),
    );

    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as any;
    expect(createData.success).toBe(true);
    expect(createData.data.name).toBe(categoryName);

    // Case-insensitive duplicate attempt
    const dupRes = await app.handle(
      new Request("http://localhost/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: categoryName.toLowerCase(),
          description: "Duplicate attempt",
        }),
      }),
    );

    expect(dupRes.status).toBe(409);
  });

  it("forbids staff from creating, updating, or deleting categories", async () => {
    const staffToken = await getStaffToken();

    const postRes = await app.handle(
      new Request("http://localhost/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ name: "Forbidden Cat" }),
      }),
    );
    expect(postRes.status).toBe(403);

    const deleteRes = await app.handle(
      new Request("http://localhost/categories/any-id", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(deleteRes.status).toBe(403);
  });

  it("allows staff and admin to query paginated categories", async () => {
    const staffToken = await getStaffToken();

    const listRes = await app.handle(
      new Request("http://localhost/categories?page=1&limit=5", {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );

    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    expect(listData.success).toBe(true);
    expect(Array.isArray(listData.data)).toBe(true);
    expect(listData.meta.page).toBe(1);
    expect(listData.meta.limit).toBe(5);
  });

  it("rejects deletion of a category that has linked products", async () => {
    const adminToken = await getAdminToken();

    // Default category from seeder is referenced by initial products
    const delRes = await app.handle(
      new Request(
        "http://localhost/categories/cat-default-0000-0000-000000000001",
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      ),
    );

    expect(delRes.status).toBe(409);
    const delData = (await delRes.json()) as any;
    expect(delData.error.code).toBe("CONFLICT");
  });
});
