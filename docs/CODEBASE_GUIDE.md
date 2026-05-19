# Codebase Guide

> Repository structure, local conventions, and extension points for
> contributors working on Claude Code Provider Gateway.

## Repository Shape

CCPG is an npm workspace monorepo with three application packages:

```text
claude-code-provider-gateway/
├── packages/
│   ├── daemon/   # Node.js/TypeScript runtime: proxy API + panel API
│   ├── panel/    # React/Vite management UI
│   └── desktop/  # Tauri v2 desktop shell and daemon sidecar supervisor
├── docs/         # Public project documentation
├── scripts/      # Repo-level release and maintenance scripts
└── package.json  # Workspace scripts and shared dev dependencies
```

The production user path is desktop-first. The daemon and panel can be run from
source for development, but end users should normally install a desktop build.

## Package Responsibilities

| Package | Responsibility | Key entry points |
|---|---|---|
| `packages/daemon` | Runs the local Anthropic-compatible proxy, management API, config, sessions, provider registry, and observability. | `src/index.ts`, `src/runtime/daemon.ts`, `src/proxy/app.ts`, `src/panel/app.ts` |
| `packages/panel` | Provides the management UI for providers, routing, Model Chains, history, logs, settings, and shell setup. | `src/main.tsx`, `src/app/App.tsx`, `src/app/routes.tsx` |
| `packages/desktop` | Packages the product as a Tauri desktop app, starts/stops the daemon sidecar, and exposes native commands. | `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/daemon_supervisor.rs` |

## Daemon Layout

`packages/daemon/src/` is organized by backend domain:

| Directory | Purpose |
|---|---|
| `config/` | Config schema, defaults, validation, path resolution, load/save, and encrypted secret splitting. |
| `core/` | Anthropic protocol types, Anthropic-to-OpenAI conversion, token counting, SSE writer utilities, and private file helpers. |
| `observability/` | Central logger and in-memory/SSE log broadcasting. |
| `panel/` | Hono app and routes for the management API consumed by the React panel. |
| `proxy/` | Hono app and routes for the Anthropic-compatible proxy consumed by Claude Code. |
| `runtime/` | Daemon lifecycle, session tracking, session persistence, process markers, stats, and outbound proxy setup. |

The proxy request path is:

```text
POST /v1/messages
  -> proxy auth middleware
  -> MessageService
  -> resolveModel()
  -> token savers
  -> ProviderRegistry
  -> provider transport
  -> Anthropic-compatible SSE stream
  -> session log capture
```

## Panel Layout

`packages/panel/src/features/` uses feature slices. Each feature owns its UI,
hooks, API client calls, and domain types:

```text
features/<feature>/
├── components/
├── hooks/
├── services/
└── domain/
```

Shared frontend pieces live in `packages/panel/src/shared/`:

| Directory | Purpose |
|---|---|
| `shared/api/` | Base URL resolution, typed fetch wrapper, and HTTP helpers. |
| `shared/hooks/` | Polling, SSE, copy-to-clipboard, async resource, and save-feedback helpers. |
| `shared/components/` | Generic UI building blocks used across feature pages. |
| `shared/utils/` | Small cross-feature utilities such as time formatting. |

## Desktop Layout

The Tauri crate should stay small and orchestration-focused. Product behavior
belongs in the TypeScript daemon or React panel unless it needs native OS access.

| Rust module | Responsibility |
|---|---|
| `lib.rs` | Tauri builder composition, plugin registration, app setup, sidecar startup, and shutdown hooks. |
| `commands.rs` | Stable Tauri command boundary used by the panel. |
| `daemon_supervisor.rs` | Sidecar start/stop/status, stale PID cleanup, and stdout/stderr draining. |
| `external_url.rs` | Allowlisted external URL validation and opening in the OS browser. |
| `master_key.rs` | OS keychain integration for the daemon encryption key. |
| `config.rs` | Desktop runtime environment flags and names. |

## Naming And Style

