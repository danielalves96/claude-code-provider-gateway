<!-- generated-by: gsd-doc-writer -->

# Getting Started

> From zero to running Claude Code through CCPG in under two minutes.

## Prerequisites

**For users (desktop app):**

| Requirement | Details |
|---|---|
| Operating system | macOS (Apple Silicon or Intel), Linux (x86_64 or ARM64), or Windows (x86_64) |
| Claude Code | Installed and runnable as `claude` from your shell |
| Disk space | ~200 MB for the installed app |

**For source development:**

| Requirement | Details |
|---|---|
| Node.js | `>= 24.0.0` |
| npm | Ships with Node.js; workspaces required |
| Bun | `>= 1.3.14` (for daemon binary compilation) |
| Rust toolchain | Required for desktop builds |
| Tauri system dependencies | See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS |

## Installation Steps

### Desktop App (Recommended)

1. Download the latest installer for your platform from the [GitHub Releases page](https://github.com/danielalves96/claude-code-provider-gateway/releases):

   | Platform | Installer |
   |---|---|
   | macOS | `.dmg` (Apple Silicon or Intel) |
   | Linux | `.deb`, `.rpm`, or `.AppImage` |
   | Windows | `.msi` or `-setup.exe` |

2. Install and open the app. The daemon starts automatically.

3. Open the **Providers** tab, configure at least one built-in provider or add a custom OpenAI/Anthropic-compatible provider, and click **Test** to verify the connection works.

4. Go to **Dashboard → Shell Setup** and install the `ccpg` shell command. Follow the setup wizard for your shell (zsh, bash, or fish).

5. Relaunch your terminal so the new `ccpg` function takes effect.

### Source Development

For contributors who want to run from source:

```bash
git clone https://github.com/danielalves96/claude-code-provider-gateway.git
cd claude-code-provider-gateway
npm install
npm run dev:desk
```

This starts the desktop app with hot-reload daemon, panel Vite dev server, and Tauri window. See [Development](DEVELOPMENT.md) for the full guide.

## First Run

Once the app is open and you have at least one provider configured and tested, launch Claude Code through CCPG:

```bash
ccpg --DeepSeek
```

Replace `--DeepSeek` with the provider flag matching your configured provider (e.g., `--OpenRouter`, `--Ollama`, `--Copilot`, `--OpenAIAccount`) or with `--<custom-provider-slug>` for a custom provider. Any arguments after the provider flag are passed through to Claude Code:

```bash
ccpg --OpenRouter --resume <session-id>
ccpg --Ollama --continue
```

To see all available models across every enabled provider in Claude Code's model picker:

```bash
ccpg --all
```

> [!WARNING]
> If your `.claude/settings.json` or `.claude/settings.local.json` has an `env` block with `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_BASE_URL`, **remove those entries before launching via `ccpg`**. Those env vars override the gateway endpoint and prevent CCPG from routing requests correctly.

## Common Setup Issues

### Claude Code is not routing through CCPG

Your `.claude/settings.json` or `.claude/settings.local.json` may contain conflicting environment variables. Remove any `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_BASE_URL` entries from the `env` block. Then restart your terminal and run `ccpg --<provider>` again.

### `ccpg` says the gateway is not running

The desktop app must be open. The daemon runs as part of the app and shuts down when you close it. Open CCPG first, then run the `ccpg` command.

### Provider test fails

Common causes and fixes:

| Cause | Fix |
|---|---|
| Provider is disabled | Enable it in the **Providers** tab. |
| Missing API key | Add or replace the API key in the provider modal. |
| OAuth token expired | Log out and sign in again from the provider card. |
| Wrong base URL | Restore the default URL or check your local server address. |
| Custom provider compatibility mismatch | Recreate the provider with the correct **Add OpenAI Compatible** or **Add Anthropic Compatible** action. |
| Network restriction | Configure **Settings → Outbound Proxy** and restart CCPG. |
| Empty model list | Add models manually in the provider modal. Custom providers always expose **Manual models**. |

For local providers, make sure the upstream server is running:

- **Ollama:** `http://localhost:11434`
- **LM Studio:** `http://localhost:1234/v1` (with server enabled)
- **llama.cpp:** `http://localhost:8080/v1`

### Model picker shows stale providers or models

`ccpg` clears Claude Code's gateway model cache during launch, but occasionally the cache may persist. Close Claude Code and delete the cached file:

```bash
rm ~/.claude/cache/gateway-models.json
```

Then run the launch command again.

### OpenAI Account OAuth fails with a region error

If you see `unsupported_country_region_territory`, configure an HTTP/HTTPS outbound proxy in **Settings → Outbound Proxy** and restart CCPG. OAuth token exchange, provider API calls, and model catalog fetches all use the outbound proxy when enabled.

## Next Steps

- [Architecture](ARCHITECTURE.md) — System layers, request lifecycle, routing, storage.
- [Configuration](CONFIGURATION.md) — Environment variables, config file format, secrets storage.
- [Providers](PROVIDERS.md) — Complete provider catalog, auth modes, CLI flags, model discovery.
- [Development](DEVELOPMENT.md) — Source setup, desktop dev, tests, builds, release flow.
- [Troubleshooting](TROUBLESHOOTING.md) — In-depth fixes for launch, provider, OAuth, Model Chain, and build issues.
- [Contributing](../CONTRIBUTING.md) — Issue/PR guidelines and project contribution workflow.
