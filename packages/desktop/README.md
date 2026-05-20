<!-- generated-by: gsd-doc-writer -->

# @claude-code-provider-gateway/desktop

Tauri desktop shell for Claude Code Provider Gateway — bundles the configuration panel, manages the local daemon sidecar lifecycle, and provides secure external URL opening to known LLM provider dashboards.

Part of the [Claude Code Provider Gateway](../../README.md) monorepo.

## What It Does

The desktop package wraps the [panel](../panel) (React-based configuration UI) and [daemon](../daemon) (local proxy server) into a single Tauri desktop application. It handles:

- **Daemon lifecycle management** — starts the daemon as a sidecar process on app launch, stops it on exit, and cleans up stale processes from previous runs.
- **Background tray behavior** — closing the main window hides it to the OS tray/menu bar while the app and daemon keep running. The tray menu exposes `Show App`, `Hide`, and `Quit`; only `Quit` exits the process.
- **Master key generation** — creates and stores a 32-byte master key in the OS keychain (`keyring` crate), passed to the daemon via the `CC_GATEWAY_SECRET_KEY` environment variable.
- **Secure external URL opening** — opens links to known provider dashboards (e.g., OpenRouter, Groq, DeepSeek) while blocking unlisted hosts.
- **Cross-platform packaging** — produces `.deb`, `.rpm`, `.AppImage` (Linux), `.dmg` (macOS), and `.msi`/`.exe` (Windows) installers.

## Prerequisites

- **Node.js** >= 24.0.0 (match the monorepo `engines` field)
- **Rust** >= 1.77 (Rust edition 2021)
- **Bun** — required for compiling the daemon sidecar (`bun build --compile`)
- **Tauri CLI** — installed via `@tauri-apps/cli` devDependency

On Linux, additional system libraries may be required (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) — typically `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`, etc.).

## Usage

### Development

From the monorepo root, run the desktop with an external daemon (dev mode):

```bash
npm run dev:desk
```

This starts the daemon separately (via `concurrently`) with `CC_GATEWAY_EXTERNAL_DAEMON=1`, so the desktop shell does not spawn a sidecar. The panel frontend is served by Vite at `http://localhost:5173`.

To run Tauri dev directly within the desktop package:

```bash
npm run dev -w @claude-code-provider-gateway/desktop
```

### Building

Build the desktop app (compiles panel, prepares sidecar, runs `tauri build`):

```bash
npm run build -w @claude-code-provider-gateway/desktop
```

On Linux this produces `.deb`, `.rpm`, and `.AppImage` bundles. On macOS it produces a `.dmg`. On Windows it produces `.msi` and `.exe` installers.

## Architecture

```text
packages/desktop/src-tauri/src/
├── main.rs              # Windows subsystem config, entry point
├── lib.rs               # Tauri builder setup, plugin registration, autostart
├── commands.rs          # Tauri IPC commands: start_daemon, stop_daemon, daemon_status, open_url
├── daemon_supervisor.rs # Daemon sidecar process lifecycle (spawn, kill, status)
├── tray.rs              # System tray/menu bar lifecycle: show, hide, quit
├── config.rs            # Environment variable reading (external daemon flag, secret key)
├── master_key.rs        # OS keychain read/write for master key (keyring crate)
└── external_url.rs      # Secure external URL validation and opening (allowlist-based)
```

The Tauri app registers four IPC commands callable from the panel frontend:

| Command | Description |
|---|---|
| `start_daemon` | Starts the daemon sidecar process, passing the master key as `CC_GATEWAY_SECRET_KEY`. Returns the daemon PID. |
| `stop_daemon` | Kills the running daemon sidecar. |
| `daemon_status` | Returns `{ running: boolean, pid: number \| null }`. |
| `open_url` | Opens an external URL in the system browser. Only `https://` URLs with hosts on the allowlist are permitted. |

The panel frontend is loaded from `../../daemon/dist/static` (built panel output). At dev time, Tauri opens `http://localhost:5173` (Vite dev server).

Closing the main window does not exit the app. The close request is intercepted in Rust, the window is hidden, and the sidecar keeps running in the background. Use the tray/menu bar `Quit` action for a real app exit and sidecar shutdown.

## Scripts

| Command | Description |
|---|---|
| `npm run prepare-sidecar` | Compiles the daemon for the host platform and copies the binary to `src-tauri/binaries/`. |
| `npm run dev` | Runs `tauri dev` (starts panel dev server, prepares sidecar, opens desktop window). |
| `npm run build` | Builds panel, prepares sidecar, then runs `tauri build` with platform-appropriate bundles. |
| `npm run build:appimage` | Linux-only: recovers from a known linuxdeploy sidecar patching failure to produce an AppImage. |

## Testing

No test suite is configured for the desktop package. The Rust source has embedded `#[cfg(test)]` unit tests in `src/master_key.rs` and `src/external_url.rs`. Run them with:

```bash
cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml
```

## License

MIT — see [LICENSE](../../LICENSE) at the monorepo root.
