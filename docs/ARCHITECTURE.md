# Architecture

> A technical deep-dive into Claude Code Provider Gateway's design, layers, and data flow.

## System Overview

Claude Code Provider Gateway (CCPG) is a **local-first, desktop-hosted gateway** that interposes an Anthropic Messages API-compatible proxy between Claude Code and any of 40+ LLM providers. The system is organized as a monorepo with three packages:

- **Daemon** — A TypeScript/Node.js backend that runs two Hono HTTP servers on `127.0.0.1`: an Anthropic-compatible proxy API and a web panel API.
- **Panel** — A React 19 SPA (Ant Design, Zustand, React Router) that serves as the configuration UI, live session viewer, and provider management dashboard.
- **Desktop** — A Rust/Tauri 2 shell that packages the daemon as a sidecar process and wraps the panel in a native window, delivering a zero-command-line desktop experience.

The architectural style is **layered**: the daemon is split into configuration, runtime, proxy (routing → providers → transport), panel (API + static serving), and observability layers. The desktop shell adds a supervisor layer that manages the daemon lifecycle.

## High-Level Architecture

```
┌────────────────┐     ┌───────────────────────────────────┐     ┌─────────────────┐
│  Claude Code   │     │         Gateway Daemon            │     │  OpenRouter     │
│  (CLI / IDE)   │────▶│  ┌─────────────────────────────┐  │────▶│  DeepSeek       │
│                │◀────│  │ Hono HTTP Server (proxy)    │  │◀────│  OpenAI         │
│  Anthropic     │ SSE │  │ :49250                      │  │     │  Ollama         │
│  Messages API  │     │  └─────────────────────────────┘  │     │  ...            │
└────────────────┘     │  ┌─────────────────────────────┐  │     └─────────────────┘
                       │  │ Hono HTTP Server (panel)    │  │
   Tauri Webview ─────▶│  │ :6767                       │  │
                       │  │ REST API + React SPA files  │  │
                       │  └─────────────────────────────┘  │
                       │  ┌─────────────────────────────┐  │
                       │  │ Filesystem                  │  │
                       │  │ Config · Secrets · Sessions │  │
                       │  └─────────────────────────────┘  │
                       └───────────────────────────────────┘
```

## Directory Structure

```
claude-code-provider-gateway/
├── packages/
│   ├── daemon/src/                       # Core proxy daemon
│   │   ├── index.ts                      # Entry point: load config → start daemon
│   │   ├── config/                       # Config system + encrypted secrets
│   │   │   ├── paths.ts                  # Centralized filesystem path helpers
│   │   │   ├── schema.ts                 # TypeScript types, provider defaults, CLI flags
│   │   │   ├── validation.ts             # Runtime normalization + default merging
│   │   │   └── secrets/                  # AES-256-GCM secret store
│   │   ├── proxy/                        # Proxy server (Hono)
│   │   │   ├── app.ts                    # Hono app, middleware chain, route registration
│   │   │   ├── runtime.ts               # Proxy runtime + config loader
│   │   │   ├── model-router.ts          # Model → provider routing
│   │   │   ├── middleware/auth.ts        # x-api-key authentication (proxy)
│   │   │   ├── routes/                   # Anthropic + status route handlers
│   │   │   ├── services/                 # Message orchestration + supporting services
│   │   │   │   ├── message-service.ts    # Core orchestration
│   │   │   │   ├── model-service.ts      # Model catalog discovery, provider aggregation, Model Chains
│   │   │   │   ├── native-claude-routing.ts  # Passthrough routing logic
│   │   │   │   ├── prompt-serializer.ts  # Request → human-readable text for session log
│   │   │   │   └── stream-result.ts      # Stream wrapping + response capture helpers
│   │   │   ├── token-savers/             # RTK compression + Caveman prompt injection
│   │   │   └── providers/               # LLM provider implementations
│   │   │       ├── registry.ts          # Provider constructor map + lazy cache
│   │   │       ├── provider-factory.ts  # Declarative providers for simple transports
│   │   │       ├── copilot.ts            # GitHub Copilot (dual-transport)
│   │   │       ├── copilot-chat-stream.ts  # OpenAI Chat stream → Anthropic SSE
│   │   │       ├── copilot-native-anthropic.ts  # Native Anthropic protocol for claude-* models
│   │   │       ├── model-prefix.ts       # Gateway provider prefix stripping
│   │   │       ├── openai-account.ts     # OpenAI Account provider
│   │   │       ├── openai-account-responses.ts  # Responses API request builder
│   │   │       ├── openai-account-stream.ts     # Responses API stream transformer
│   │   │       ├── commandcode.ts        # Custom AI SDK v5 NDJSON → Anthropic SSE
│   │   │       └── ...                   # Custom providers, transports, helpers, tests
│   │   ├── runtime/                      # Daemon lifecycle, sessions, stats
│   │   │   ├── sessions.ts               # Session orchestration (start, end, heartbeat)
│   │   │   ├── session-types.ts          # SessionRecord, SessionModelStat, etc.
│   │   │   ├── session-stats.ts          # Pure stat computation functions
│   │   │   └── session-store.ts          # Disk persistence (read/write/archive)
│   │   ├── core/                         # Anthropic types, token counting, format conversion
│   │   └── panel/                        # Panel HTTP server
│   │       ├── app.ts                    # Hono app composition (thin coordinator)
│   │       ├── contracts.ts              # Shared TypeScript types for all panel API shapes
│   │       ├── runtime.ts                # PanelRuntime: config, registry, OAuth flow state
│   │       ├── middleware/auth.ts         # Panel access control (origin + token)
│   │       └── routes/                   # One file per route group
│   │           ├── config-routes.ts      # GET/PUT /api/config
│   │           ├── oauth-routes.ts       # OpenAI Account + Copilot OAuth flows
│   │           ├── provider-routes.ts    # Provider list, test, models, routing options
│   │           ├── session-routes.ts     # Session read, clear, launch lifecycle
│   │           ├── shell-routes.ts       # Shell setup, snippets, launch commands
│   │           ├── static-routes.ts      # React SPA static file serving
│   │           └── status-routes.ts      # Status, stats, shutdown, SSE log stream
│   ├── panel/src/                        # React SPA (Vite + Ant Design)
│   └── desktop/src-tauri/               # Tauri v2 desktop shell (Rust)
```

