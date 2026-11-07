<!-- @gov:README-HEADER -->
# Inventory Stock Tracker API

[![Bun](https://img.shields.io/badge/Bun-1.4+-000000.svg)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)
[![Elysia](https://img.shields.io/badge/Elysia-1.4+-F04438.svg)](https://elysiajs.com/)
[![Database](https://img.shields.io/badge/Database-MariaDB_12.x-003545.svg)](https://mariadb.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<!-- @gov:README-SUMMARY -->
A type-safe REST backend engine for SMB inventory cataloging, stock movement audit trails, and stockout prevention. The engine is built on the Bun runtime using ElysiaJS and Drizzle ORM on MariaDB. Business calculations and state transitions execute within a zero-I/O Functional Core, while persistence operations execute inside transactional shells with optimistic concurrency control.

---

<!-- @gov:README-PREREQ -->
## Target Platform & Prerequisites

- **Runtime Engine**<br>
  Bun version 1.4.0 or newer on Linux x86_64 or aarch64.
- **Database Engine**<br>
  MariaDB version 11.x or 12.x (or MySQL 8.x) listening on TCP port 3306.
- **Tooling**<br>
  Git version 2.30 or newer, Biome version 2.x for linting and formatting.

---

<!-- @gov:README-HIGHLIGHTS -->
## Architectural Highlights

- **Functional Core, Imperative Shell**<br>
  Domain calculations (`isLowStock`, `calculateNewQuantity`, `validateStockAvailability`) are synchronous, pure functions isolated from database and web frameworks.
- **Optimistic Concurrency Control**<br>
  Every product record carries a monotonic integer `version` field. Mutations increment this counter atomically (`version = version + 1 WHERE id = ? AND version = ?`), rejecting concurrent conflicting writes with HTTP 409 Conflict.
- **24-Hour Idempotency Deduplication**<br>
  Stock adjustments mandate an `Idempotency-Key` HTTP header. Request payloads are hashed via SHA-256 and checked inside the database transaction, preventing duplicate physical movements upon network retries.
- **Relational Integrity Guarantees**<br>
  Foreign keys from products to categories and suppliers, as well as audit logs to products, enforce `ON DELETE RESTRICT` constraints to prevent dangling inventory references.
- **Stateless Dual-Token Authentication**<br>
  12-hour HMAC-SHA256 access tokens paired with 3-day database-backed refresh tokens featuring single-use cryptographic rotation and Argon2id password hashing.

---

<!-- @gov:README-LAYOUT -->
## Workspace Layout

```text
inventory-tracker-api/
├── docs/
│   ├── PRD.md                       # ISO/IEC/IEEE 29148 Requirements
│   ├── TDD.md                       # Architecture & Design Mappings
│   └── schema.dbml                  # Architecture-as-Code Database Schema
├── src/
│   ├── config/                      # Pino logger configuration
│   ├── db/                          # Database connection pool and migrations
│   │   ├── migrations/              # Drizzle SQL migration files
│   │   └── schema/                  # Drizzle MySQL schema definitions
│   ├── modules/
│   │   ├── auth/                    # Argon2id auth, login, refresh token
│   │   ├── categories/              # Category CRUD, case-insensitive checks
│   │   ├── health/                  # Database connectivity probe
│   │   ├── products/                # Product catalog, search, pagination
│   │   ├── stock-adjustments/       # Adjustments, transactions, idempotency
│   │   └── suppliers/               # Supplier catalog and contact validation
│   └── shared/                      # Errors, middleware, TypeBox schemas
└── tests/
    ├── integration/                 # End-to-end database and HTTP tests
    └── unit/                        # Pure, zero-I/O domain unit tests
```

---

<!-- @gov:README-QUICKSTART -->
## Quick Start

### 1. Database Configuration
Ensure MariaDB is running locally:
```bash
sudo mysql -u root -e "
CREATE DATABASE IF NOT EXISTS inventory_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'inventory'@'127.0.0.1' IDENTIFIED BY 'inventory123';
GRANT ALL PRIVILEGES ON inventory_tracker.* TO 'inventory'@'127.0.0.1';
FLUSH PRIVILEGES;
"
```

### 2. Environment Configuration
Copy environment configuration:
```bash
cp .env.example .env
```

### 3. Migration & Seeding
Install dependencies, generate migrations, and seed initial records:
```bash
bun install
bun run db:migrate
bun run db:seed
```

### 4. Running Application
Start the development server with hot-reload:
```bash
bun run dev
```

Server endpoints:
- API Base: `http://localhost:3000`
- Interactive OpenAPI Docs: `http://localhost:3000/openapi`
- Health Probe: `http://localhost:3000/health`

---

<!-- @gov:README-CONTRIB -->
## Contributing & Quality Gates

The repository enforces a 5-gate local verification sequence before code changes can be merged. Run the master pipeline directly with Task:
```bash
task ci
```

Or execute individual gates manually:
```bash
# Gate 1: Typecheck
bun run typecheck

# Gate 2: Lint and Code Formatting
bun run lint

# Gate 3: Unit Tests
bun run test:unit

# Gate 4: Integration Tests
bun run test:integration

# Gate 5: Documentation Verification
bun run docs:check
```

Detailed contributor policies are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

---

<!-- @gov:README-LEGAL -->
## Governance, Provenance & Security

| Governance Area | Target Artifact | Policy Link |
| :--- | :--- | :--- |
| <!-- @gov:ARCH-OVERVIEW --> Architecture Map | High-level topology and data flows | [ARCHITECTURE.md](ARCHITECTURE.md) |
| <!-- @gov:CONTRIB-VERIFY --> Contributor Contract | Quality gates and commit conventions | [CONTRIBUTING.md](CONTRIBUTING.md) |
| <!-- @gov:SEC-SLA --> Security Disclosure | Private Coordinated Vulnerability Schedule | [SECURITY.md](SECURITY.md) |
| <!-- @gov:GOV-LICENSE --> Software License | Permissive MIT License | [LICENSE](LICENSE) |
