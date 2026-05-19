<!-- generated-by: gsd-doc-writer -->

# @claude-code-provider-gateway/daemon

The core daemon for Claude Code Provider Gateway. Starts a local Anthropic-compatible HTTP proxy and a management panel API — both bound to loopback only. Claude Code talks to the proxy; the desktop app talks to the panel. The daemon routes requests to your configured LLM provider, translating protocols when needed, and streams results back as Anthropic SSE.

**Part of the [Claude Code Provider Gateway](https://github.com/danielalves96/claude-code-provider-gateway) monorepo.**

## Installation

```bash
npm install @claude-code-provider-gateway/daemon
```

This package is intended as a library within the CCPG monorepo. End users should use the [desktop app](https://github.com/danielalves96/claude-code-provider-gateway/releases) instead of installing the daemon directly.

## Usage

The daemon exposes a single entry point that loads configuration, configures outbound networking, and starts both servers:

```ts
import { loadConfig, startDaemon, configureOutboundNetwork } from "@claude-code-provider-gateway/daemon";

const config = loadConfig();
configureOutboundNetwork(config.proxy.enabled ? config.proxy.url : undefined);
startDaemon(config);
```

### Servers started

| Server | Default port | Bound to | Purpose |
|--------|-------------|----------|---------|
| Proxy  | `49250`     | `127.0.0.1` | Anthropic-compatible Messages API — `POST /v1/messages`, `GET /v1/models`, `POST /v1/messages/count_tokens` |
| Panel  | `49251`     | `127.0.0.1` | Management API consumed by the desktop UI — config, providers, sessions, OAuth, shell setup |

Both servers are built with [Hono](https://hono.dev) and served via `@hono/node-server`.

### Standalone binary

The daemon can be compiled to a standalone binary using Bun:

```bash
# Build the ESM library
npm run build

# Compile a standalone binary for the current platform
npm run compile

# Compile for specific targets
npm run compile:linux-x64
npm run compile:linux-arm64
npm run compile:darwin-x64
npm run compile:darwin-arm64
npm run compile:win-x64

# Compile for all platforms
npm run compile:all
```

Compiled binaries are written to `dist-bin/`.

## API Summary

### Proxy endpoints (Anthropic-compatible)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/messages` | Create a message (chat completion). Routes to the configured provider, translates protocols, and streams the response back as Anthropic SSE. |
| `GET` | `/v1/models` | List available models aggregated from the active provider or all enabled providers. |
| `POST` | `/v1/messages/count_tokens` | Count input tokens for a Messages request using `js-tiktoken`. |
| `GET` | `/health` | Health check — returns `{ "status": "ok" }`. |
| `GET` | `/` | Status overview — returns active provider, proxy port, and status. |

All `/v1/*` routes require the gateway auth token in the `x-api-key` header.

### Panel endpoints (management API)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Daemon status and provider list. |
| `GET`/`POST` | `/api/sessions` | Active session and session history. |
| `GET`/`POST` | `/api/config` | Read and write gateway configuration. |
| `GET`/`POST` | `/api/providers` | Provider management — test connections, fetch models, manage OAuth. |
| `GET`/`POST` | `/api/oauth/*` | OAuth flow endpoints for OpenAI Account, GitHub Copilot, Kilo Code, and Cline. |
| `POST` | `/api/shell/*` | Shell setup — install/uninstall the `ccpg` command wrapper. |

All `/api/*` routes require panel access authentication.

### Key exports

```ts
// Entry point — main daemon lifecycle
export { startDaemon } from "./runtime/daemon.js";
export { configureOutboundNetwork } from "./runtime/network.js";
export { loadConfig } from "./config/index.js";

// Proxy app factory — for embedding/testing the Anthropic-compatible proxy
export { createProxyApp } from "./proxy/app.js";

// Panel app factory — for embedding/testing the management panel
export { createPanelApp } from "./panel/app.js";

// Config types
export type { Config, ProviderConfig, ProviderId, RoutingRule } from "./config/schema.js";
```

### Provider system

The daemon supports **42 providers** (cloud API key, OAuth, and local) via a provider registry. Each provider implements a transport adapter — either Anthropic-native passthrough or OpenAI-format translation. Provider implementations live in `src/proxy/providers/`.

OAuth providers (`openai_account`, `copilot`, `kiro`, `iflow`, `kilocode`, `cline`) include built-in token refresh logic.

### Token savers

Two optional token-saving middleware modules live in `src/proxy/token-savers/`:

- **RTK compression** — Compacts large `tool_result` payloads (file dumps, logs, diffs) before the request reaches the provider.
- **Caveman mode** — Injects terse-response guidance into the system prompt at configurable levels (`lite`, `full`, `ultra`).

## Testing

```bash
# Run all tests (Node.js native test runner)
npm test

# From the monorepo root
npm test --workspace @claude-code-provider-gateway/daemon
```

Tests use the [Node.js built-in test runner](https://nodejs.org/api/test.html) with `tsx` for TypeScript support. Test files follow the `*.test.ts` naming convention and are co-located with their source modules.

Key test suites:

| Test file | Covers |
|-----------|--------|
| `src/proxy/routes/anthropic-routes.test.ts` | Anthropic proxy endpoint behavior |
| `src/proxy/services/message-service.test.ts` | Message routing and translation |
| `src/proxy/services/model-service.test.ts` | Model listing and aggregation |
| `src/proxy/providers/*.test.ts` | Individual provider transports and auth flows |
| `src/config/validation.test.ts` | Configuration validation |
| `src/config/secrets/*.test.ts` | Encrypted secrets storage and master key management |
| `src/panel/app.test.ts` | Panel API routes |
| `src/panel/launch-prepare.test.ts` | Shell setup and launch preparation |

## License

MIT — see the [root LICENSE](../../LICENSE) for details.
