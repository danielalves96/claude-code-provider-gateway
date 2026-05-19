# Security

Claude Code Provider Gateway is designed as a local desktop app with a local daemon. It does not run a hosted proxy service and does not intentionally send telemetry to the project maintainer.

## Supported Versions

The current documented release line is **v0.1.x**. Security fixes should target the main branch and be backported into the next patch release when appropriate.

## Threat Model

CCPG protects against accidental network exposure and casual local misuse, but it is not a sandbox for untrusted local software.

| Area | Current behavior |
|---|---|
| Network binding | Proxy and panel bind to `127.0.0.1`. |
| Proxy auth | Claude Code requests must include the generated gateway auth token. |
| Secret storage | Provider API keys, OAuth tokens, and gateway auth token are stored in `secrets.enc.json` with AES-256-GCM. |
| Master key | A local `secret.key` is generated unless `CC_GATEWAY_MASTER_KEY` is provided. |
| Session history | Prompts, response previews, token counts, latency, and errors are stored locally for the History UI. |
| Telemetry | No project-owned telemetry service is used. |

## Sensitive Local Data

The runtime directory may contain provider credentials and request history:

- Linux/macOS: `~/.config/claude-code-provider-gateway/`
- Windows: `%APPDATA%/claude-code-provider-gateway/`

Do not share these files publicly:

- `secrets.enc.json`
- `secret.key`
- `config.json`
- `current-session.json`
- `sessions.jsonl`
- daemon logs containing provider errors or prompts

Model Chains are stored in `config.json` as non-secret references to provider
ids, model ids, names, slugs, and ordering. They do not store API keys or OAuth
tokens, but chain names and model choices can still reveal private workflow
details.

## Reporting a Vulnerability

If you find a security issue, please avoid opening a public issue with exploit details or secrets.

Until a dedicated security contact is published, open a minimal GitHub issue saying you have a security report and include no sensitive details. A private coordination path will be arranged from there.

Useful report details:

- CCPG version or commit SHA
- OS and release format
- Provider involved, if any
- Reproduction steps without real secrets
- Expected impact

## Known Security Notes

- The panel API is loopback-only and intended for the Tauri webview and local development server. Browser-origin access to localhost should still be considered part of the local threat model.
- The gateway can show prompts and response previews in History. That is intentional, but it means local session history may contain private code or prompts.
- Local providers keep model traffic on your machine, but Claude Code prompts still pass through CCPG's local session logger unless history is cleared.
- Model Chains can route one Claude Code request across multiple upstream
  providers when earlier targets fail. Configure chains with the same data
  sensitivity expectations you would use for each provider individually.
