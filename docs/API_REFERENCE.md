# API Reference

> Local HTTP endpoints exposed by Claude Code Provider Gateway.

CCPG runs two loopback-only Hono servers:

| Server | Default URL | Primary caller |
|---|---|---|
| Proxy | `http://127.0.0.1:49250` | Claude Code |
| Panel | `http://127.0.0.1:6767` | Tauri webview, Vite dev server, `ccpg` shell function |

Both servers bind to `127.0.0.1`. The proxy requires the generated gateway token
on every `/v1/*` request. Sensitive panel endpoints require the same token even
from loopback.

## Proxy API

The proxy implements the Anthropic-compatible surface Claude Code needs.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/` | No | Basic status JSON: `{ status, provider, proxy_port }`. |
| `GET` | `/health` | No | Health check returning `{ "status": "ok" }`. |
| `GET` | `/v1/models` | `x-api-key` | Returns Claude Code model discovery catalog. |
| `POST` | `/v1/messages` | `x-api-key` | Main Anthropic Messages streaming endpoint. |
| `POST` | `/v1/messages/count_tokens` | `x-api-key` | Counts request tokens after enabled token saver transforms. |
| `HEAD` / `OPTIONS` | `/v1/messages` | `x-api-key` middleware applies to `/v1/*` | Preflight/probe support. |
| `HEAD` / `OPTIONS` | `/v1/messages/count_tokens` | `x-api-key` middleware applies to `/v1/*` | Preflight/probe support. |

Claude Code normally receives the required environment variables from the
installed `ccpg` shell function:

```bash
ANTHROPIC_AUTH_TOKEN=<gateway-token>
ANTHROPIC_BASE_URL=http://127.0.0.1:49250
CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1
CC_GATEWAY_SESSION_ID=<session-id>
```

`POST /v1/messages` flow:

1. Reload config and encrypted secrets.
2. Validate `x-api-key`.
3. Resolve model by chain slug, provider prefix, tier routing, active chain, or active provider.
4. Apply RTK compression and Caveman prompt injection when enabled.
5. Count input tokens.
6. Enforce provider `maxConcurrency` / `rateLimit` limits before dispatch.
7. Stream through the chosen provider transport or Model Chain executor.
8. Capture a truncated prompt/response preview into local session history.

If the client disconnects, the request abort signal is propagated to the
provider transport and shared HTTP client. Upstream requests that are still
opening return a controlled `499` JSON error, and in-flight response bodies are
canceled. Provider rate/concurrency limit failures return Anthropic-style
`rate_limit_error` responses.

## Panel API

The panel API is intentionally local and product-facing. Route contracts live in
`packages/daemon/src/panel/contracts.ts`.

### Status And Logs

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/status` | Origin/token policy | Daemon status, PID, ports, active provider, model mode, uptime. |
| `GET` | `/api/stats` | Origin/token policy | Enabled provider request/error/latency counters. |
| `GET` | `/api/logs` | Origin/token policy | Server-Sent Events stream of daemon log lines. |
| `POST` | `/api/control/shutdown` | Token required | Sends `SIGTERM` to the daemon process. |

### Config

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/config` | Origin/token policy | Returns masked config. API keys are previewed, server auth token is blank. |
| `PUT` | `/api/config` | Token required | Saves normalized config and hot-reloads provider registry state. |

`PUT /api/config` accepts partial config updates. It preserves masked API keys
containing `••••`, validates outbound proxy URLs, normalizes Model Chains, and
keeps secret values in `secrets.enc.json` rather than plaintext `config.json`.

### Providers And Routing Options

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/providers` | Origin/token policy | Provider cards: enabled state, label, base URL, key preview, OAuth status, manual/disabled models, and runtime limits. |
| `POST` | `/api/providers/:id/test` | Origin/token policy | Runs provider `testConnection()`. |
| `GET` | `/api/models/:providerId` | Origin/token policy | Lists discovered/manual models for one enabled provider. |
| `GET` | `/api/routing/options` | Origin/token policy | Lists enabled providers and selectable models for Routing and Model Chain editors. |
| `POST` | `/api/custom-providers/test` | Origin/token policy | Tests a not-yet-saved OpenAI-compatible or Anthropic-compatible custom provider draft and returns discovered models when available. |
| `POST` | `/api/custom-providers` | Origin/token policy | Creates a custom provider from multipart form data (`name`, `slug`, `baseUrl`, `apiKey`, `compatibility`, optional PNG/WebP `logo`). |
| `DELETE` | `/api/custom-providers/:id` | Origin/token policy | Deletes a custom provider and cleans config references, encrypted API key, favorites, Model Chain targets, routing rules, and uploaded logo. |
| `GET` | `/api/provider-logos/:file` | Origin/token policy | Serves uploaded custom provider PNG/WebP logos from the local config directory. |

Provider behavior remains daemon-owned. The panel can group, filter, favorite,
and present providers, but final model discovery and routing come from daemon
config, provider classes, and `model-service.ts`.

Custom provider drafts use `compatibility: "openai"` for OpenAI Chat
Completions-style endpoints (`{baseUrl}/chat/completions`) or
`compatibility: "anthropic"` for Anthropic Messages-style endpoints
(`{baseUrl}/messages`). Both variants use API-key auth and support manual
models when discovery returns an empty catalog.

### OAuth

| Method | Path | Provider | Purpose |
|---|---|---|---|
| `POST` | `/api/providers/openai_account/oauth/start` | OpenAI Account | Starts PKCE login and returns authorization URL. |
| `GET` | `/api/providers/openai_account/oauth/status/:state` | OpenAI Account | Polls PKCE flow status. |
| `POST` | `/api/providers/openai_account/oauth/logout` | OpenAI Account | Clears tokens and disables provider. |
| `POST` | `/api/providers/copilot/oauth/start` | GitHub Copilot | Starts GitHub device flow. |
| `GET` | `/api/providers/copilot/oauth/status/:flowId` | GitHub Copilot | Polls device flow status. |
| `POST` | `/api/providers/copilot/oauth/logout` | GitHub Copilot | Clears tokens and disables provider. |
| `POST` | `/api/providers/kilocode/oauth/start` | Kilo Code | Starts Kilo Code device flow. |
| `GET` | `/api/providers/kilocode/oauth/status/:flowId` | Kilo Code | Polls device flow status. |
| `POST` | `/api/providers/kilocode/oauth/logout` | Kilo Code | Clears tokens, cancels pollers, disables provider. |
| `POST` | `/api/providers/cline/oauth/start` | Cline | Starts browser authorization flow. |
| `GET` | `/api/providers/cline/oauth/status/:state` | Cline | Polls browser authorization flow status. |
| `POST` | `/api/providers/cline/oauth/logout` | Cline | Clears tokens, closes pending callback servers, disables provider. |

OpenAI Account and Cline use short-lived local callback servers. Copilot and
Kilo Code use device-code polling. Kiro and iFlow are visible provider stubs;
their OAuth routes are not implemented yet.

### Sessions And Launch Lifecycle

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/sessions` | Origin/token policy | Returns active sessions (`currentSessions`), the newest active session (`current`), and archived sessions. |
| `DELETE` | `/api/sessions` | Token required | Clears archived sessions. |
| `DELETE` | `/api/sessions/:id` | Origin/token policy | Deletes one archived session. |
| `POST` | `/api/launch/prepare` | Origin/token policy | Prepares a launch profile, clears Claude model cache, starts a session, and returns per-session shell exports or JSON env. |
| `POST` | `/api/launch/heartbeat` | Origin/token policy | Keeps the launched session alive by `sessionId`. |
| `POST` | `/api/launch/attach` | Origin/token policy | Attaches the Claude Code child PID to the session. |
| `POST` | `/api/launch/end` | Origin/token policy | Ends and archives the launched session by `sessionId`. |

`POST /api/launch/prepare` understands:

| Flag | Effect |
|---|---|
| `--all` / `--a` | Sets `modelMode: "all"` and exposes enabled chains plus all enabled provider models. |
| `--ModelChain` / `--ModelChains` / `--chains` | Sets `modelMode: "chains"` and exposes only enabled chains. |
| `--<Provider>` | Sets `activeProvider`, `modelMode: "single"`, clears active chain state. |
| `--<chain-slug>` | Sets `activeModelFallbackSlug`, `modelMode: "single"`, exposes only that chain. |

The launch preparer deletes `~/.claude/cache/gateway-models.json` on a
best-effort basis so Claude Code refreshes its gateway model catalog after a
mode switch.

For user-created custom providers, `--<Provider>` is the provider slug chosen in
the creation modal, for example `ccpg --acme_ai`.

### Shell Setup

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/quick-launch` | Origin/token policy | Dashboard shortcuts without secrets. |
| `GET` | `/api/launch-commands` | Token required | Manual command string plus provider/chain shortcuts. Includes gateway token. |
| `GET` | `/api/launch-command` | Token required | Legacy/manual Claude command with gateway env vars. |
| `GET` | `/api/shell-setup` | Origin/token policy | Detects installed shells and returns snippets. |
| `GET` | `/api/shell-setup/snippet/:shell` | Origin/token policy | Returns one shell snippet for `zsh`, `bash`, `fish`, or `powershell`. |
| `POST` | `/api/shell-setup/install` | Token required | Installs or refreshes managed `ccpg` snippet blocks in shell rc files. |

The shell snippets scope gateway environment variables to a subshell or restored
PowerShell environment, then pass remaining arguments through to `claude`.

## Panel Access Policy

`requirePanelAccess` applies to `/api/*`:

- Allows Tauri webview origins: `tauri://localhost`, `https://tauri.localhost`, `http://tauri.localhost`.
- Allows Vite dev origins in non-production: `http://localhost:5173`, `http://127.0.0.1:5173`.
- Rejects unexpected browser origins without a valid token.
- Requires a valid token for config writes, shutdown, shell install, OAuth start/logout, session clear, and launch-command endpoints that expose secrets.

Use `Authorization: Bearer <gateway-token>` or `x-api-key: <gateway-token>` for
sensitive panel endpoints.
