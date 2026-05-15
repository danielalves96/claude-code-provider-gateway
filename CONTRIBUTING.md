# Contributing

Thanks for considering contributing to Claude Code Provider Gateway.

CCPG is a desktop-first local gateway for Claude Code. Contributions should preserve that direction: end users should be able to download the app, configure providers in the UI, and avoid hand-editing config unless they are deliberately doing advanced work.

## Quick Links

- [README](README.md) - project overview and user-facing quick start
- [Development Guide](docs/DEVELOPMENT.md) - source setup, tests, builds, release flow
- [Architecture](docs/ARCHITECTURE.md) - daemon, proxy, providers, sessions, security model
- [Security](SECURITY.md) - threat model and vulnerability reporting
- [Issues](https://github.com/danielalves96/claude-code-provider-gateway/issues)

## Before Opening a PR

Please make sure the change fits one of these buckets:

- Fixes a reproducible bug
- Improves provider compatibility
- Improves the desktop UX
- Improves security, reliability, or observability
- Adds focused documentation
- Adds tests for existing behavior

Large rewrites, new provider families, persistence changes, and security-sensitive changes should start as an issue or discussion first.

## Development Setup

```bash
git clone https://github.com/danielalves96/claude-code-provider-gateway.git
cd claude-code-provider-gateway
npm install
npm run dev:desk
```

This starts the desktop app, panel dev server, and hot-reload daemon. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for prerequisites and lower-level commands.

## Pull Request Checklist

- Run `npm run quality:ci`.
- Run `npm test`.
- Run `npm run build` when touching daemon, panel, types, or shared build config.
- Update docs when changing setup, provider behavior, routing, storage, or release behavior.
- Keep end-user installation desktop-first. Do not introduce npm as the user install path unless the project direction changes explicitly.
- Avoid storing secrets in plaintext config.
- Include screenshots or screen recordings for visible UI changes.
- Keep provider-specific hacks inside provider classes or transport layers.

## Code Style

- **Biome** - centralized formatter, linter, and import organizer via `biome.jsonc`
- **TypeScript** - strict mode, ES2022 target
- **ES Modules** - relative imports must include `.js`
- **Errors** - throw `Error` objects, not strings
- **Async** - prefer `async`/`await`
- **Scope** - keep changes focused; avoid unrelated formatting churn

```typescript
// Correct
import { loadConfig } from "./config/index.js";

// Incorrect
import { loadConfig } from "./config/index";
```

## Testing

```bash
npm test
```

Tests currently live in `packages/daemon` and use Node.js built-in test runner. Panel and desktop test coverage is not complete yet, so UI changes should include manual verification notes in the PR.

Useful manual checks:

- App opens and starts the daemon.
- Provider list loads.
- Provider test button works for the changed provider.
- `ccpg --<Provider>` launches Claude Code with the expected environment.
- `ccpg --all` exposes prefixed models and routes by selected model.
- History shows request metadata after a session.

## Provider Contributions

When adding or changing a provider:

1. Keep provider protocol details in `packages/daemon/src/proxy/providers/`.
2. Add defaults, labels, and CLI flags in `packages/daemon/src/config/schema.ts`.
3. Make `listModels()` and `testConnection()` useful; the desktop UI depends on both.
4. Preserve Anthropic-compatible streaming semantics.
5. Document provider limitations when tools, streaming, images, thinking, or model discovery are partial.

## Security

Do not include real API keys, OAuth tokens, access tokens, provider responses containing private code, or generated `~/.config/claude-code-provider-gateway/` files in issues or PRs.

Report vulnerabilities privately when possible. See [SECURITY.md](SECURITY.md).

## Release Process

Maintainers release desktop builds by pushing a `v*` tag. CI builds draft GitHub Release artifacts for:

- macOS Apple Silicon and Intel
- Linux x86_64 and ARM64
- Windows x86_64

The repository is private for npm publishing purposes; npm is used for development and build orchestration, not as the end-user distribution channel.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
