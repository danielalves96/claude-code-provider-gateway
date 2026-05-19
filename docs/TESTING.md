<!-- generated-by: gsd-doc-writer -->

# Testing

## Test Framework and Setup

The project uses **Node.js built-in test runner** (`node:test`) together with the standard assertion library (`node:assert/strict`). There is no external test framework (no Jest, Vitest, or Mocha). TypeScript source files are executed directly via the [`tsx`](https://tsx.is) loader, which handles on-the-fly compilation without a separate build step.

The root `package.json` delegates test execution to the daemon workspace:

```
npm test --workspace @claude-code-provider-gateway/daemon
```

No additional setup is required beyond `npm install` at the repository root. The daemon package has no test-specific devDependencies — `tsx` and `@types/node` are provided by the root project or the workspace's own dependencies.

The desktop package (`packages/desktop/src-tauri`) includes Rust unit tests using the built-in Rust test harness (`#[test]`). These are run separately via `cargo test`.

## Running Tests

### Daemon (TypeScript) Tests

**Run all daemon tests from the repository root:**

```bash
npm test
```

This delegates to the daemon workspace, which runs:

```bash
node --import tsx --test $(find src -name '*.test.ts' -type f | sort)
```

All 18 test files in `packages/daemon/src/` are discovered and executed sequentially by `node:test`. The `sort` ensures deterministic ordering.

**Run a specific test file from the daemon workspace:**

```bash
npm test -w @claude-code-provider-gateway/daemon -- --test-name-pattern="pattern"
```

### Desktop (Rust) Tests

**Run all Rust tests:**

```bash
cargo test
```

Run from `packages/desktop/src-tauri/`. There is no npm script wrapper — use `cargo test` directly.

## Writing New Tests

### File Naming Convention

Tests live **co-located** with the source files they exercise. Every test file uses the suffix `.test.ts` and sits in the same directory as its corresponding module:

```
packages/daemon/src/
├── config/
│   ├── validation.ts          ← source module
│   ├── validation.test.ts     ← tests for validation.ts
│   └── secrets/
│       ├── master-key.ts
│       └── master-key.test.ts
├── proxy/
│   ├── providers/
│   │   ├── api-client.ts
│   │   └── api-client.test.ts
│   └── routes/
│       ├── anthropic-routes.ts
│       └── anthropic-routes.test.ts
└── runtime/
    ├── network.ts
    └── network.test.ts
```

### Test Structure

Import the `test` function from `node:test` and assertions from `node:assert/strict`. Each test is a call to `test(name, callback)`:

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { myFunction } from "./my-module.js";

test("myFunction returns expected result for valid input", () => {
  const result = myFunction("input");
  assert.equal(result, "expected");
});

test("myFunction handles edge case gracefully", () => {
  assert.throws(() => myFunction(null));
});
```

Use **ES module imports with `.js` extensions** (the project uses `"type": "module"`). Import from the relative source file:

```typescript
import { stripGatewayProviderPrefix } from "./model-prefix.js";
```

### Best Practices

- Use `assert.equal` for value comparisons
- Use `assert.throws` for error conditions
- Clean up side effects (e.g., environment variables, global dispatchers) in `try/finally` blocks when test functions mutate shared state — see `packages/daemon/src/runtime/network.test.ts` for an example
- Keep tests focused: one thing per `test(...)` block
- No test helpers or shared setup files are required — each test file is self-contained

## Coverage Requirements

No coverage threshold is configured. The project does not use a coverage instrumentation tool (no `vitest.config`, `jest.config`, `.nycrc`, or `c8` configuration). Coverage reports are not generated in CI.

## CI Integration

Tests run in GitHub Actions via the **Quality Gate** workflow (`.github/workflows/quality.yml`).

The workflow has three jobs:

| Job | Trigger | What It Runs |
|---|---|---|
| `biome` | PR (on changes to any package or config) | `npm run quality:ci` — Biome format, lint, and import checks |
| `typescript` | PR (on changes to any package or config) | `npm test` (daemon tests) → `npm run typecheck` → `npm run build` |
| `rust` | PR (on changes to any package or config) | `cargo fmt --check` → `cargo check` → `cargo test` → `cargo clippy` |

### Details

- **Daemon tests** (`typescript` job): Runs `npm test` after `npm ci` on Node.js 24 on `ubuntu-22.04`. The `npm test` command invokes all daemon `*.test.ts` files. After tests pass, the job typechecks both daemon and panel (`npm run typecheck`) and builds them (`npm run build`).
- **Rust tests** (`rust` job): Runs `cargo test` in `packages/desktop/src-tauri/` on `ubuntu-22.04` with `rust-toolchain stable`. Includes `rustfmt`, `clippy`, and `cargo check` for the desktop Tauri crate.
- **Workflow triggers**: `pull_request` on paths matching `packages/**`, `docs/**`, root config files, and the quality workflow itself. Also supports `workflow_dispatch` for manual runs.

The **panel** package (`packages/panel`) currently has no dedicated test suite. Its correctness is verified through CI via TypeScript typechecking and the Vite build step.
