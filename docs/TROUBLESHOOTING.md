# Troubleshooting

> Practical fixes for the CCPG desktop app, shell command, providers, OAuth,
> Model Chains, logs, and source builds.

## macOS Says The App "Is Damaged And Can't Be Opened"

Symptoms:

- After installing on macOS, opening the app shows *"'Claude Code Provider
  Gateway' is damaged and can't be opened. You should move it to the Trash."*
- The file downloaded and installed without any error.

This is macOS Gatekeeper blocking the app, not actual file corruption. The
desktop build isn't notarized with an Apple Developer ID, so any copy
downloaded via a browser gets the `com.apple.quarantine` extended attribute,
and Gatekeeper refuses to open it on Apple Silicon.

This is a workaround, not a real fix — a proper fix requires the maintainer
to notarize releases with an Apple Developer ID. Run this once after moving
the app to Applications:

```bash
xattr -cr "/Applications/Claude Code Provider Gateway.app"
```

## Claude Code Is Not Routing Through CCPG

Symptoms:

- Claude Code still uses the default Anthropic endpoint.
- Provider switching with `ccpg --<provider>` appears to do nothing.
- History and Live Sessions stay empty.

Checks:

1. Remove conflicting env overrides from `.claude/settings.json` and
   `.claude/settings.local.json`:

   ```json
   {
     "env": {
       "ANTHROPIC_AUTH_TOKEN": "...",
       "ANTHROPIC_BASE_URL": "..."
     }
   }
   ```

   Those keys override the environment exported by `ccpg`.

2. Relaunch your shell after installing the Terminal Integration snippet from
   **Dashboard -> Terminal Integration**.
3. Start Claude Code with a CCPG flag:

   ```bash
   ccpg --DeepSeek
   ccpg --OpenRouter --continue
   ccpg --all
   ```

4. Confirm the app is open. The shell function calls the panel server at
   `http://127.0.0.1:6767/api/launch/prepare`.

## `ccpg` Says The Gateway Is Not Running

The desktop app owns the daemon in normal use. Open the app first, then rerun
the command.

For source development, use:

```bash
npm run dev:desk
```

This starts the hot-reload daemon and Tauri dev app together.

## Model Picker Shows Stale Providers Or Models

`ccpg` clears Claude Code's gateway model cache during launch preparation, but
cache removal is best-effort. If the model picker still looks stale, close
Claude Code and remove:

```bash
~/.claude/cache/gateway-models.json
```

Then run the launch command again.

## Provider Test Fails

Common causes:

| Cause | Fix |
|---|---|
| Provider disabled | Enable the provider in **Providers** before testing or launching. |
| Missing API key | Add or replace the API key in the provider modal. |
| OAuth expired | Log out and sign in again from the provider card. |
| Wrong base URL | Restore the default URL or verify the local server URL. |
| Custom provider compatibility mismatch | Delete and recreate the provider with the correct **Add OpenAI Compatible** or **Add Anthropic Compatible** action. Name, slug, and logo are immutable after creation. |
| Network/proxy restriction | Configure **Settings -> Outbound Proxy** and restart the gateway. |
| Empty model catalog | Add manual models in the provider modal, then test launch/routing. Custom providers always show the manual model input as **Manual models**. |

Local providers need their upstream server running first:

- Ollama: `http://localhost:11434`
- LM Studio: `http://localhost:1234/v1`
- llama.cpp: `http://localhost:8080/v1`

## OpenAI Gateway Models Are Missing

The **OpenAI Gateway** page and `GET /v1/models` show models for external
OpenAI-compatible clients. If the list is empty or a provider is missing:

1. Confirm the provider is enabled and authenticated in **Providers**.
2. Run **Test Connection** on the provider so discovery or manual model setup is known-good.
3. For OAuth providers such as Copilot or OpenAI Account, log out and sign in again if the account token expired.
4. Verify the request uses the gateway API key:

   ```bash
   curl http://127.0.0.1:49250/v1/models \
     -H "Authorization: Bearer sk_..."
   ```

OpenAI-compatible `/v1/models` intentionally lists all enabled provider models,
even when Claude Code is running in `single` mode. Claude Code still receives
its mode-aware model list because it sends the `anthropic-version` header.

## OpenAI-Compatible Client Gets Unauthorized

Use the API key shown on **OpenAI Gateway**. OpenAI-compatible clients should
send either:

