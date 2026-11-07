# Product Requirements Document: Inventory Stock Tracker API

## 1. System Overview & Scope
The Inventory Stock Tracker API is a type-safe REST backend engine for inventory control, movement audit trails, and stockout prevention. The system executes within the Bun runtime on a MariaDB database cluster, using strict schema-first validation and optimistic concurrency control.

---

## 2. Master Functional Requirements

### 2.1 Authentication & Session Management

#### FR-AUTH-01: User Credential Authentication
<!-- [@req:FR-AUTH-01:MUST] [@criticality:high] -->
The AuthEngine must authenticate user credentials against stored Argon2id password hashes and issue stateless HMAC-SHA256 access tokens valid for 12 hours.

Mathematical Invariant:
$$\text{verify}(\text{password}, \text{hash}_{\text{argon2id}}) \in \{\text{true}, \text{false}\}$$
$$\text{lifetime}(\text{access\_token}) = 43200\text{ seconds}$$

Happy Path:
1. Client submits POST `/auth/login` with `username` and `password`.
2. AuthEngine queries user record by unique username.
3. AuthEngine verifies password using native Argon2id verification.
4. AuthEngine generates 12-hour access token and 3-day refresh token.
5. AuthEngine records refresh token in persistence store and returns HTTP 200 OK.

Edge Cases and Failure Modes:
- Non-existent username: return HTTP 401 `UNAUTHORIZED`.
- Invalid password string: return HTTP 401 `UNAUTHORIZED`.
- Malformed request payload: return HTTP 400 `VALIDATION_ERROR`.

#### FR-AUTH-02: Cryptographic Session Refresh
<!-- [@req:FR-AUTH-02:MUST] [@criticality:high] -->
The AuthEngine must validate submitted refresh tokens against the database store, rotate the token atomically, and issue a new token pair valid for 12 hours and 3 days respectively.

Mathematical Invariant:
$$\forall t \in \text{RefreshTokens}: \text{isExpired}(t, \text{now}) \iff t.\text{expires\_at} \le \text{now}$$

Happy Path:
1. Client submits POST `/auth/refresh` with `refreshToken`.
2. AuthEngine queries database for matching token record.
3. AuthEngine validates timestamp expiration.
4. AuthEngine deletes old token and inserts rotated token in a single transaction.
5. AuthEngine returns HTTP 200 OK with new token pair.

Edge Cases and Failure Modes:
- Token not found in database: return HTTP 401 `UNAUTHORIZED`.
- Token timestamp expired: return HTTP 401 `UNAUTHORIZED`.

---

### 2.2 Category Catalog Management

#### FR-CAT-01: Category Creation
<!-- [@req:FR-CAT-01:MUST] [@criticality:medium] -->
The CategoryEngine must persist category records containing a case-insensitive unique name between 3 and 100 characters, restricted to authenticated Admin users.

Mathematical Invariant:
$$3 \le \text{length}(name) \le 100$$
$$\forall c_1, c_2 \in \text{Categories}: \text{lower}(c_1.name) = \text{lower}(c_2.name) \implies c_1.id = c_2.id$$

Happy Path:
1. Admin user submits POST `/categories` with `name` and optional `description`.
2. CategoryEngine checks uniqueness case-insensitively.
3. CategoryEngine persists category record with generated UUID v4.
4. CategoryEngine returns HTTP 201 Created with record payload.

Edge Cases and Failure Modes:
- Name length under 3 characters or over 100 characters: return HTTP 400 `VALIDATION_ERROR`.
- Non-admin user authentication: return HTTP 403 `FORBIDDEN`.
- Duplicate category name case-insensitively: return HTTP 409 `CONFLICT`.

#### FR-CAT-02: Category Catalog Query
<!-- [@req:FR-CAT-02:MUST] [@criticality:low] -->
The CategoryEngine must return paginated category lists ordered by creation date, accessible to Admin and Staff roles.

Mathematical Invariant:
$$1 \le page \le \lceil total / limit \rceil$$
$$1 \le limit \le 100$$

Happy Path:
1. Authenticated user submits GET `/categories` with optional `page` and `limit`.
2. CategoryEngine applies default bounds (`page=1`, `limit=10`).
3. CategoryEngine queries database count and offset slice.
4. CategoryEngine returns HTTP 200 OK with data array and pagination metadata.

Edge Cases and Failure Modes:
- Missing authorization header: return HTTP 401 `UNAUTHORIZED`.
- Invalid pagination numbers: return HTTP 400 `VALIDATION_ERROR`.

#### FR-CAT-03: Category Mutation & Deletion
<!-- [@req:FR-CAT-03:MUST] [@criticality:medium] -->
The CategoryEngine must update category attributes and reject deletion of categories that have linked product records via foreign key restriction.

Mathematical Invariant:
$$\forall c \in \text{Categories}: (\exists p \in \text{Products}: p.category\_id = c.id) \implies \text{deletable}(c) = \text{false}$$

