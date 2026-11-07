# Comprehensive Operations and Developer Manual: Inventory Stock Tracker API

## Reader Navigation Map

| Persona | Primary Goal | Recommended Section |
| :--- | :--- | :--- |
| **New Developers** | Quick installation and system onboarding | [Part I: 5-Minute Quickstart](#part-i-onboarding-mental-model-and-5-minute-quickstart) |
| **Frontend / API Integrators** | Endpoints, authentication, and error handling | [Part II: Application Developer Cookbook](#part-ii-application-developer-cookbook) |
| **System Administrators** | Database migrations, seeding, backup, and health monitoring | [Part III: Operator Runbook and Maintenance](#part-iii-operator-runbook-and-maintenance) |
| **Architects & Engineers** | Concurrency control, domain purity, and data flow lifelines | [Part IV: Architecture and Storage Internals](#part-iv-architecture-and-storage-internals) |
| **Auditors & Quality Teams** | Invariants, error taxonomy, and traceability tags | [Part V: Technical Reference Appendix](#part-v-technical-reference-appendix) |

---

## Part I: Onboarding, Mental Model, and 5-Minute Quickstart

### 1.1 The Bottlenecks Solved
Small and medium businesses frequently suffer inventory discrepancies caused by two major technical failures:
1. **Lost Updates Under Concurrency**: When two staff members adjust stock for the same item at the same time, traditional read-modify-write patterns overwrite each other without warning.
2. **Double Deductions on Network Timeout**: When a client loses internet connectivity immediately after clicking submit, retrying the request deducts stock twice.

The Inventory Stock Tracker API addresses both bottlenecks using optimistic locking via monotonic version counters and cryptographic request deduplication with a 24-hour time-to-live.

### 1.2 Five-Minute Quickstart

#### Step 1: Clone and Configure
```bash
git clone https://github.com/ios-community/inventory-tracker-api.git
cd inventory-tracker-api
cp .env.example .env
```

#### Step 2: Provision Database
Ensure MariaDB is listening on local TCP port 3306:
```bash
sudo mysql -u root -e "
CREATE DATABASE IF NOT EXISTS inventory_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'inventory'@'127.0.0.1' IDENTIFIED BY 'inventory123';
GRANT ALL PRIVILEGES ON inventory_tracker.* TO 'inventory'@'127.0.0.1';
FLUSH PRIVILEGES;
"
```

#### Step 3: Run Migrations and Seed Sample Data
```bash
bun install
bun run db:migrate
bun run db:seed
```

#### Step 4: Launch Development Server
```bash
bun run dev
```

The server is available at `http://localhost:3000`. Test the health probe:
```bash
curl -i http://localhost:3000/health
```

---

## Part II: Application Developer Cookbook

### 2.1 Authentication & Session Lifecycle
All secured endpoints require an HTTP Bearer JWT header:
`Authorization: Bearer <access_token>`

#### Recipe 1: Authenticate and Obtain Tokens
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin123!"}'
```
Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "486e92c2-...",
    "user": {
      "id": "...",
      "username": "admin",
      "role": "admin"
    }
  }
}
```

#### Recipe 2: Refresh an Expired Access Token
When an access token expires after 12 hours, submit the 3-day refresh token:
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "486e92c2-..."}'
```

### 2.2 Category & Supplier Management

#### Recipe 3: Create a Category (Admin Only)
```bash
curl -X POST http://localhost:3000/categories \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Heavy Machinery", "description": "Industrial hydraulic tools"}'
```

#### Recipe 4: Register a Supplier (Admin Only)
```bash
curl -X POST http://localhost:3000/suppliers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nippon Components Co",
    "contactEmail": "sales@nippon-comp.jp",
    "contactPhone": "+8135550199",
    "address": "Tokyo Industrial District 4-1"
  }'
```

### 2.3 Product Catalog & Stock Adjustments

#### Recipe 5: Register a New Product (Admin Only)
```bash
curl -X POST http://localhost:3000/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "PROD-HYDR-01",
    "name": "High Pressure Hydraulic Valve",
    "price": 149.99,
    "quantity": 25,
    "lowStockThreshold": 10,
    "categoryId": "cat-default-0000-0000-000000000001",
    "supplierId": "sup-default-0000-0000-000000000001"
  }'
```

#### Recipe 6: Perform Stock Movement with Idempotency (Admin & Staff)
```bash
curl -X POST http://localhost:3000/stock/adjust \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "84caa0f3-fa67-4a1d-9b7b-abf180ab3f47",
    "type": "OUT",
    "quantity": 5,
    "reason": "Customer order fulfillment #ORD-2026-99"
  }'
```

---

## Part III: Operator Runbook and Maintenance

### 3.1 Database Migrations
When schema changes are deployed, run migrations before restarting the API:
```bash
bun run db:migrate
```

To generate a new migration after editing schema files in `src/db/schema/`:
```bash
bun x drizzle-kit generate
```

### 3.2 Automated Verification Sequence
Run the full verification suite before promoting code:
```bash
# Execute pure domain unit tests
bun run test:unit

# Execute integration tests
bun run test:integration

# Check test coverage
bun run test:coverage
```

### 3.3 Database Health Monitoring
The `/health` endpoint checks database connectivity by executing `SELECT 1` on the connection pool. If MariaDB is unreachable or times out, the endpoint returns HTTP 503 Service Unavailable:
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Database connection failed"
  }
}
```

---

## Part IV: Architecture and Storage Internals

### 4.1 Functional Core, Imperative Shell (FC/IS)
The codebase strictly separates computational algorithms from database persistence:
- **`domain.ts`**: Contains zero async calls, zero framework dependencies, and zero database queries. Testing domain logic requires zero mocks and runs in under 20 milliseconds.
- **`service.ts`**: Coordinates transaction boundaries, executes Drizzle ORM statements, and catches low-level database errors (`ER_DUP_ENTRY`, `ER_ROW_IS_REFERENCED_2`).

### 4.2 Optimistic Locking Implementation
To eliminate race conditions without holding persistent database row locks:
1. Product rows contain an integer `version` initialized to `1`.
2. Mutation queries include the expected version:
   ```sql
   UPDATE products
   SET quantity = ?, version = version + 1, updated_at = ?
   WHERE id = ? AND version = ?;
   ```
3. If another worker mutated the product concurrently, the query modifies zero rows. The application detects `affectedRows === 0` and raises an HTTP 409 Conflict.

---

## Part V: Technical Reference Appendix

### 5.1 Standard Response Envelopes

#### Success Envelope
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

#### Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "ERROR_IDENTIFIER",
    "message": "Human-readable description of boundary violation",
    "details": {}
  }
}
```

### 5.2 Error Taxonomy
| Status Code | Error Code | Common Cause |
| :--- | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Malformed body, failed schema validation, string length limits. |
| **401** | `UNAUTHORIZED` | Missing, expired, or invalid JWT Bearer token. |
| **403** | `FORBIDDEN` | Staff attempting Admin-only actions (creating or deleting products). |
| **404** | `NOT_FOUND` | Referenced product, category, or supplier ID does not exist. |
| **409** | `CONFLICT` | Duplicate SKU, duplicate category name, or optimistic lock failure. |
| **422** | `BUSINESS_RULE_VIOLATION` | Deduction quantity exceeds current in-stock quantity. |
| **503** | `SERVICE_UNAVAILABLE` | Database server unreachable or health probe query failed. |

### 5.3 System Operational Limits
- Product SKU length: 1 to 64 characters.
- Category name length: 3 to 100 characters (case-insensitive unique).
- Supplier name length: 2 to 150 characters.
- Supplier telephone length: minimum 8 characters when provided.
- Stock adjustment reason: 5 to 255 characters.
- Idempotency key cache lifetime: 24 hours (86,400,000 milliseconds).