```text
Authorization: Bearer <gateway-token>
```

or:

```text
x-api-key: <gateway-token>
```

## OpenAI OAuth Fails With A Region Error

If OpenAI Account login fails with `unsupported_country_region_territory`,
configure **Settings -> Outbound Proxy** with an HTTP/HTTPS proxy URL and
restart CCPG. Provider API calls, model catalog fetches, and OAuth token
exchange use the outbound proxy when it is enabled.

Proxy URLs with embedded credentials are rejected. Use a proxy that does not
require inline `user:password@host` credentials.

## Model Chain Does Not Appear

Check the chain in **Model Chain**:

- It must be enabled.
- It must contain at least one model.
- Each target provider must be enabled.
- Target models must be discoverable or manually added in the provider modal.

Launch modes:

```bash
ccpg --my-chain     # one chain
ccpg --ModelChain   # all enabled chains only
ccpg --all          # enabled chains plus enabled provider models
```

If a chain target fails, CCPG retries that target and then moves to the next
configured target. Errors for failed targets appear in **History** and
**Server Logs**.

## History Is Empty

History starts when Claude Code is launched through `ccpg`, not when the daemon
starts. The shell function calls `/api/launch/prepare`, starts a session, sends
heartbeats, attaches the Claude PID, and archives the session when Claude exits.

If History remains empty:

1. Confirm you launched with `ccpg --<provider>` rather than plain `claude`.
2. Confirm the provider actually received a request.
3. Check **Server Logs** for auth or routing errors.

## Token Savers Do Not Seem To Reduce Tokens

RTK only compresses large successful `tool_result` text blocks. It skips small
payloads, errored tool results, and content that would become larger after
compression. Look for `rtk` log lines showing bytes saved.

Caveman mode targets output verbosity by injecting terse-response guidance into
the system prompt. It does not reduce input tokens.

## Source Build Or Dev Server Issues

Use Node.js 24 or newer:

```bash
node --version
```

Install dependencies from the repo root:

```bash
npm install
```

Run core checks:

```bash
npm run quality:ci
npm test
npm run typecheck
npm run build
```

For desktop work, make sure Rust and Tauri system dependencies are installed,
then run:

```bash
npm run dev:desk
```

The Vite dev server proxies `/api/*` to `http://127.0.0.1:6767` on purpose.
Using `localhost` can hit IPv6 `::1` on Linux while the daemon binds IPv4.

## Docker/Web Issues

Start Docker/Web with:

```bash
docker compose up -d --build
```

Then open `http://localhost:6767`.

If the browser cannot connect:

1. Check the container:

   ```bash
   docker compose ps
   docker compose logs -f ccpg
   ```

2. Make sure ports `6767` and `49250` are not already used by another local
   process or a running desktop/dev daemon.
3. Confirm the Compose environment still sets `CC_GATEWAY_BIND_HOST=0.0.0.0`.
   Without that, the daemon binds loopback inside the container and Docker port
   publishing cannot reach it.

For Docker/Web ports, persisted state, Terminal Integration, reverse proxy, and
container-specific fixes, see the [Docker/Web Guide](DOCKER.md).

## Runtime Files To Inspect

Runtime state lives in:

- Linux/macOS: `~/.config/claude-code-provider-gateway/`
- Windows: `%APPDATA%/claude-code-provider-gateway/`

Useful files:

| File | What to inspect |
|---|---|
| `daemon.log` | Provider errors, OAuth failures, RTK/Caveman logs, startup/shutdown messages. |
| `config.json` | Non-secret provider settings, model mode, Model Chains, ports, token saver settings. |
| `provider-logos/` | Uploaded PNG/WebP logos for user-created custom providers. |

In Docker/Web mode, inspect the container volume instead:

| Path | What to inspect |
|---|---|
| `/data/ccpg.sqlite` | SQLite database containing config, encrypted secrets, active sessions, and history. |
| `/data/secret.key` | Master key file when `CC_GATEWAY_SECRET_KEY` is not supplied. |
| `/data/provider-logos/` | Uploaded custom provider logos. |

The desktop app can also export the current Server Logs buffer as a `.log` file
and individual History sessions as `session-{id}.json` in Downloads.

Do not share `secrets.enc.json`, `secret.key`, `config.json`, session files, or
daemon logs publicly unless you have reviewed them for secrets and private code.
This includes exported `.log` and `session-{id}.json` files.