## System Layers

### 1. Daemon Runtime (`packages/daemon/src/runtime/daemon.ts`)

Manages two HTTP servers using `@hono/node-server`:

```typescript
class DaemonRuntime {
  start(): void {
    // Binds proxy (:49250) and panel (:6767) servers
    // Both listen on 127.0.0.1 only
    // Handles SIGINT/SIGTERM → graceful shutdown
    // Writes PID file on ready
  }
}
```

Both servers bind to `127.0.0.1` only. This keeps the gateway off the network, but it does not remove the need for local request authentication.

### 2. Proxy Layer (`packages/daemon/src/proxy/`)

Built with [Hono](https://hono.dev), a lightweight web framework.

**app.ts** — creates the Hono app with:
- Middleware: config reload on every request (`runtime.reloadConfig()`), then auth validation
- Route registration: `registerStatusRoutes()` + `registerAnthropicRoutes()`

**routes/anthropic-routes.ts** — handles `POST /v1/messages`:

Three model catalog modes are controlled by `config.modelMode`:

| Mode | How routing works |
|---|---|
| `single` | Normal launch mode. Models list shows enabled Model Chains plus the active provider's models. If `activeModelFallbackSlug` is set, the list shows only that chain. |
| `all` | Aggregates enabled Model Chains and models from all enabled providers. Requests are routed by chain slug or provider/model prefix, not round-robin. |
| `chains` | Shows only enabled Model Chains. Used by `ccpg --ModelChain`. |

Plus optional tier routing (`default`/`opus`/`sonnet`/`haiku`) for mapping Claude model tiers to specific provider models.

In `all` mode, provider-discovered models are exposed to Claude Code with a gateway prefix such as `anthropic/deepseek/deepseek-chat`. The model router strips that prefix, sends the bare model name to the chosen provider, and remembers the primary provider-prefixed model for background Claude Code calls that arrive later as hardcoded Claude tier names.

Model Chains are exposed as synthetic model ids such as
`anthropic/chain/my-chain`. The chain display name shown to Claude Code is
`{Name} · Gateway : Custom Models (Defined by user)`. A chain stores an ordered
list of `{ providerId, model }` targets; the order is user-defined priority.
When a chain request fails because of an upstream API error, rate limit,
quota/credit issue, network failure, or other non-success response, the message
service retries that target and then advances to the next configured target.
When a chain is selected as the session primary model, background Claude tier
requests are routed through the same chain.

**middleware/auth.ts** — validates `x-api-key` header against `config.server.authToken`.

**services/message-service.ts** — core orchestration:
1. Receives Anthropic-format request
2. Resolves the target provider via `model-router.ts`
3. Applies enabled token savers to a cloned request
4. Counts input tokens after compression (`js-tiktoken`)
5. Calls `provider.streamResponse()` with the configured request, or walks the
   configured Model Chain targets when the resolved source is a chain
6. Tracks session statistics

**services/model-service.ts** — builds the catalog returned by `GET /v1/models`.
It merges provider model discovery, manual/disabled model settings, gateway
provider prefixes, and synthetic Model Chain entries according to `modelMode`
and `activeModelFallbackSlug`.

**services/native-claude-routing.ts** — decides whether a request should bypass the active provider and fall through to native Anthropic passthrough. Applied when the requested model is a hardcoded Claude tier name and no primary model has been established yet for this session.

**services/prompt-serializer.ts** — converts `MessagesRequest` to a truncated human-readable string stored in the session request log. The first request in a session captures up to 80 KB of system prompt; subsequent requests cap at 4 KB.

**services/stream-result.ts** — wraps provider `ReadableStream<string>` into the `MessageServiceResult` union. `streamResultWithCapture()` tees the stream and writes the truncated response text back to the session log entry when the stream completes or is cancelled.

**token-savers/rtk.ts** — compresses large `tool_result` text blocks before provider dispatch. It auto-detects common developer-output shapes such as grep/rg results, find output, git diff/status, ls/tree output, numbered file dumps, and repetitive logs. It skips small payloads, oversized raw blobs, and `tool_result` blocks marked as errors. Compression is best-effort: if a filter fails or makes the payload larger, the original text is preserved.

**token-savers/caveman.ts** — injects terse-response guidance into the Anthropic `system` field when enabled. The levels are `lite`, `full`, and `ultra`. Caveman targets output verbosity; it does not reduce input tokens.

### 3. Provider Layer (`packages/daemon/src/proxy/providers/`)

The provider layer is intentionally split between declarative providers and
custom providers:

- Simple API-compatible providers are registered in `registry.ts` with
  `createOpenAIProvider("<id>")` or `createAnthropicProvider("<id>")`.
- Small static differences, such as `requiresApiKey: false`, `x-api-key`
  auth, or extra static headers, are expressed as factory options.
- Providers get dedicated files only when they have behavior that needs code:
  OAuth, token refresh, dynamic headers, provider-specific model catalogs,
  base URL normalization, custom streams, or dual transport dispatch.

Transport hierarchy:

```text
BaseProvider (abstract)
│
├── AnthropicMessagesTransport (abstract)
│   └── Sends POST {baseUrl}/messages with anthropic-version header
│       ├── Plain providers via createAnthropicProvider()
│       ├── DeepSeek / Ollama custom subclasses
│       └── AnthropicPassthrough (direct Anthropic API)
│
├── OpenAIChatTransport (abstract)
│   └── Converts Anthropic → OpenAI Chat, sends POST {baseUrl}/chat/completions
│       ├── Plain providers via createOpenAIProvider()
│       ├── Google AI (Gemini) custom catalog subclass
│       └── OAuth-backed subclasses such as Kilo Code and Cline
│
├── OpenAIAccountProvider
│   └── Custom: PKCE OAuth + OpenAI Responses API + model catalog
│       ├── openai-account-responses.ts  — Anthropic request → Responses API body
│       └── openai-account-stream.ts     — Responses API SSE → Anthropic SSE
│
└── CopilotProvider
    └── Custom: device-flow OAuth + dual-token (GH OAuth + Copilot API token)
        ├── claude-* models  → copilot-native-anthropic.ts (native Anthropic protocol)
        └── other models     → copilot-chat-stream.ts (OpenAI Chat stream → Anthropic SSE)
```

Additional provider shapes:

- **OAuth OpenAI-compatible providers**: `kilocode.ts` and `cline.ts` use the
  OpenAI Chat transport but source credentials from OAuth tokens instead of API
  keys. Kilo Code uses device flow auth plus an optional organization header.
  Cline uses browser authorization and refreshes access tokens before model
  listing or streaming.
- **OAuth placeholders**: `kiro.ts` and `iflow.ts` extend `OAuthStubProvider`.
  They are visible in the UI as coming soon and return a clear 501 error if
  used before their OAuth flows are ported.
- **Command Code**: `commandcode.ts` extends `BaseProvider` directly because it
  posts to a custom `/alpha/generate` endpoint and transforms AI SDK v5 NDJSON
  events into Anthropic-compatible SSE.
- **Declarative providers**: `provider-factory.ts` creates lightweight
  subclasses for providers whose behavior is fully described by transport,
  provider id, label, and static options.
- **User-created custom providers**: the provider registry can instantiate
  config-defined providers whose `custom.compatibility` is `"openai"` or
  `"anthropic"` without adding a built-in provider ID. These use the shared
  OpenAI Chat or Anthropic Messages transports and are addressed by their
  user-chosen slug.
- **Regional Anthropic-compatible providers**: OpenRouter, GLM, Minimax,
  Minimax China, LM Studio, and llama.cpp are declarative
  `AnthropicMessagesTransport` providers. DeepSeek and Ollama keep dedicated
  subclasses for custom model listing or base URL handling.

**ProviderRegistry** (`registry.ts`) — cached constructor map. Providers are
instantiated on first access and cached until config changes trigger a cache
clear. Simple providers are registered with `createOpenAIProvider()` or
`createAnthropicProvider()` instead of one file per provider.

**api-client.ts** — shared HTTP client with:
- Configurable timeouts via `AbortController`
- Error normalization (HTTP error → `{ status, message }`)
- Model mapping (provider model → Anthropic `ModelInfo` format)

**model-prefix.ts** — `stripGatewayProviderPrefix()` strips `anthropic/` or `<providerId>/` gateway prefixes from the requested model before forwarding to the provider.
Both shared transports call it by default, so simple providers do not implement
their own model resolver.

#### Transport Protocols

**AnthropicMessagesTransport**:
- Sends to `POST {baseUrl}/messages` with `anthropic-version: 2023-06-01`
- Streams response directly as Anthropic SSE events
- Used by: OpenRouter, DeepSeek, Ollama, LM Studio, llama.cpp, GLM, Minimax, Minimax China

**OpenAIChatTransport**:
- Converts Anthropic Messages → OpenAI Chat Completions format
- Sends to `POST {baseUrl}/chat/completions`
- Transforms OpenAI streaming chunks (delta-based) → Anthropic SSE events (block-based)
- Handles: text content, tool calls, finish reasons (`stop` → `end_turn`, `tool_calls` → `tool_use`)
- Used by: NVIDIA NIM, Kimi, Google AI (Gemini), Groq, xAI, Mistral, Cerebras, Together, Fireworks, GLM China, SiliconFlow, Hyperbolic, Chutes, Perplexity, Nebius, Volcengine Ark, BytePlus, Alibaba Bailian, OpenCode Go, Xiaomi MiMo, Cohere, Blackbox, HuggingFace, Ollama Cloud, Kilo Code, Cline, and OpenAI-compatible custom providers

**Special hand-written providers** handle their own API and auth:
- `openai-account.ts` — OAuth token management, model fixup (`o1-mini`/`o3-mini` → actual model IDs), delegates to `openai-account-responses.ts` for request building and `openai-account-stream.ts` for the Responses API stream format
- `copilot.ts` — dual-token lifecycle (GH OAuth token → 25-min Copilot API token), editor version headers. Routes claude-* models through native Anthropic protocol (`copilot-native-anthropic.ts`) to preserve tool_use, thinking, and citation blocks; other models go through `copilot-chat-stream.ts` (OpenAI Chat format)
- `commandcode.ts` — custom request builder and stream transformer. It accepts API keys, exposes a fixed/fetched model list, converts Anthropic messages/tools/tool results to Command Code request blocks, and converts text, reasoning, tool-call, and finish events back to Anthropic SSE.

See [Providers](PROVIDERS.md) for the complete provider catalog, provider IDs,
auth modes, and CLI flags.

### 3.1 Panel Provider Management

The React panel treats the daemon as the provider source of truth, then layers
UI behavior on top:

- Provider grouping is derived from configuration type in
  `packages/panel/src/features/providers/domain/providerGroups.ts`.
- OAuth, local, and coming-soon classifications live in
  `packages/panel/src/features/providers/domain/constants.ts`.
- Favorite providers are persisted under
  `config.panelSettings.favoriteProviders` and ordered with
  `SortableFavoritesGrid`.
- Suggested manual models live in
  `packages/panel/src/features/providers/data/suggestedModels.ts`.
- API key documentation links live in
  `packages/panel/src/features/providers/domain/apiKeyLinks.ts`.
- OAuth presentation text and provider-specific UI labels live in
  `packages/panel/src/features/providers/domain/oauthPresentation.ts`.
- Custom OpenAI/Anthropic-compatible providers are created from tab-level
  actions on the Providers page. Their cards render in a dedicated section at
  the end of the All Providers tab, while uploaded logos are served by the
  daemon from the local config directory.

The provider config modal discovers models as soon as a provider is ready. If
discovery returns no models, or if a provider already has manually configured
models, the panel shows the manual model picker. Custom providers always expose
that picker as **Manual models**. This keeps providers with weak catalog APIs
usable without special-casing routing in the daemon.

### 4. SSE Stream Handling (`packages/daemon/src/core/sse/writer.ts`)

Serializes Anthropic-compatible Server-Sent Events:

```
event: message_start
data: { type: "message_start", message: { ... } }

event: content_block_start
data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }

event: content_block_delta
data: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello" } }

event: content_block_stop
data: { type: "content_block_stop", index: 0 }

event: message_delta
data: { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 42 } }

event: message_stop
data: { type: "message_stop" }
```

Also provides `teeWithCapture()` — a stream tee that captures text deltas for session logging without interfering with the main stream. Used by `stream-result.ts` to store a truncated response preview.

### 5. Config System (`packages/daemon/src/config/`)

```
config.json (plain JSON, no secrets)
     │
     │ extractSecretsToStore()  ── on save
     │ hydrateSecretsFromStore() ── on load
     ▼
secrets.enc.json (AES-256-GCM encrypted JSON)
     │
     │ EncryptedFileSecretStore (encrypt/decrypt with master key)
     ▼
secret.key (32-byte hex master key) or CC_GATEWAY_SECRET_KEY env var
```

- **Paths** (`paths.ts`) — centralized functions for all config directory paths: `getConfigDir()`, `getConfigPath()`, `getPidPath()`, `getLogPath()`, `getSecretsPath()`, `getMasterKeyPath()`, `getProviderLogoDir()`, `getCurrentSessionPath()`, `getSessionArchivePath()`. Handles the Windows `%APPDATA%` path on Win32.
- **Schema** (`schema.ts`) — TypeScript types, provider defaults (base URLs, labels), CLI flag mappings
- **Validation** (`validation.ts`) — runtime normalization with default merging
- **Token savers** (`Config.tokenSavers`) — non-secret toggles for RTK compression and Caveman level
- **Model Chains** (`Config.modelFallbacks`) — non-secret chain definitions:
  `id`, `name`, `slug`, `enabled`, and ordered provider/model targets
- **Active chain** (`Config.activeModelFallbackSlug`) — launch-time selector
  used by `ccpg --<chain-slug>` to expose only one chain
- **Panel settings** (`Config.panelSettings`) — non-secret UI state, currently favorite provider order and dismissed helper tips
- **Secret splitting** (`secrets/config-splitter.ts`) — extracts API keys, OAuth tokens, and auth token from config JSON into encrypted store
- **Encrypted store** (`secrets/encrypted-file-store.ts`) — AES-256-GCM with random IV per write
- **Master key** (`secrets/master-key.ts`) — resolution order: env var → stored file → generate new

### 6. Session System (`packages/daemon/src/runtime/`)

Each daemon process = one session. Tracked in memory with disk persistence. The session module is split into three focused files:

- **`session-types.ts`** — TypeScript interfaces: `SessionRecord`, `SessionModelStat`, `SessionProviderStat`, `SessionRequestLogEntry`
- **`session-stats.ts`** — Pure functions for applying a request entry to session stats (`applyRequestToSessionStats`), computing totals, and normalizing legacy records
- **`session-store.ts`** — Disk I/O: `readCurrentSession`, `writeCurrentSession`, `archiveSession`, `listArchivedSessions`, `clearArchivedSessions`. Uses `appendPrivateFile`/`writePrivateFile` so files are written with restricted permissions
- **`sessions.ts`** — Orchestration: session start/end/heartbeat, crash recovery, checkpoint timer, process watching; composes the three modules above

Behavioral properties:
- **Checkpoint**: full session serialized to `current-session.json` every 10 seconds
- **Crash recovery**: on startup, any leftover session from a crash is recovered and archived
- **Heartbeat**: if the launching process stops heartbeating, session auto-ends
- **Per-model and per-provider stats**: requests, errors, latency, last activity
- **Rolling request log**: last 120 entries preserved in session record
- **Archive**: completed sessions appended to `sessions.jsonl` (max 200, newest first)
- **Prompt capture**: request log entries include serialized prompt text (capped by `prompt-serializer.ts`)
- **Response preview**: streamed responses are tee'd via `stream-result.ts` and truncated (4 KB) for UI inspection

### 7. Panel API (`packages/daemon/src/panel/`)

Hono-based REST API for the web panel. The panel module is composed of:

**`app.ts`** — thin coordinator. Creates the Hono app, instantiates `PanelRuntime`, mounts `requirePanelAccess` middleware on `/api/*`, and delegates to each route module.

**`contracts.ts`** — shared TypeScript types for every panel API request and response shape (`GatewayStatusResponse`, `StatsResponse`, `ProviderInfo`, `SessionsResponse`, etc.). Imported by route modules and consumed by the React panel.

**`runtime.ts`** — `PanelRuntime` class. Holds the live `Config`, a `ProviderRegistry` instance, and in-memory OAuth flow maps (PKCE/browser callback flows for OpenAI Account and Cline, device-code flows for GitHub Copilot and Kilo Code). Exposes `saveAndUpdateConfig()` so route handlers can persist and hot-reload config in one call.

**`middleware/auth.ts`** — `requirePanelAccess` middleware:
- Allows requests from Tauri webview origins (`tauri://localhost`, `https://tauri.localhost`) and the Vite dev server in non-production mode
- CORS headers are set for allowed origins
- Sensitive endpoints (config write, session clear, shutdown, shell install, OAuth flows, launch commands with auth tokens) require a valid `Authorization: Bearer <token>` or `x-api-key` header even from loopback
- Requests from cross-site browser origins without a valid token are rejected with 403
- `GET /api/quick-launch` is intentionally token-free because it returns only non-sensitive `ccpg` shortcuts for the dashboard.

**`routes/`** — one file per route group:

| File | Endpoints |
|---|---|
| `status-routes.ts` | `GET /api/status`, `POST /api/control/shutdown`, `GET /api/stats`, `GET /api/logs` (SSE) |
| `config-routes.ts` | `GET /api/config`, `PUT /api/config` |
| `provider-routes.ts` | `GET /api/providers`, `POST /api/providers/:id/test`, custom provider create/test/delete, custom logo serving, `GET /api/models/:providerId`, `GET /api/routing/options` |
| `session-routes.ts` | `GET /api/sessions`, `DELETE /api/sessions`, `POST /api/launch/end`, `POST /api/launch/heartbeat`, `POST /api/launch/attach` |
| `shell-routes.ts` | `GET /api/quick-launch`, `GET /api/launch-commands`, `GET /api/launch-command`, `GET /api/shell-setup`, `GET /api/shell-setup/snippet/:shell`, `POST /api/shell-setup/install`, `POST /api/launch/prepare` |
| `oauth-routes.ts` | OpenAI Account PKCE routes, GitHub Copilot device-flow routes, Kilo Code device-flow routes, and Cline browser authorization routes |
| `static-routes.ts` | React SPA static file serving |

Panel also serves the React SPA static files (built by Vite to `packages/daemon/dist/static/`).

### 8. Frontend (`packages/panel/src/`)

React 19 SPA built with Vite 6 + Ant Design 5 + Zustand 5.

- **Dashboard** — live session view with provider cards, SSE log feed, quick-launch buttons
- **Providers** — toggle providers, edit API keys, OAuth login, test connections, add extra/manual models, create/delete custom OpenAI/Anthropic-compatible providers
- **Model Chain** — create, edit, reorder, enable, and launch ordered fallback chains built from active provider models
- **Routing** — tier-based model routing UI
- **History** — session archive with per-request drill-down and per-session JSON export
- **Server Logs** — live daemon log viewer with filtering and `.log` export
- **Settings** — daemon configuration, outbound proxy, web tools, and token savers

### 9. Desktop Shell (`packages/desktop/`)

Tauri v2 app (Rust + webview). Architecture:

- **Production mode**: the daemon runs as a Tauri sidecar (Bun-compiled binary)
- **External daemon mode**: development-only path where the daemon runs outside Tauri for hot reload
- **Panel served as static files**: the React build output is served by the daemon, not by Tauri
- **Tray/menu bar background mode**: closing the main window hides it; the process and sidecar continue until the tray `Quit` action exits the app
- **Build pipeline**: Bun compiles the daemon → binary copied to Tauri's `binaries/` directory → Tauri bundles everything

The Rust layer is deliberately narrow. Its job is to integrate with the OS, own the sidecar process, and expose a small command surface to the panel. Provider logic, panel APIs, config semantics, and session history remain in the TypeScript daemon.

#### Rust module boundaries

| Module | Role |
|---|---|
| `src/lib.rs` | Application composition: plugins, managed state, setup hook, command registration, exit shutdown |
| `src/commands.rs` | Tauri command facade. Converts internal errors into serializable `{ code, message }` command errors and owns native file-save helpers for panel exports |
| `src/daemon_supervisor.rs` | Async sidecar supervisor protected by a Tokio mutex. Starts, stops, reports status, drains process output, and cleans stale daemon PIDs before spawning |
| `src/tray.rs` | System tray/menu bar integration. Intercepts main-window close requests, shows/hides the window, and marks intentional quits before calling `app.exit(0)` |
| `src/external_url.rs` | External browser policy. Only allowlisted `https://` hosts can be opened from the panel |
| `src/master_key.rs` | OS keychain-backed 32-byte hex master key generation and validation |
| `src/config.rs` | Desktop-specific environment flags shared across modules |

#### Tauri command surface

| Command | Purpose | Notes |
|---|---|---|
| `start_daemon` | Start the bundled daemon sidecar | Refuses when `CC_GATEWAY_EXTERNAL_DAEMON=1` |
| `stop_daemon` | Stop the supervised sidecar | Idempotent when no child is running |
| `daemon_status` | Return `{ running, pid }` for the current supervised child | Tracks the sidecar owned by this Tauri process |
| `open_url` | Open an allowlisted external URL in the OS browser | Validates scheme and host before calling the shell plugin |
| `save_server_logs` | Save the Server Logs buffer as a `.log` file | Writes to the user's Downloads directory from the desktop app |
| `save_session_json` | Save one History session as formatted JSON | Writes `session-{id}.json` to the user's Downloads directory from the desktop app |

Command errors are structured as `{ code, message }`. This keeps the panel from depending on free-form Rust error strings while still preserving useful diagnostic text.

#### Sidecar lifecycle

```
Tauri setup
  │
  ├─ if CC_GATEWAY_EXTERNAL_DAEMON=1:
  │    skip autostart; npm dev process owns daemon
  │
  └─ otherwise:
       master_key::get_or_create_hex()
       daemon_supervisor.start(app, key)
         ├─ return existing child PID if already running
         ├─ clean stale daemon PID from previous crashed dev session
         ├─ spawn Bun-compiled sidecar with CC_GATEWAY_SECRET_KEY
         └─ spawn async log-drain task for stdout/stderr

Tauri ExitRequested
  └─ best-effort supervisor.stop()
```

The main-window close button is not treated as app exit. `WindowEvent::CloseRequested` for the main window calls `prevent_close()` and hides the window to the tray/menu bar. The tray menu contains `Show App`, `Hide`, and `Quit`; `Quit` sets an internal quitting flag and calls Tauri's `app.exit(0)`, allowing the normal `ExitRequested` sidecar cleanup to run.

The stale PID cleanup performs blocking OS process operations through `spawn_blocking`, keeping the async command path responsive. The supervisor checks for an already-owned child before cleanup so repeated `start_daemon` calls cannot terminate the current sidecar.

The `prepare-sidecar.mjs` script handles cross-platform compilation:

| Host | Target Triple |
|---|---|
| macOS ARM64 | `aarch64-apple-darwin` |
| macOS x64 | `x86_64-apple-darwin` |
| Linux x86_64 | `x86_64-unknown-linux-gnu` |
| Linux ARM64 | `aarch64-unknown-linux-gnu` |
| Windows x86_64 | `x86_64-pc-windows-msvc` |

## Request Lifecycle (Detailed)

```
Claude Code
  │ POST /v1/messages
  │ Anthropic Messages format
  │ x-api-key: <authToken>
  ▼
┌──────────────────────────────────────────────┐
│ Proxy Middleware Chain                       │
│                                              │
│  1. runtime.reloadConfig()                   │
│     Reads config.json + decrypts secrets     │
│     (happens on EVERY request)               │
│                                              │
│  2. auth.validate()                          │
│     Compares x-api-key to config.authToken   │
│                                              │
│  3. model-router.resolve()                   │
│     Determines target provider/model or      │
│     synthetic chain slug                     │
└──────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────┐
│ Message Service                              │
│                                              │
│  1. Count input tokens (js-tiktoken)         │
│  2. Get provider from ProviderRegistry       │
│     or load ordered Model Chain targets      │
│  3. Call provider.streamResponse(req, tokens)│
│     or retry/fallback across chain targets   │
│  4. Wrap stream with capture (stream-result) │
└──────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────┐
│ Provider Layer                               │
│                                              │
│  AnthropicMessagesTransport:                 │
│    POST {baseUrl}/messages                   │
│    Headers: anthropic-version, Bearer auth   │
│    Streams SSE events directly               │
│                                              │
│  — or —                                      │
│                                              │
│  OpenAIChatTransport:                        │
│    Convert request (anthropicToOpenAI)       │
│    POST {baseUrl}/chat/completions           │
│    Transform OpenAI delta stream → SSE       │
│                                              │
│  — or —                                      │
│                                              │
│  OpenAI Account:                             │
│    buildOpenAIAccountResponsesRequest()      │
│    POST /v1/responses (Responses API)        │
│    transformOpenAIAccountResponsesStream()   │
│                                              │
│  — or —                                      │
│                                              │
│  Copilot (claude-* model):                   │
│    streamCopilotNativeAnthropic()            │
│    POST {endpoint}/v1/messages               │
│    anthropic-version header                  │
│    Pass-through Anthropic SSE                │
│                                              │
│  — or —                                      │
│                                              │
│  Copilot (other model):                      │
│    anthropicToOpenAI()                       │
│    POST {endpoint}/chat/completions          │
│    transformCopilotChatStream()              │
└──────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────┐
│ SSE Transformation + Capture                 │
│                                              │
│  streamResultWithCapture:                    │
│    teeWithCapture → session log entry        │
│    truncated response preview (4 KB)         │
│                                              │
│  AnthropicMessagesTransport:                 │
│    Pass-through (already Anthropic SSE)      │
│    Only wraps: message_start, message_stop   │
│                                              │
│  OpenAIChatTransport / Copilot Chat:         │
│    Parse delta-based chunks →                │
│    content_block_start / delta / stop         │
│    Handle tool call accumulation             │
│    Map finish_reason → stop_reason           │
└──────────────────────────────────────────────┘
  │
  ▼
Claude Code receives Anthropic SSE stream
```

## Security Model

| Threat | Mitigation |
|---|---|
| Unauthorized proxy access | `x-api-key` header validation on every request |
| Network exposure | Both servers bind to `127.0.0.1` only |
| Secrets at rest | AES-256-GCM encryption, random IV per write |
| OAuth token theft | Tokens encrypted in store, auto-refreshed |
| Cross-origin panel access | Origin allowlist (Tauri webview + Vite dev server only). Sensitive endpoints additionally require a valid Bearer/x-api-key token regardless of origin. |
| Unauthenticated local mutations | Config writes, session clears, OAuth flows, and launch-command endpoints require the gateway token even from loopback. |
| Master key exposure | Can be injected via env var instead of stored on disk |

## Build & Release Pipeline

```
Source → npm run build
           ├── tsup → packages/daemon/dist/ (daemon ESM bundle)
           └── vite → packages/daemon/dist/static/ (panel SPA)

Quality Gate (GitHub Actions — .github/workflows/quality.yml)
  ├── On every PR touching daemon / panel / desktop / docs
  ├── TypeScript job (ubuntu-22.04)
  │   ├── npm ci
  │   ├── npm test           (Node built-in test runner)
  │   ├── npm run typecheck  (tsc --noEmit across daemon + panel)
  │   └── npm run build
  └── Rust job (ubuntu-22.04)
      ├── cargo fmt --check
      ├── cargo check
      ├── cargo test
      └── cargo clippy --all-targets -- -D warnings

Desktop Build (GitHub Actions — .github/workflows/desktop-build.yml, on tag push)
  ├── bun compile → daemon binary (per-platform)
  ├── prepare-sidecar → copy to Tauri binaries/
  └── tauri build → DMG / deb+rpm+AppImage / MSI+portable zip
```

## Runtime Storage Layout

```
# Linux / macOS
~/.config/claude-code-provider-gateway/

# Windows
%APPDATA%\claude-code-provider-gateway\

├── config.json              # Non-sensitive config
│                             # Providers, routing, Model Chains, token savers
├── secrets.enc.json         # AES-256-GCM encrypted secrets
├── secret.key               # Master encryption key (32-byte hex)
├── provider-logos/          # Uploaded custom provider PNG/WebP logos
├── daemon.pid               # Process ID
├── daemon.log               # Log output (rotating buffer)
├── current-session.json     # Active session (checkpointed every 10s)
└── sessions.jsonl           # Session archive (append-only, max 200)
```
