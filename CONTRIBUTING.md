# Contributing Guidelines: Inventory Stock Tracker API

<!-- @gov:CONTRIB-VERIFY -->
## 1. Contributor Verification Sequence

All contributions must pass the 5-Gate Local Verification pipeline before submission. Run the complete pipeline via Task:

```bash
task ci
```

Alternatively, gates can be executed individually:

```bash
# Gate 1: Static Type Checking
bun run typecheck

# Gate 2: Biome Lint and Format Validation
bun run lint

# Gate 3: Pure Functional Domain Unit Tests
bun run test:unit

# Gate 4: End-to-End Integration Tests
bun run test:integration

# Gate 5: TSDoc and Documentation Verification
bun run docs:check
```

---

## 2. Architecture & Design by Contract

1. **Domain Purity**: Functions inside `domain.ts` must remain pure, synchronous, and zero-I/O. Do not import database clients or web frameworks into domain modules.
2. **Traceability Closure**: Every new functional requirement must be documented in `docs/PRD.md` with an `@req:FR-*:MUST` tag, linked in `docs/TDD.md` with `@design:FR-*`, and matched with `// @impl:FR-*` in source and `// @test:FR-*` in tests.
3. **Optimistic Locking**: Every mutation affecting inventory count must increment the monotonic `version` field inside an atomic transaction.

---

## 3. Commit Message Standards

Commit messages must strictly follow the Conventional Commits specification:
- `feat(module):` New features and capabilities.
- `fix(module):` Defect and regression fixes.
- `refactor(module):` Code refactoring without behavioral alterations.
- `test(module):` Additions and modifications to test suites.
- `docs:` Documentation and specification updates.
- `chore:` Build, tooling, and dependency maintenance.
