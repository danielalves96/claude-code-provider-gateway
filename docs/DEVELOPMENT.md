# Development Guide

> How to set up, run, test, and build Claude Code Provider Gateway from source.

CCPG is distributed as a desktop app. npm, Bun, Rust, and Tauri are development/build tools, not the intended end-user installation path.

## Prerequisites

- **Node.js** >= 24
- **npm** with workspaces
- **Bun** >= 1.3.14 (for daemon binary compilation)
- **Rust toolchain** (required for desktop development/builds)
- **Tauri system dependencies** (required for desktop development/builds — see [Tauri docs](https://v2.tauri.app/start/prerequisites/))
- **Claude Code** installed as `claude` if you want to test the full gateway loop

## Quick Start

Desktop development is the main path:

```bash
git clone https://github.com/danielalves96/claude-code-provider-gateway.git
cd claude-code-provider-gateway
npm install
npm run dev:desk
```

This starts the desktop app, a Vite panel dev server, and an external hot-reload daemon.

### Daemon + Panel Only

For lower-level daemon/panel work without opening Tauri:

```bash
npm run dev
```

This starts two processes concurrently via `concurrently`:

| Process | Command | Port | Hot Reload |
|---|---|---|---|
| **Daemon** | `nodemon --exec tsx packages/daemon/src/index.ts` | 49250 (proxy) + 6767 (panel) | Yes (nodemon) |
| **Panel** | `vite packages/panel` | 5173 | Yes (Vite HMR) |

The Vite dev server proxies `/api/*` requests to the daemon on `127.0.0.1:6767`.

### Desktop Development Details

```bash
npm run dev:desk
```

This starts three processes:
1. **Daemon** — with `CC_GATEWAY_EXTERNAL_DAEMON=1` flag
2. **Tauri dev** — opens a native window pointing to `localhost:5173`
3. **Panel Vite dev server** — serves the React app with HMR

In this mode the daemon runs externally, not as a Tauri sidecar, for faster iteration. Production builds bundle the daemon as a sidecar.

## Project Structure

```
claude-code-provider-gateway/
├── packages/
│   ├── daemon/               # Core proxy daemon (TypeScript)
│   ├── panel/                # React SPA management panel
│   └── desktop/              # Tauri v2 desktop shell (Rust)
├── docs/                     # Documentation
├── scripts/                  # Release utilities (bump-version.sh)
└── package.json              # npm workspaces root
```

## Documentation Map

| Document | Use it for |
|---|---|
| [Architecture](ARCHITECTURE.md) | Runtime layers, request flow, provider transports, config, storage, and security model. |
| [Providers](PROVIDERS.md) | Supported provider catalog, auth modes, CLI flags, model discovery, and provider UI behavior. |
| [Adding a Provider](ADDING_PROVIDER.md) | Implementation checklist for new provider support. |
| [Contributing](../CONTRIBUTING.md) | Issue/PR expectations and project contribution workflow. |
| [Security](../SECURITY.md) | Local threat model and vulnerability reporting. |

## Package Details

### Daemon (`packages/daemon/`)

Core proxy daemon. TypeScript compiled with tsup.

| Script | Purpose |
|---|---|
| `npm run build -w @claude-code-provider-gateway/daemon` | Build ESM bundle to `dist/` |
| `npm run dev -w @claude-code-provider-gateway/daemon` | Watch mode rebuild |
| `npm run compile:all -w @claude-code-provider-gateway/daemon` | Cross-compile daemon binary via Bun (all 5 platforms) |
| `npm run compile:linux-x64 -w @claude-code-provider-gateway/daemon` | Single-platform binary |

Key dependencies: Hono (web framework), `@hono/node-server` (Node adapter), `js-tiktoken` (token counting), `undici` (HTTP client).

### Panel (`packages/panel/`)

React SPA built with Vite.

| Script | Purpose |
|---|---|
| `npm run build -w @claude-code-provider-gateway/panel` | Production build to `packages/daemon/dist/static/` |
| `npm run dev -w @claude-code-provider-gateway/panel` | Vite dev server with HMR |

Key dependencies: React 19, React Router 7, Ant Design 5, Zustand 5.

**Important:** Vite dev server proxies `/api/*` to `127.0.0.1:6767` (not `localhost` — on Linux, `localhost` can resolve to IPv6 `::1` while the daemon binds IPv4).

### Desktop (`packages/desktop/`)

Tauri v2 app (Rust). The daemon is compiled via Bun and bundled as a Tauri sidecar.

| Script | Purpose |
|---|---|
| `npm run prepare-sidecar -w @claude-code-provider-gateway/desktop` | Compile daemon binary for host platform, copy to Tauri binaries/ |
| `npm run dev -w @claude-code-provider-gateway/desktop` | `tauri dev` (requires sidecar prepared) |
| `npm run build -w @claude-code-provider-gateway/desktop` | Production desktop build (deb+rpm on Linux, DMG on macOS, MSI on Windows) |
| `npm run build:appimage -w @claude-code-provider-gateway/desktop` | AppImage bundle (Linux only) |

The `prepare-sidecar.mjs` script auto-detects the host platform and compiles the daemon binary accordingly.

#### Rust module layout

The Rust crate is intentionally small. Keep the desktop shell as orchestration code around the TypeScript daemon, not a second application backend.

| Module | Responsibility |
|---|---|
| `src/lib.rs` | Tauri builder composition, plugin registration, app setup, sidecar autostart, and best-effort shutdown on exit |
| `src/commands.rs` | Public Tauri command boundary used by the React panel |
| `src/daemon_supervisor.rs` | Sidecar lifecycle: start, stop, status, stdout/stderr draining, stale PID cleanup |
| `src/external_url.rs` | Allowlisted external URL validation and OS browser opening |
| `src/master_key.rs` | OS keychain integration for the 32-byte daemon secret key |
| `src/config.rs` | Environment variable names and desktop runtime flags |

Rust commands should return structured command errors from `commands.rs` instead of raw strings. Internal operations can use `anyhow` for context; typed errors are preferred at module boundaries where the panel may need stable error codes.

#### Desktop runtime modes

There are two daemon ownership modes:

| Mode | How it is selected | Who owns the daemon |
|---|---|---|
| External dev daemon | `CC_GATEWAY_EXTERNAL_DAEMON=1` | The npm dev process starts the daemon for hot reload |
| Sidecar daemon | Default production/dev Tauri path | Rust starts and supervises the bundled sidecar |

In external daemon mode, Rust intentionally refuses `start_daemon`/`stop_daemon`; the panel should treat the daemon as managed by the dev watcher. In sidecar mode, Rust obtains the master key from the OS keychain, passes it to the daemon via `CC_GATEWAY_SECRET_KEY`, drains sidecar output into logs, and stops the sidecar when the desktop app exits.

#### Desktop validation

Run Rust checks from `packages/desktop/src-tauri`:

```bash
cargo check
cargo test
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

If `cargo fmt` or `cargo clippy` reports that the component is missing, install the standard Rust components:

```bash
rustup component add rustfmt clippy
```

The desktop crate has focused unit tests for security-sensitive pure functions such as URL allowlisting and key material validation. Prefer adding tests around pure policy code before reaching for full Tauri integration tests.

## Testing

```bash
npm run quality:ci # Biome format + lint + import ordering, CI mode
npm run quality    # Biome check for local feedback
npm run quality:fix # Biome safe fixes and formatting
npm test          # Node built-in test runner (all daemon tests)
npm run typecheck # tsc --noEmit across daemon + panel (no emit, just type errors)
```

Tests use Node.js built-in test runner (`node --test`). Test files are co-located with source using `.test.ts` suffix:

```
src/config/validation.test.ts
src/config/secrets/config-splitter.test.ts
src/proxy/providers/api-client.test.ts
src/proxy/services/message-service.test.ts
...
```

The daemon has the broadest test suite. The desktop crate also has focused Rust unit tests for pure policy code. The panel package does not have a dedicated test suite yet.

### Token saver development

Token savers live in `packages/daemon/src/proxy/token-savers/` and are applied by `MessageService` before provider dispatch.

| Module | Responsibility |
|---|---|
| `rtk.ts` | Compress large `tool_result` text blocks with auto-detected filters. |
| `caveman.ts` | Inject terse-response guidance into the Anthropic `system` prompt. |

RTK should only mutate safe tool-result payloads. Preserve errored tool results, skip tiny payloads, and keep the original text whenever compression fails or expands the content. Caveman should remain a config-driven system prompt injection; it should not touch message content.

Useful checks:

```bash
cd packages/daemon
node --import tsx --test src/proxy/token-savers/token-savers.test.ts
npm run typecheck
```

Manual validation path:

1. Start the app with `npm run dev:desk`.
2. Enable **Settings -> Token Savers -> RTK compression**.
3. Launch Claude Code through `ccpg --<provider>`.
4. Ask Claude Code to run a command with large output, such as `rg` or `git diff`.
5. Check daemon logs for an `rtk` line showing bytes saved.

Caveman can be validated with a normal chat request after enabling **Caveman mode**. The session prompt should include the injected terse-response guidance, and responses should become shorter according to the selected level.

### Provider development

Provider source of truth lives in the daemon:

- `packages/daemon/src/config/schema.ts` — controls provider IDs, defaults,
  labels, OAuth membership, CLI flags, and panel settings defaults. Adding a new
  provider ID or changing its defaults starts here.
- `packages/daemon/src/proxy/providers/registry.ts` — **the authoritative
  registry for provider construction**. Declarative factory registration via
  this registry is the preferred way to add a provider. Most providers can be
  fully expressed as a registry entry without a dedicated implementation file.
- `packages/daemon/src/proxy/providers/` — provider implementation files.
  Create a dedicated file here **only** for non-declarative or edge-case
  behavior (custom stream handling, bespoke auth logic, dual-transport dispatch,
  etc.) that cannot be expressed through a registry/factory declaration.

Panel provider support is intentionally thinner:

- `packages/panel/public/providers/` for provider icons.
- `packages/panel/src/features/providers/constants.ts` for local, OAuth,
  device-flow, and coming-soon grouping.
- `packages/panel/src/features/providers/data/suggestedModels.ts` for manual
  model suggestions when discovery is missing or incomplete.
- `packages/panel/src/features/providers/apiKeyLinks.ts` for key-management
  shortcuts.
- `packages/panel/src/features/providers/oauthPresentation.ts` for OAuth copy
  and provider-specific sign-in presentation.

Useful focused checks while working on providers:

```bash
npm test --workspace @claude-code-provider-gateway/daemon
npm run typecheck
```

For a single daemon test file:

```bash
cd packages/daemon
node --import tsx --test src/proxy/providers/commandcode.test.ts
```

Manual provider validation path:

1. Start the desktop dev app with `npm run dev:desk`.
2. Open **Providers**.
3. Search for the provider, configure auth or base URL, and click **Test**.
4. Check the model list and disable any models that should not be exposed.
5. Launch Claude Code with the provider flag, or use `ccpg --all` to validate
   gateway-prefixed routing.
6. Inspect **History** and daemon logs for routed model, provider errors,
   prompt serialization, and response previews.

## Build Pipeline

### Production build

```bash
npm run build
```

This runs:
1. `cd packages/panel && npm run build` — builds React app to `packages/daemon/dist/static/`
2. `cd packages/daemon && npm run build` — bundles daemon TypeScript to `packages/daemon/dist/`

### Full desktop build

```bash
npm run build -w @claude-code-provider-gateway/desktop
```

On Linux this runs `tauri build --bundles deb,rpm` followed by the AppImage builder script.

## Distribution Model

The repository root is marked `"private": true`. CCPG is not currently published to npm as an end-user package.

End-user releases are desktop installers produced by the Tauri build pipeline:

- macOS: `.dmg`
- Linux: `.deb`, `.rpm`, `.AppImage`
- Windows: `.msi`, portable `.zip`

## CI/CD

There are two GitHub Actions workflows:

### Quality Gate (`.github/workflows/quality.yml`)

Runs on every PR touching `packages/daemon`, `packages/panel`, `packages/desktop`, or `docs`. Also available via manual dispatch.

Three parallel jobs:

**Biome** (`ubuntu-22.04`):
1. `npm ci`
2. `npm run quality:ci -- --reporter=github --diagnostic-level=error` — format, lint, and import-order validation

**TypeScript** (`ubuntu-22.04`):
1. `npm ci`
2. `npm test` — Node built-in test runner
3. `npm run typecheck` — `tsc --noEmit` across daemon and panel
4. `npm run build` — full panel + daemon bundle

**Rust** (`ubuntu-22.04`):
1. Install Tauri Linux system dependencies
2. `cargo fmt --check`
3. `cargo check`
4. `cargo test`
5. `cargo clippy --all-targets -- -D warnings`

### Desktop Build (`.github/workflows/desktop-build.yml`)

- **Triggers:** tag push (`v*`), PRs touching daemon/panel/desktop, manual dispatch
- **Matrix:** 5 targets (macOS ARM64, macOS Intel, Linux x86_64, Linux ARM64, Windows x86_64)
- **Builds:**
  - macOS: DMG (via `tauri-action`)
  - Linux: deb + rpm + AppImage (via custom build script)
  - Windows: MSI + portable zip (via `tauri-action` + custom zip step)
- **Release:** on tag push, uploads all artifacts to a draft GitHub Release

## Debugging with Claude Code

```bash
# Get your auth token from ~/.config/claude-code-provider-gateway/config.json
ANTHROPIC_AUTH_TOKEN=sk_xxxxxxxxxxxx \
ANTHROPIC_BASE_URL=http://localhost:49250 \
CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1 \
claude
```

The `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` flag is required for Claude Code v2.1.126+.

## Common Development Tasks

### Adding a new provider

Use the provider checklist in [Adding a Provider](ADDING_PROVIDER.md). Short
version:

1. Create `packages/daemon/src/proxy/providers/<provider>.ts`
2. Extend `BaseProvider` (or `AnthropicMessagesTransport`/`OpenAIChatTransport` if applicable)
3. Implement `streamResponse()` and `listModels()`
4. Add to `ProviderRegistry` in `registry.ts`
5. Add defaults, labels, and CLI flags in `config/schema.ts`
6. Add focused daemon tests before opening the PR

### Adding a panel API endpoint

1. Add the response type to `packages/daemon/src/panel/contracts.ts`.
2. Add the route handler to the appropriate file in `packages/daemon/src/panel/routes/` (or create a new one and register it in `app.ts`).
3. Add the corresponding API client call in `packages/panel/src/shared/api/`.
4. Connect to the React component.

### Building the daemon binary

```bash
npm run compile:all -w @claude-code-provider-gateway/daemon
```

Output goes to `packages/daemon/dist-bin/`. The binary is a standalone executable compiled by Bun — no Node.js required at runtime.

## Editor Setup

The project uses TypeScript strict mode with ES2022 target and NodeNext module resolution. Ensure your editor respects the workspace `tsconfig.json`.

Relative imports **must** include the `.js` extension (ESM requirement):

```typescript
// Correct
import { loadConfig } from './config/index.js'

// Incorrect
import { loadConfig } from './config/index'
```