Happy Path:
1. Admin user submits DELETE `/categories/:id`.
2. CategoryEngine checks for referenced products in database.
3. If no referenced products exist, CategoryEngine deletes record and returns HTTP 200 OK.

Edge Cases and Failure Modes:
- Category ID does not exist: return HTTP 404 `NOT_FOUND`.
- Category referenced by one or more products: return HTTP 409 `CONFLICT`.
- Non-admin user authentication: return HTTP 403 `FORBIDDEN`.

---

### 2.3 Supplier Catalog Management

#### FR-SUP-01: Supplier Creation
<!-- [@req:FR-SUP-01:MUST] [@criticality:medium] -->
The SupplierEngine must create supplier records with mandatory name between 2 and 150 characters, optional valid email format, and optional phone numbers of at least 8 characters.

Mathematical Invariant:
$$2 \le \text{length}(name) \le 150$$
$$\forall s \in \text{Suppliers}: s.phone \ne \text{null} \implies \text{length}(s.phone) \ge 8$$

Happy Path:
1. Admin user submits POST `/suppliers` with `name`, optional `contactEmail`, `contactPhone`, and `address`.
2. SupplierEngine validates string length constraints and formats.
3. SupplierEngine persists supplier record with UUID v4.
4. SupplierEngine returns HTTP 201 Created with record payload.

Edge Cases and Failure Modes:
- Name length under 2 characters or over 150 characters: return HTTP 400 `VALIDATION_ERROR`.
- Phone string provided with fewer than 8 characters: return HTTP 400 `VALIDATION_ERROR`.
- Invalid email format string: return HTTP 400 `VALIDATION_ERROR`.
- Non-admin user authentication: return HTTP 403 `FORBIDDEN`.

#### FR-SUP-02: Supplier Catalog Query & Deletion
<!-- [@req:FR-SUP-02:MUST] [@criticality:medium] -->
The SupplierEngine must return paginated supplier records and enforce foreign key deletion restriction against suppliers linked to products.

Mathematical Invariant:
$$\forall s \in \text{Suppliers}: (\exists p \in \text{Products}: p.supplier\_id = s.id) \implies \text{deletable}(s) = \text{false}$$

Happy Path:
1. User queries GET `/suppliers` with pagination parameters.
2. SupplierEngine returns HTTP 200 OK with supplier collection.
3. Admin submits DELETE `/suppliers/:id` for unreferenced supplier.
4. SupplierEngine deletes record and returns HTTP 200 OK.

Edge Cases and Failure Modes:
- Supplier referenced by active products: return HTTP 409 `CONFLICT`.
- Supplier ID not found: return HTTP 404 `NOT_FOUND`.
- Non-admin deletion attempt: return HTTP 403 `FORBIDDEN`.

---

### 2.4 Product Inventory Catalog

#### FR-PROD-01: Product Registration
<!-- [@req:FR-PROD-01:MUST] [@criticality:high] -->
The ProductEngine must persist product records with unique SKU, positive price, non-negative quantity, alert threshold, mandatory category relation, and mandatory supplier relation.

Mathematical Invariant:
$$price > 0 \land quantity \ge 0 \land low\_stock\_threshold \ge 0$$
$$\forall p \in \text{Products}: p.category\_id \in \text{Categories.id} \land p.supplier\_id \in \text{Suppliers.id}$$

Happy Path:
1. Admin user submits POST `/products` with `sku`, `name`, `price`, `quantity`, `lowStockThreshold`, `categoryId`, and `supplierId`.
2. ProductEngine verifies existence of `categoryId` and `supplierId`.
3. ProductEngine verifies SKU uniqueness.
4. ProductEngine inserts product record with monotonic `version = 1`.
5. ProductEngine returns HTTP 201 Created.

Edge Cases and Failure Modes:
- Duplicate SKU submitted: return HTTP 409 `CONFLICT`.
- Non-existent `categoryId` or `supplierId`: return HTTP 404 `NOT_FOUND`.
- Negative numerical values: return HTTP 400 `VALIDATION_ERROR`.
- Non-admin role: return HTTP 403 `FORBIDDEN`.

#### FR-PROD-02: Product Search & Pagination
<!-- [@req:FR-PROD-02:MUST] [@criticality:medium] -->
The ProductEngine must retrieve paginated product records supporting case-insensitive literal substring filtering across name and SKU fields.

Mathematical Invariant:
$$\text{totalPages} = \max(1, \lceil total / limit \rceil)$$

Happy Path:
1. User queries GET `/products?search=gadget&page=1&limit=10`.
2. ProductEngine escapes wildcard characters in query filter.
3. ProductEngine queries matched count and paginated items.
4. ProductEngine returns HTTP 200 OK with metadata envelope.

Edge Cases and Failure Modes:
- Page number less than 1: return HTTP 400 `VALIDATION_ERROR`.
- Limit number greater than 100: return HTTP 400 `VALIDATION_ERROR`.

