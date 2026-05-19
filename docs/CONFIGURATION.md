<!-- generated-by: gsd-doc-writer -->

# Configuration

CCPG stores its configuration as a JSON file on disk, plus an encrypted secrets store derived from it. All settings can be managed through the desktop app UI (the **Settings** tab), but understanding the on-disk format is useful for scripting, debugging, and development.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CC_GATEWAY_SECRET_KEY` | No | Auto-generated | 32-byte hex-encoded master key for AES-256-GCM encryption of the secrets store. When set, it overrides the key file. Primarily used by the Tauri supervisor to pass the key to the daemon sidecar process. |
| `CC_GATEWAY_EXTERNAL_DAEMON` | No | (unset) | Set to `"1"` when running the daemon externally in `dev:desk` mode. Signals that the daemon is launched independently, not as a Tauri sidecar. |
| `VITE_CC_GATEWAY_EXTERNAL_DAEMON` | No | (unset) | Set to `"1"` during dev mode. The panel uses this to determine whether to communicate with the daemon at `http://127.0.0.1:6767` directly (Tauri/sidecar mode) or via the Vite dev proxy (external dev daemon mode). |
| `NODE_ENV` | No | (unset) | When set to `"production"`, the daemon binds the panel to the configured `panelPort`. In dev mode it expects the Vite dev server on port 5173 and relaxes CORS origin checks. |
| `APPDATA` | No | (system default) | Windows only. Overrides the base directory for the CCPG config folder. Fallback is `%HOMEDRIVE%%HOMEPATH%`. |
| `NO_PROXY` | No | `"localhost,127.0.0.1,::1"` | Comma-separated list of hosts that bypass the outbound HTTP proxy. CCPG always ensures `localhost`, `127.0.0.1`, and `::1` are included. |

## Config File Format

The primary configuration file is `config.json`, located at:

- **Linux/macOS:** `~/.config/claude-code-provider-gateway/config.json`
- **Windows:** `%APPDATA%/claude-code-provider-gateway/config.json`

It is a JSON file with the following top-level shape:

```json
{
  "server": {
    "proxyPort": 49250,
    "panelPort": 6767,
    "authToken": ""
  },
  "providers": {
    "openrouter": {
      "enabled": true,
      "apiKey": "",
      "authType": "api_key",
      "models": ["anthropic/claude-sonnet-4.5"],
      "disabledModels": [],
      "baseUrl": "https://openrouter.ai/api/v1",
      "rateLimit": 40,
      "rateWindow": 60,
      "maxConcurrency": 5,
      "requestTimeoutMs": 120000
    }
  },
  "routing": {
    "default": { "enabled": false, "providerId": "", "model": "" },
    "opus":    { "enabled": false, "providerId": "", "model": "" },
    "sonnet":  { "enabled": false, "providerId": "", "model": "" },
    "haiku":   { "enabled": false, "providerId": "", "model": "" }
  },
  "thinking": {
    "enabled": true,
    "opus": null,
    "sonnet": null,
    "haiku": null
  },
  "webTools": {
    "enabled": true,
    "allowPrivateNetworks": false
  },
  "proxy": {
    "enabled": false,
    "url": ""
  },
  "tokenSavers": {
    "rtkEnabled": false,
    "cavemanEnabled": false,
    "cavemanLevel": "lite"
  },
  "activeProvider": "nvidia_nim",
  "modelMode": "single",
  "activeModelFallbackSlug": null,
  "modelFallbacks": [],
  "panelSettings": {
    "favoriteProviders": [],
    "favoritesTipDismissed": false
  }
}
```

> **Important:** The `config.json` file on disk does **not** contain API keys, OAuth tokens, or the server auth token. These secrets are split out into `secrets.enc.json` and encrypted with AES-256-GCM. In the on-disk JSON, `apiKey`, `authToken`, `oauth.accessToken`, `oauth.refreshToken`, and `oauth.copilotToken` will always appear as empty strings or `undefined`.

### Top-Level Keys

| Key | Type | Description |
|---|---|---|
| `server` | object | Daemon network settings: proxy port, panel port, and internal auth token. |
| `providers` | object | Per-provider configuration keyed by provider ID (e.g., `"openrouter"`, `"ollama"`). Contains 42 provider entries. |
| `routing` | object | Model routing rules for Claude Code's tier-based model selection (`default`, `opus`, `sonnet`, `haiku`). |
| `thinking` | object | Extended thinking toggle, with per-tier overrides. |
| `webTools` | object | Web search and private-network access controls. |
| `proxy` | object | Outbound HTTP/HTTPS proxy for provider API calls. |
| `tokenSavers` | object | RTK compression and Caveman terse-response mode. |
| `activeProvider` | string | The currently selected provider ID. |
| `modelMode` | string | Model catalog mode: `"single"` (one provider), `"all"` (all enabled providers), or `"chains"` (Model Chains only). |
| `activeModelFallbackSlug` | string \| null | Slug of the currently active Model Chain. |
| `modelFallbacks` | array | User-defined Model Chain configurations. |
| `panelSettings` | object | UI preferences: favorite providers and tip dismissal. |

