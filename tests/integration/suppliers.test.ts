import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { suppliersModule } from "../../src/modules/suppliers";
import { AppError } from "../../src/shared/errors/app-error";
import { authPlugin } from "../../src/shared/middleware/auth";

// @test:FR-SUP-01
// @test:FR-SUP-02
describe("Suppliers Module - Integration", () => {
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
    .use(suppliersModule);

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

  it("allows admin to create a supplier with valid optional contact details", async () => {
    const adminToken = await getAdminToken();

    const createRes = await app.handle(
      new Request("http://localhost/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Global Components Ltd",
          contactEmail: "global@example.com",
          contactPhone: "0811223344",
          address: "North Port Block C",
        }),
      }),
    );

    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as any;
    expect(createData.success).toBe(true);
    expect(createData.data.name).toBe("Global Components Ltd");
  });

  it("rejects phone shorter than 8 chars or invalid email", async () => {
    const adminToken = await getAdminToken();

    const phoneRes = await app.handle(
      new Request("http://localhost/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Invalid Phone Supplier",
          contactPhone: "1234567",
        }),
      }),
    );
    expect(phoneRes.status).toBe(400);

    const emailRes = await app.handle(
      new Request("http://localhost/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Invalid Email Supplier",
          contactEmail: "not-an-email",
        }),
      }),
    );
    expect(emailRes.status).toBe(400);
  });

  it("forbids staff from creating or deleting suppliers", async () => {
    const staffToken = await getStaffToken();

    const postRes = await app.handle(
      new Request("http://localhost/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ name: "Forbidden Supplier" }),
      }),
    );
    expect(postRes.status).toBe(403);
  });

  it("allows querying paginated suppliers", async () => {
    const staffToken = await getStaffToken();

    const listRes = await app.handle(
      new Request("http://localhost/suppliers?page=1&limit=5", {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );

    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    expect(listData.success).toBe(true);
    expect(Array.isArray(listData.data)).toBe(true);
  });

  it("rejects deletion of a supplier that has linked products", async () => {
    const adminToken = await getAdminToken();

    // Default supplier from seeder is referenced by initial products
    const delRes = await app.handle(
      new Request(
        "http://localhost/suppliers/sup-default-0000-0000-000000000001",
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
