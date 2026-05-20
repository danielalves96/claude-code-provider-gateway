# Documentation Hub

This directory is the public documentation set for Claude Code Provider Gateway.
The `.planning/` directory is useful for local analysis and implementation
planning, but it is intentionally not part of the repository. When a planning
note becomes stable enough to help users or contributors, promote it here in a
cleaner, source-linked form.

## Reading Paths

| Audience | Start here | Then read |
|---|---|---|
| New users | [Getting Started](GETTING-STARTED.md) | [Providers](PROVIDERS.md), [Configuration](CONFIGURATION.md), [Troubleshooting](TROUBLESHOOTING.md) |
| Power users | [Providers](PROVIDERS.md) | [Panel Features](PANEL_FEATURES.md), [API Reference](API_REFERENCE.md) |
| Contributors | [Development](DEVELOPMENT.md) | [Codebase Guide](CODEBASE_GUIDE.md), [Adding a Provider](ADDING_PROVIDER.md), [Testing](TESTING.md) |
| Maintainers | [Architecture](ARCHITECTURE.md) | [Daemon Reference](DAEMON_REFERENCE.md), [Maintenance Notes](MAINTENANCE.md), [Security](../SECURITY.md) |

## Documentation Map

| Document | Purpose |
|---|---|
| [App Screens](APP_SCREENS.md) | Preview the desktop app UI before installing it. |
| [Getting Started](GETTING-STARTED.md) | Install the desktop app, complete first-run setup, and launch Claude Code through `ccpg`. |
| [Configuration](CONFIGURATION.md) | Runtime config shape, environment variables, defaults, secrets, and storage locations. |
| [Providers](PROVIDERS.md) | Provider catalog, auth modes, CLI flags, model discovery, Model Chains, and provider UX. |
| [Panel Features](PANEL_FEATURES.md) | Frontend feature modules and how the management UI is organized. |
| [Architecture](ARCHITECTURE.md) | System layers, request lifecycle, provider transports, session handling, storage, and security model. |
| [Daemon Reference](DAEMON_REFERENCE.md) | Backend module reference for proxy, panel API, providers, sessions, observability, and build output. |
| [API Reference](API_REFERENCE.md) | Local proxy and panel API endpoints used by Claude Code, the panel, and shell setup. |
| [Adding a Provider](ADDING_PROVIDER.md) | Implementation checklist and design patterns for built-in provider support. Runtime-compatible endpoints can usually be added from the Providers UI instead. |
| [Codebase Guide](CODEBASE_GUIDE.md) | Repository structure, naming conventions, module patterns, and where to add code. |
| [Development](DEVELOPMENT.md) | Source setup, local dev modes, package scripts, quality gates, builds, and release flow. |
| [Testing](TESTING.md) | Test commands, test layout, coverage expectations, and CI integration. |
| [Troubleshooting](TROUBLESHOOTING.md) | Practical fixes for routing, provider tests, OAuth, Model Chains, history, and build issues. |
| [Maintenance Notes](MAINTENANCE.md) | Known limitations, fragile areas, and maintenance priorities for future work. |

## Keeping Docs Accurate

- Treat source files as the source of truth. Prefer links to concrete modules
  over duplicating large implementation details.
- Keep user-facing docs focused on desktop usage. Node.js, Bun, Rust, and Tauri
  belong in contributor/build docs, not in first-run instructions.
- Update [API Reference](API_REFERENCE.md) when adding or changing routes in
  `packages/daemon/src/proxy/routes/` or `packages/daemon/src/panel/routes/`.
- Update [Providers](PROVIDERS.md) and [Adding a Provider](ADDING_PROVIDER.md)
  when changing provider IDs, CLI flags, auth behavior, custom-provider
  behavior, or model discovery.
- Update [Codebase Guide](CODEBASE_GUIDE.md) when moving modules, changing
  naming conventions, or introducing a new architectural pattern.
- Update [Testing](TESTING.md) when adding a new test runner, package test
  suite, CI job, or required verification step.
