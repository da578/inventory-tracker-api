import { describe, expect, it } from "bun:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { refreshTokens, stockAdjustments } from "../../src/db/schema";

describe("Database schema", () => {
  describe("refreshTokens", () => {
    it("is defined and named refresh_tokens", () => {
      expect(refreshTokens).toBeDefined();
      expect(getTableName(refreshTokens)).toBe("refresh_tokens");
    });

    it("has expected columns with correct configurations", () => {
      const columns = getTableColumns(refreshTokens);
      expect(columns.id).toBeDefined();
      expect(columns.id.primary).toBe(true);

      expect(columns.userId).toBeDefined();
      expect(columns.userId.notNull).toBe(true);

      expect(columns.token).toBeDefined();
      expect(columns.token.notNull).toBe(true);

      expect(columns.expiresAt).toBeDefined();
      expect(columns.expiresAt.notNull).toBe(true);

      expect(columns.createdAt).toBeDefined();
      expect(columns.createdAt.notNull).toBe(true);
    });

    it("has foreign key reference to users.id with cascade delete", () => {
      const fks = (refreshTokens as unknown as Record<symbol, unknown>)[
        Symbol.for("drizzle:MySqlInlineForeignKeys")
      ] as Array<{
        reference: () => {
          columns: Array<{ name: string }>;
          foreignColumns: Array<{ name: string }>;
        };
        onDelete?: string;
      }>;

      expect(fks).toBeDefined();
      const userFk = fks.find((fk) =>
        fk.reference().columns.some((c) => c.name === "user_id"),
      );
      expect(userFk).toBeDefined();
      expect(userFk?.onDelete).toBe("cascade");
    });
  });

  describe("stockAdjustments", () => {
    it("has productId foreign key reference with restrict delete", () => {
      const fks = (stockAdjustments as unknown as Record<symbol, unknown>)[
        Symbol.for("drizzle:MySqlInlineForeignKeys")
      ] as Array<{
        reference: () => {
          columns: Array<{ name: string }>;
          foreignColumns: Array<{ name: string }>;
        };
        onDelete?: string;
      }>;

      expect(fks).toBeDefined();
      const productFk = fks.find((fk) =>
        fk.reference().columns.some((c) => c.name === "product_id"),
      );
      expect(productFk).toBeDefined();
      expect(productFk?.onDelete).toBe("restrict");
    });
  });
});