| Area | Convention |
|---|---|
| TypeScript modules | `kebab-case.ts`, with explicit `.js` import extensions for Node ESM output. |
| React components | `PascalCase.tsx`. Default exports are acceptable for page/components; named exports are preferred elsewhere. |
| Tests | Co-located `*.test.ts` files next to the module under test. |
| Types/interfaces | `PascalCase`, exported with `export type` when type-only. |
| Functions/variables | `camelCase`; predicates commonly start with `is`, `has`, or `should`. |
| Constants | `UPPER_SNAKE_CASE` for shared constants and env var names. |
| Formatting | Biome, 2 spaces, double quotes, semicolons, line width 100. |

User-facing product text, API error messages, logs, documentation, and comments
should be written in English. Provider names, model IDs, API fields, and quoted
upstream errors should remain exact even when they contain another language.

Imports follow this order:

1. Node.js built-ins, usually with `node:` prefixes.
2. External packages.
3. Relative local modules with explicit `.js` extensions.

There are no TypeScript path aliases. Prefer relative imports that mirror the
existing package structure.

## Common Extension Points

### Add a provider

For plain OpenAI Chat Completions-compatible or Anthropic Messages-compatible
endpoints, users can add a runtime custom provider from the Providers page. No
code change is required unless the provider should ship as a built-in card or
needs custom auth, catalog, headers, streaming, or request conversion.

For built-in provider support, start with [Adding a Provider](ADDING_PROVIDER.md).
The usual files are:

| Area | Files |
|---|---|
| Provider ID, defaults, labels, CLI flags | `packages/daemon/src/config/schema.ts` |
| Provider implementation or factory registration | `packages/daemon/src/proxy/providers/` |
| Model routing and catalog compatibility | `packages/daemon/src/proxy/model-router.ts`, `packages/daemon/src/proxy/services/model-service.ts` |
| Panel metadata and UX | `packages/panel/src/features/providers/domain/`, `packages/panel/public/providers/` |
| Tests | Co-located provider, model-service, or route tests under `packages/daemon/src/` |

Use the declarative provider factories when the provider speaks standard
Anthropic Messages or OpenAI Chat Completions. Create a dedicated provider class
when auth, model listing, headers, streaming, or request conversion need custom
logic.

### Add a panel feature page

Add a new feature slice under `packages/panel/src/features/<feature>/`, then
wire it into:

| Area | File |
|---|---|
| Route | `packages/panel/src/app/routes.tsx` |
| Sidebar item | `packages/panel/src/features/shell/components/navItems.tsx` |
| Panel API service | `packages/panel/src/features/<feature>/services/` |
| Shared contract, if needed | `packages/daemon/src/panel/contracts.ts` |

### Add a panel API endpoint

Add or update a route file in `packages/daemon/src/panel/routes/`, register it
from `packages/daemon/src/panel/app.ts`, add typed frontend service calls in the
owning feature, and update [API Reference](API_REFERENCE.md).

### Add proxy behavior

Proxy-facing behavior usually belongs in one of these places:

| Need | Likely module |
|---|---|
| Model resolution | `packages/daemon/src/proxy/model-router.ts` |
| Request orchestration, fallback, stats, token savers | `packages/daemon/src/proxy/services/message-service.ts` |
| Model catalog output | `packages/daemon/src/proxy/services/model-service.ts` |
| Anthropic SSE formatting | `packages/daemon/src/core/sse/writer.ts` or provider transport modules |
| Provider-specific request/stream conversion | `packages/daemon/src/proxy/providers/` |

## Error Handling Patterns

The daemon generally uses explicit result objects at service boundaries:

```typescript
type MessageServiceResult =
  | { kind: "stream"; status: 200; stream: ReadableStream<string>; headers: HeadersInit }
  | { kind: "error"; status: number; body: AnthropicErrorResponse };
```

Provider transports return stream-or-error objects, and route handlers translate
those into HTTP responses. Use `err instanceof Error ? err.message : String(err)`
when normalizing unknown caught values.

The panel uses an `ApiError` class in `packages/panel/src/shared/api/client.ts`
and local `status`/`error` state in hooks. Shared hooks should return named
object fields rather than long tuples.

## Verification Checklist

Before opening a PR or publishing docs for a code change, run the relevant
checks:

```bash
npm run quality:ci
npm run typecheck
npm test
```

For desktop changes, also run from `packages/desktop/src-tauri`:

```bash
cargo check
cargo test
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

For provider work, include focused daemon tests for model listing, routing,
auth headers, stream conversion, and error mapping where applicable.
