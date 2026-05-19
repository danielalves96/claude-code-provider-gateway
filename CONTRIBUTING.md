# Contributing

Thanks for considering contributing to Claude Code Provider Gateway.

CCPG is a desktop-first local gateway for Claude Code. Contributions should preserve that direction: end users should be able to download the app, configure providers in the UI, and avoid hand-editing config unless they are deliberately doing advanced work.

## Quick Links

- [README](README.md) - project overview and user-facing quick start
- [Development Guide](docs/DEVELOPMENT.md) - source setup, tests, builds, release flow
- [Architecture](docs/ARCHITECTURE.md) - daemon, proxy, providers, sessions, security model
- [Providers](docs/PROVIDERS.md) - supported providers, auth modes, CLI flags, model discovery
- [Adding a Provider](docs/ADDING_PROVIDER.md) - provider implementation checklist
- [API Reference](docs/API_REFERENCE.md) - local proxy and panel endpoints
- [Troubleshooting](docs/TROUBLESHOOTING.md) - common launch, provider, OAuth, history, and build issues
- [Security](SECURITY.md) - threat model and vulnerability reporting
- [Issues](https://github.com/danielalves96/claude-code-provider-gateway/issues)

## First-Time Contributor Path

If you are new to the codebase, this is the fastest way to build a useful
mental model:

1. Read the top half of [README.md](README.md) to understand the product and
   user workflow.
2. Run the app from source with `npm run dev:desk`.
3. Open [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and follow one request
   from Claude Code → daemon proxy → provider → Anthropic SSE stream.
4. Open [docs/PROVIDERS.md](docs/PROVIDERS.md) if your change touches provider
   config, auth, model lists, or CLI flags.
5. Use [docs/ADDING_PROVIDER.md](docs/ADDING_PROVIDER.md) for provider work,
   even when updating an existing provider.
6. Before opening a PR, run the checks in this file and write down any manual
   validation you performed.

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
- Run `npm run typecheck` when touching TypeScript contracts, provider config,
  panel API responses, or shared types.
- Update docs when changing setup, provider behavior, routing, storage, or release behavior.
- Keep end-user installation desktop-first. Do not introduce npm as the user install path unless the project direction changes explicitly.
- Avoid storing secrets in plaintext config.
- Include screenshots or screen recordings for visible UI changes.
- Keep provider-specific behavior inside provider classes, transport layers, or the declarative provider factory/registry when it is a static option.

## Common Change Recipes

### Adding or changing a provider

Start with [docs/ADDING_PROVIDER.md](docs/ADDING_PROVIDER.md). The daemon owns
provider behavior; the panel should not contain hidden routing rules.

Most provider changes touch:

- `packages/daemon/src/config/schema.ts`
- `packages/daemon/src/proxy/providers/registry.ts`
- `packages/daemon/src/proxy/providers/provider-factory.ts` when a reusable static option is missing
- `packages/daemon/src/proxy/providers/<provider>.ts` only for custom behavior that cannot be expressed declaratively
- `packages/panel/public/providers/<provider_id>.webp`
- `packages/panel/src/features/providers/*` only for presentation details

Update [docs/PROVIDERS.md](docs/PROVIDERS.md) whenever the provider is visible
to users.

### Changing request routing or streaming

Start in:

- `packages/daemon/src/proxy/model-router.ts`
- `packages/daemon/src/proxy/routes/anthropic-routes.ts`
- `packages/daemon/src/proxy/services/message-service.ts`
- `packages/daemon/src/core/sse/writer.ts`

Routing and streaming changes need focused daemon tests. Preserve
Anthropic-compatible SSE event ordering because Claude Code depends on it.
If the change touches Model Chains, also validate `ccpg --<chain-slug>`,
`ccpg --ModelChain`, and chain fallback when the first target fails.

### Changing the provider UI

Start in `packages/panel/src/features/providers/`.

The Providers page reads provider state from the daemon API. UI code can group,
filter, favorite, and present providers, but provider capability decisions
should come from daemon config or daemon responses.

Visible UI changes should include manual validation notes and, when practical,
a screenshot or short recording.

### Changing config, secrets, or storage

Start in:

- `packages/daemon/src/config/schema.ts`
- `packages/daemon/src/config/validation.ts`
- `packages/daemon/src/config/secrets/`
- `packages/daemon/src/config/paths.ts`

Config changes should be backward-compatible. Secret values such as API keys,
OAuth tokens, and gateway auth tokens must stay out of `config.json` and inside
the encrypted secret store.

### Changing the desktop shell

Start in `packages/desktop/src-tauri/src/`.

Keep Rust as the desktop orchestration layer around the TypeScript daemon. New
Tauri commands should return stable structured errors at the command boundary
and keep security-sensitive URL/key validation covered by Rust unit tests.

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
- `ccpg --ModelChain` exposes only enabled Model Chains.
- `ccpg --<chain-slug>` exposes one chain and keeps background Claude tier
  calls on that chain.
- History shows request metadata after a session.

## Provider Contributions

When adding or changing a provider:

1. Keep provider protocol details in `packages/daemon/src/proxy/providers/`.
2. Add defaults, labels, and CLI flags in `packages/daemon/src/config/schema.ts`.
3. Prefer `createOpenAIProvider()` or `createAnthropicProvider()` in the registry for simple API-compatible providers.
4. Add a provider file only for OAuth, dynamic headers, custom catalogs, custom base URLs, custom streams, or dual transport dispatch.
5. Make `listModels()` and `testConnection()` useful; the desktop UI depends on both.
6. Preserve Anthropic-compatible streaming semantics.
7. Document provider limitations when tools, streaming, images, thinking, or model discovery are partial.

Provider PRs should also state:

- Auth type: API key, OAuth, local unauthenticated, or custom.
- Transport type: Anthropic Messages, OpenAI Chat, dual transport, or custom.
- Example model used for manual testing.
- Whether streaming tool calls are supported.
- Whether model discovery is live, static, fallback-based, or manual.

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