### Provider Config Keys

Each entry under `providers` uses the following schema:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `false` | Whether the provider is active. |
| `apiKey` | string | `""` | API key (stored in secrets store, empty on disk). |
| `authType` | `"api_key"` \| `"oauth"` | per-provider | Authentication mechanism. OAuth providers use `"oauth"`, all others use `"api_key"`. |
| `oauth` | object | per-provider | OAuth token container (access/refresh/copilot tokens, expiry, account metadata). Present only for OAuth providers. |
| `models` | string[] | per-provider | User-curated list of model IDs to expose. Empty means auto-discover all available models. |
| `disabledModels` | string[] | `[]` | Model IDs to hide from the model catalog. |
| `baseUrl` | string | per-provider | Provider API base URL. Each provider has a hardcoded default (see [Provider Defaults](#provider-default-base-urls)). |
| `rateLimit` | number | `40` | Maximum requests per rate window. |
| `rateWindow` | number | `60` | Rate window duration in seconds. |
| `maxConcurrency` | number | `5` | Maximum concurrent in-flight requests to this provider. |
| `requestTimeoutMs` | number | (none) | Optional per-request timeout in milliseconds. When unset, no explicit timeout is applied. |

### Routing Rule Keys

Each routing tier (`default`, `opus`, `sonnet`, `haiku`) contains:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `false` | Whether this routing rule is active. |
| `providerId` | string | `""` | Target provider ID (must be a valid provider ID from the provider catalog). |
| `model` | string | `""` | Target model name on that provider. |

A routing rule is only considered active when `enabled`, `providerId`, and `model` are all set.

## Required vs Optional Settings

### Required

CCPG starts with sensible defaults for all settings — no manual configuration is required to launch the daemon. The first run auto-generates the config file, auth token, and master key.

However, for CCPG to actually route requests, at least one provider must be:

- **enabled** (`providers.<id>.enabled = true`), and
- **authenticated** — either with an API key or a completed OAuth flow (managed through the panel UI).

The auth token (`server.authToken`) is auto-generated on first run as a random `sk_`-prefixed hex string. It must match between the daemon and any Claude Code session launched via `ccpg`. The shell setup flow handles this automatically.

### Optional

All other settings revert to their defaults if absent from the config file. The `normalizeConfig` function handles legacy configs gracefully — missing top-level keys (e.g., `proxy`, `tokenSavers` in older config files) fall back to defaults without errors.

## Defaults

| Setting | Default Value | Defined In |
|---|---|---|
| `server.proxyPort` | `49250` | `packages/daemon/src/config/index.ts` |
| `server.panelPort` | `6767` | `packages/daemon/src/config/index.ts` |
| `server.authToken` | `sk_` + 16 random hex bytes | Auto-generated on first run |
| `providers.<id>.enabled` | `false` | All providers start disabled |
| `providers.<id>.authType` | `"oauth"` for OAuth providers, `"api_key"` otherwise | Per-provider at build time |
| `providers.<id>.rateLimit` | `40` | `packages/daemon/src/config/index.ts` |
| `providers.<id>.rateWindow` | `60` | `packages/daemon/src/config/index.ts` |
| `providers.<id>.maxConcurrency` | `5` | `packages/daemon/src/config/index.ts` |
| `activeProvider` | `"nvidia_nim"` | `packages/daemon/src/config/index.ts` |
| `modelMode` | `"single"` | `packages/daemon/src/config/index.ts` |
| `thinking.enabled` | `true` | All tiers default to provider-specific behavior (`null`) |
| `webTools.enabled` | `true` | `packages/daemon/src/config/index.ts` |
| `webTools.allowPrivateNetworks` | `false` | `packages/daemon/src/config/index.ts` |
| `proxy.enabled` | `false` | `packages/daemon/src/config/index.ts` |
| `proxy.url` | `""` | `packages/daemon/src/config/index.ts` |
| `tokenSavers.rtkEnabled` | `false` | `packages/daemon/src/config/index.ts` |
| `tokenSavers.cavemanEnabled` | `false` | `packages/daemon/src/config/index.ts` |
| `tokenSavers.cavemanLevel` | `"lite"` | Valid values: `"lite"`, `"full"`, `"ultra"` |
| `routing.<tier>.enabled` | `false` | All tiers start disabled with empty provider/model |
| `activeModelFallbackSlug` | `null` | `packages/daemon/src/config/index.ts` |
| `modelFallbacks` | `[]` | `packages/daemon/src/config/index.ts` |
| `panelSettings.favoriteProviders` | `[]` | `packages/daemon/src/config/index.ts` |
| `panelSettings.favoritesTipDismissed` | `false` | `packages/daemon/src/config/index.ts` |

### Provider Default Base URLs

Each provider has a hardcoded default `baseUrl` in `packages/daemon/src/config/schema.ts`. The most commonly customized ones are:

| Provider ID | Default `baseUrl` |
|---|---|
| `ollama` | `http://localhost:11434` |
| `lmstudio` | `http://localhost:1234/v1` |
| `llamacpp` | `http://localhost:8080/v1` |
| `openrouter` | `https://openrouter.ai/api/v1` |
| `deepseek` | `https://api.deepseek.com/anthropic` |
| `openai_account` | `https://chatgpt.com/backend-api` |
| `copilot` | `https://api.individual.githubcopilot.com` |
| `google` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| `groq` | `https://api.groq.com/openai/v1` |
| `xai` | `https://api.x.ai/v1` |
| `mistral` | `https://api.mistral.ai/v1` |

For the complete list of all 42 provider base URLs, see `PROVIDER_DEFAULTS` in `packages/daemon/src/config/schema.ts`.

## Secrets Storage

CCPG splits sensitive values out of `config.json` into a dedicated encrypted store. The secrets store lives at:

- **Linux/macOS:** `~/.config/claude-code-provider-gateway/secrets.enc.json`
- **Windows:** `%APPDATA%/claude-code-provider-gateway/secrets.enc.json`

The following values are stored encrypted, never in plaintext on disk:

| Secret Key Pattern | Description |
|---|---|
| `server.authToken` | Daemon auth token used to authenticate local requests from Claude Code. |
| `provider.<id>.apiKey` | Provider API key. |
| `provider.<id>.oauth.accessToken` | OAuth access token. |
| `provider.<id>.oauth.refreshToken` | OAuth refresh token. |
| `provider.<id>.oauth.copilotToken` | GitHub Copilot short-lived token. |

### Master Key Resolution

The encryption key is resolved in this order:

1. **`CC_GATEWAY_SECRET_KEY` environment variable** — 32-byte hex string. Used by the Tauri desktop supervisor to inject the key into the sidecar process.
2. **Existing key file** (`secret.key` in the config directory) — 32-byte hex string, persisted with `0600` permissions on first run.
3. **Auto-generated** — A fresh 32-byte key is generated, persisted, and used for the lifetime of the installation.

If the master key changes (e.g., the `secret.key` file is deleted), previously encrypted secrets become unreadable. CCPG treats corrupt entries as missing — you can re-enter credentials through the panel UI without losing other settings.

## Per-Environment Overrides

### Development Mode

When `NODE_ENV` is not `"production"` (the default for dev sessions):

- The panel app binds to the Vite dev server port (`5173`) instead of the configured `panelPort`.
- CORS origins include `http://localhost:5173` for the Vite dev server.
- The panel API is served from the Vite proxy at `http://127.0.0.1:6767/api`.

When running with `npm run dev:desk` (desktop + daemon development):

- `CC_GATEWAY_EXTERNAL_DAEMON=1` is set for the daemon process.
- `VITE_CC_GATEWAY_EXTERNAL_DAEMON=1` is set for the panel build.
- The daemon is launched by the host via `tsx`, not as a Tauri sidecar.
- The panel communicates directly with `http://127.0.0.1:6767`.

### Production (Desktop App)

In the Tauri desktop app, the daemon runs as a sidecar process. The Tauri supervisor:

- Generates or loads the master key and passes it via `CC_GATEWAY_SECRET_KEY`.
- Manages the daemon lifecycle (start/stop).
- The panel runs in the Tauri webview, communicating with the daemon at `http://127.0.0.1:6767`.

### CI / Headless

For CI or headless environments, the daemon can be run standalone with `bun` or as a compiled binary. No environment variables are required beyond those documented above. The config auto-generates on first run.

## Config Loading Process

On startup, the daemon loads configuration in this order:

1. Check if `config.json` exists. If not, generate default config and save it.
2. Read `config.json` and parse as JSON.
3. Deep-merge with current defaults (handles missing keys from older config versions).
4. Normalize all values (type coercion, domain validation, deduplication).
5. If the parsed JSON still contains inline secrets (legacy format from before the splitter migration), extract them to the encrypted store and rewrite `config.json`.
6. Hydrate secrets from the encrypted store back into the in-memory config object.
7. If no `server.authToken` existed in the secrets store (first run), save the config to persist it.

This means the config format is forward-compatible: adding new top-level keys to the schema will not break existing installations.

## Related Files

| File | Location | Purpose |
|---|---|---|
| `config.json` | Config directory | Non-sensitive settings (providers, routing, UI prefs, ports). |
| `secrets.enc.json` | Config directory | AES-256-GCM encrypted API keys, OAuth tokens, and auth token. |
| `secret.key` | Config directory | 32-byte hex master key for the secrets store. |
| `daemon.pid` | Config directory | PID marker for the running daemon process. |
| `daemon.log` | Config directory | Local daemon log (provider errors, request diagnostics). |
| `current-session.json` | Config directory | Active Claude Code session checkpoint. |
| `sessions.jsonl` | Config directory | Completed session archive (capped at 200 sessions). |
