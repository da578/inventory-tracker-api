# Technical Design Document: Inventory Stock Tracker API

## 1. Architectural Architecture & Module Topology
The application is structured as a Modular Monolith with a Functional Core, Imperative Shell (FC/IS) pattern. Pure domain functions isolate business rules without side-effects, while services manage transactions and persistence via Drizzle ORM on MariaDB.

---

## 2. Requirement Design Mappings

### 2.1 Authentication Subsystem

#### FR-AUTH-01 Design Mapping
<!-- [@design:FR-AUTH-01] -->
- **Component**: `src/modules/auth/service.ts` and `src/modules/auth/index.ts`
- **Functional Core**: `src/modules/auth/domain.ts` (`calculateTokenExpiry`)
- **Transport**: Elysia POST `/auth/login` and POST `/auth/register`
- **Persistence**: Table `users` in MariaDB with Argon2id native password verification.

#### FR-AUTH-02 Design Mapping
<!-- [@design:FR-AUTH-02] -->
- **Component**: `src/modules/auth/service.ts`
- **Functional Core**: `src/modules/auth/domain.ts` (`isTokenExpired`)
- **Transport**: Elysia POST `/auth/refresh`
- **Persistence**: Table `refresh_tokens` in MariaDB with atomic single-transaction token rotation.

---

### 2.2 Category Catalog Subsystem

#### FR-CAT-01 Design Mapping
<!-- [@design:FR-CAT-01] -->
- **Component**: `src/modules/categories/service.ts` and `src/modules/categories/index.ts`
- **Functional Core**: `src/modules/categories/domain.ts` (`validateCategoryName`)
- **Transport**: Elysia POST `/categories` guarded by `requireRole(["admin"])`
- **Persistence**: Table `categories` in MariaDB with `utf8mb4_unicode_ci` case-insensitive unique key.

#### FR-CAT-02 Design Mapping
<!-- [@design:FR-CAT-02] -->
- **Component**: `src/modules/categories/service.ts` and `src/modules/categories/index.ts`
- **Functional Core**: `src/modules/products/domain.ts` (`calculatePaginationMeta`)
- **Transport**: Elysia GET `/categories` guarded by `requireRole(["admin", "staff"])`
- **Persistence**: Table `categories` with limit and offset query pagination.

#### FR-CAT-03 Design Mapping
<!-- [@design:FR-CAT-03] -->
- **Component**: `src/modules/categories/service.ts` and `src/modules/categories/index.ts`
- **Transport**: Elysia PUT `/categories/:id` and DELETE `/categories/:id`
- **Persistence**: Table `categories` with foreign key restriction handling (`ER_ROW_IS_REFERENCED_2` mapped to HTTP 409).

---

### 2.3 Supplier Catalog Subsystem

#### FR-SUP-01 Design Mapping
<!-- [@design:FR-SUP-01] -->
- **Component**: `src/modules/suppliers/service.ts` and `src/modules/suppliers/index.ts`
- **Functional Core**: `src/modules/suppliers/domain.ts` (`validateSupplierContact`, `validateSupplierName`)
- **Transport**: Elysia POST `/suppliers` guarded by `requireRole(["admin"])`
- **Persistence**: Table `suppliers` with validated email and telephone length constraints.

#### FR-SUP-02 Design Mapping
<!-- [@design:FR-SUP-02] -->
- **Component**: `src/modules/suppliers/service.ts` and `src/modules/suppliers/index.ts`
- **Functional Core**: `src/modules/products/domain.ts` (`calculatePaginationMeta`)
- **Transport**: Elysia GET `/suppliers` and DELETE `/suppliers/:id`
- **Persistence**: Table `suppliers` with foreign key restriction preventing deletion of active product suppliers.

---

### 2.4 Product Inventory Subsystem

#### FR-PROD-01 Design Mapping
<!-- [@design:FR-PROD-01] -->
- **Component**: `src/modules/products/service.ts` and `src/modules/products/index.ts`
- **Transport**: Elysia POST `/products` guarded by `requireRole(["admin"])`
- **Persistence**: Table `products` with mandatory foreign key references `categoryId` to `categories.id` and `supplierId` to `suppliers.id`.

#### FR-PROD-02 Design Mapping
<!-- [@design:FR-PROD-02] -->
- **Component**: `src/modules/products/service.ts`
- **Functional Core**: `src/modules/products/domain.ts` (`calculatePaginationMeta`, `escapeLikePattern`)
- **Transport**: Elysia GET `/products` with search query sanitization.
- **Persistence**: Table `products` with Drizzle `like` filtering across name and SKU.

#### FR-PROD-03 Design Mapping
<!-- [@design:FR-PROD-03] -->
- **Component**: `src/modules/products/service.ts`
- **Transport**: Elysia PUT `/products/:id` and DELETE `/products/:id`
- **Persistence**: Table `products` catching foreign key constraint errors when linked to `stock_adjustments`.

#### FR-PROD-04 Design Mapping
<!-- [@design:FR-PROD-04] -->
- **Component**: `src/modules/products/service.ts`
- **Functional Core**: `src/modules/products/domain.ts` (`isLowStock`)
- **Transport**: Elysia GET `/products/low-stock`
- **Persistence**: Table `products` filtered by `quantity <= low_stock_threshold`.

---

### 2.5 Stock Movement & Audit Subsystem

#### FR-STK-01 Design Mapping
<!-- [@design:FR-STK-01] -->
- **Component**: `src/modules/stock-adjustments/service.ts`
- **Functional Core**: `src/modules/stock-adjustments/domain.ts` (`calculateNewQuantity`, `validateStockAvailability`, `validateAdjustmentReason`)
- **Transport**: Elysia POST `/stock/adjust` with required `Idempotency-Key` header
- **Persistence**: Tables `products`, `stock_adjustments`, and `idempotency_keys` updated inside a MariaDB ACID transaction with version increment.

#### FR-STK-02 Design Mapping
<!-- [@design:FR-STK-02] -->
- **Component**: `src/modules/stock-adjustments/service.ts`
- **Functional Core**: `src/modules/products/domain.ts` (`calculatePaginationMeta`)
- **Transport**: Elysia GET `/stock/history/:productId`
- **Persistence**: Table `stock_adjustments` queried with `createdAt DESC` ordering.

---

### 2.6 Health Observability Subsystem

#### FR-HLTH-01 Design Mapping
<!-- [@design:FR-HLTH-01] -->
- **Component**: `src/modules/health/index.ts`
- **Transport**: Elysia GET `/health`
- **Persistence**: Executes `SELECT 1` on MariaDB pool connection.
