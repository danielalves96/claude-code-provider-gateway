<!-- generated-by: gsd-doc-writer -->

# @claude-code-provider-gateway/panel

The React-based web management UI for the Claude Code Provider Gateway. This single-page application provides a visual interface to configure LLM providers, monitor live sessions, browse request history, create model fallback chains, and manage gateway settings.

Part of the [Claude Code Provider Gateway](https://github.com/danielalves96/claude-code-provider-gateway) monorepo.

## Installation

This package is a monorepo workspace. Install workspace dependencies from the project root:

```bash
git clone https://github.com/danielalves96/claude-code-provider-gateway.git
cd claude-code-provider-gateway
npm install
```

## Usage

**Development server** (with hot reload):

```bash
# From the monorepo root
npm run dev:panel

# Or directly in this package
cd packages/panel && npm run dev
```

The dev server starts on `http://localhost:5173` and proxies API requests to the daemon at `http://127.0.0.1:6767`.

**Production build:**

```bash
npm run build
```

The production output goes to `packages/daemon/dist/static/`, where the daemon serves it alongside the proxy.

## Features

The panel exposes the following pages:

| Page | Path | Description |
|------|------|-------------|
| **Dashboard** | `/` | System status overview, enabled provider count, quick launch, and shell setup instructions. |
| **Live Session** | `/live` | Real-time monitoring of the active Claude Code session, including request logs, model stats, and provider latency. |
| **Providers** | `/providers` | Add custom OpenAI/Anthropic-compatible providers, configure, test, reorder, and favorite LLM providers. Supports search and status filtering. |
| **Model Chain** | `/model-chain` | Create custom fallback chains from active provider models. Chains try models in priority order on failure. |
| **Routing** | `/routing` | Map Claude model tiers (Opus, Sonnet, Haiku) to specific providers and models. |
| **History** | `/history` | Browse completed session history with request details, token counts, latency, response previews, and per-session JSON export. |
| **Server Logs** | `/logs` | View the daemon's structured log output with filtering, severity indicators, and `.log` export. |
| **Settings** | `/settings` | Configure token savers (RTK compression, Caveman mode), outbound proxy, port settings, and other preferences. |

## API Layer

The panel communicates with the CCPG daemon through a typed HTTP client in `src/shared/api/`:

- **`client.ts`** — `request<T>(path, init?)` wraps `fetch` with JSON serialization and error handling via `ApiError`. It preserves browser-generated multipart boundaries for `FormData` uploads such as custom provider logos.
- **`http.ts`** — Convenience methods (`http.get`, `http.put`, `http.post`, `http.delete`) for standard CRUD operations.
- **`base.ts`** — Resolves the API base URL, defaulting to `http://127.0.0.1:6767`; automatically detected in Tauri runtime.

### Example API call

```typescript
import { http } from "../shared/api/http.js";

// Fetch provider status
const status = await http.get<DaemonStatus>("/api/status");
```

## Architecture

- **Framework:** React 19 with TypeScript, built with Vite 6
- **UI library:** Ant Design 5 (antd) with custom theming
- **Routing:** react-router-dom v7 with code-split lazy-loaded pages
- **State management:** Zustand stores scoped per feature
- **Drag and drop:** @dnd-kit for provider card reordering
- **Desktop integration:** @tauri-apps/api for Tauri desktop app context

### Directory structure

```text
src/
├── app/             # App shell, routing, and theme provider
├── features/        # Feature-based modules (one folder per page)
│   ├── dashboard/   # Dashboard page, status overview, quick launch
│   ├── history/     # Session history browser
│   ├── live-session/# Active session monitor
│   ├── logs/        # Server log viewer
│   ├── model-chain/ # Custom fallback chain editor
│   ├── providers/   # Provider CRUD, favorites, reordering
│   ├── routing/     # Model tier routing config
│   ├── settings/    # App configuration
│   └── shell/       # App shell: sidebar, top bar, navigation
└── shared/          # Shared utilities
    ├── api/         # HTTP client and API utilities
    ├── components/  # Reusable UI components (PageHeader, MetricSummaryGrid, etc.)
    ├── hooks/       # Reusable React hooks
    └── utils/       # Formatting and utility functions
```

## Testing

This package does not currently have automated tests. Run type checking before committing:

```bash
npm run typecheck
```

For parity with the daemon, you can also run the monorepo-level typecheck:

```bash
npm run typecheck -w @claude-code-provider-gateway/panel
```

## License

MIT