#### FR-PROD-03: Product Mutation & Deletion
<!-- [@req:FR-PROD-03:MUST] [@criticality:high] -->
The ProductEngine must update product catalog attributes and restrict deletion of products possessing stock adjustment audit history.

Mathematical Invariant:
$$\forall p \in \text{Products}: (\exists a \in \text{StockAdjustments}: a.product\_id = p.id) \implies \text{deletable}(p) = \text{false}$$

Happy Path:
1. Admin submits PUT `/products/:id` with updated fields.
2. ProductEngine updates record and returns HTTP 200 OK.
3. Admin submits DELETE `/products/:id` on product without movements.
4. ProductEngine deletes product and returns HTTP 200 OK.

Edge Cases and Failure Modes:
- Product ID not found: return HTTP 404 `NOT_FOUND`.
- Product has linked stock adjustments: return HTTP 409 `CONFLICT`.
- Non-admin user: return HTTP 403 `FORBIDDEN`.

#### FR-PROD-04: Low-Stock Inventory Alerts
<!-- [@req:FR-PROD-04:MUST] [@criticality:high] -->
The ProductEngine must filter and return all products where current stock quantity is less than or equal to the designated low stock alert threshold.

Mathematical Invariant:
$$\text{Results} = \{p \in \text{Products} \mid p.quantity \le p.low\_stock\_threshold\}$$

Happy Path:
1. Authenticated user submits GET `/products/low-stock` with pagination query.
2. ProductEngine queries database where `quantity <= low_stock_threshold`.
3. ProductEngine returns HTTP 200 OK with paginated low-stock items.

Edge Cases and Failure Modes:
- Missing authentication token: return HTTP 401 `UNAUTHORIZED`.

---

### 2.5 Stock Movement & Audit Logging

#### FR-STK-01: Stock Adjustment Execution
<!-- [@req:FR-STK-01:MUST] [@criticality:high] -->
The StockEngine must execute atomic stock increments and decrements within an ACID transaction, enforcing optimistic version increments, mandatory audit logs, and 24-hour idempotent request deduplication.

Mathematical Invariant:
$$\Delta(quantity) = \begin{cases} +k, & \text{if } type = \text{"IN"} \\ -k, & \text{if } type = \text{"OUT"} \land current \ge k \end{cases}$$
$$version_{t+1} = version_t + 1$$

Happy Path:
1. User submits POST `/stock/adjust` with `Idempotency-Key` header and payload (`productId`, `type`, `quantity`, `reason`).
2. StockEngine checks idempotency persistence store.
3. StockEngine opens database transaction.
4. StockEngine verifies product existence and stock sufficiency.
5. StockEngine executes atomic update: `quantity = quantity ± ?, version = version + 1 WHERE id = ? AND version = ?`.
6. StockEngine writes immutable record to `stock_adjustments`.
7. StockEngine caches response payload in `idempotency_keys` with 24-hour TTL.
8. StockEngine commits transaction and returns HTTP 200 OK.

Edge Cases and Failure Modes:
- Missing `Idempotency-Key` header: return HTTP 400 `VALIDATION_ERROR`.
- Reason length shorter than 5 or longer than 255 characters: return HTTP 400 `VALIDATION_ERROR`.
- Deduplication key resubmitted with modified payload hash: return HTTP 409 `CONFLICT`.
- Deduction quantity exceeds available stock: return HTTP 422 `BUSINESS_RULE_VIOLATION`.
- Concurrent update detected via affected rows zero: return HTTP 409 `CONFLICT`.

#### FR-STK-02: Stock Movement Audit History
<!-- [@req:FR-STK-02:MUST] [@criticality:medium] -->
The StockEngine must retrieve chronological paginated audit trails for a specified product ID, ordered from newest to oldest.

Mathematical Invariant:
$$\text{Order} = \text{createdAt DESC}$$

Happy Path:
1. User queries GET `/stock/history/:productId` with pagination parameters.
2. StockEngine validates product existence.
3. StockEngine retrieves movement records for product.
4. StockEngine returns HTTP 200 OK with audit collection.

Edge Cases and Failure Modes:
- Non-existent product ID: return HTTP 404 `NOT_FOUND`.

---

### 2.6 System Health Observability

#### FR-HLTH-01: Database Connectivity Health Probe
<!-- [@req:FR-HLTH-01:MUST] [@criticality:medium] -->
The HealthEngine must execute a low-overhead probe query against the database cluster and report connectivity status.

Mathematical Invariant:
$$\text{Status} = \begin{cases} \text{"ok"}, & \text{if } \text{SELECT 1 succeeds} \\ \text{"error"}, & \text{if query fails or times out} \end{cases}$$

Happy Path:
1. Monitoring agent calls GET `/health`.
2. HealthEngine executes `SELECT 1` on MariaDB pool.
3. HealthEngine returns HTTP 200 OK with status and uptime payload.

Edge Cases and Failure Modes:
- Database connection failure: return HTTP 503 `SERVICE_UNAVAILABLE`.
