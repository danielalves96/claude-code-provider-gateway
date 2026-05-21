<!-- generated-by: gsd-doc-writer -->

# Panel Features

The panel is a React 19 single-page application built with **Vite**, **Ant Design**, **Zustand**, and **React Router v7**. It communicates with the daemon via a REST API and Server-Sent Events (SSE). The panel runs in two modes:

- **Browser** (dev/standalone): The daemon serves the panel over HTTP. The panel communicates via `fetch` to the daemon's API endpoint (default `http://127.0.0.1:6767`).
- **Tauri desktop shell**: The daemon runs as a sidecar process. Lifecycle control (`start`/`stop`) delegates to Rust commands. API calls go through `http://127.0.0.1:6767` as well.

---

## Architecture Overview

The panel follows a **feature-based** directory structure under `packages/panel/src/features/`. Each feature contains its own `components/`, `hooks/`, `services/`, and `domain/` directories:

```text
packages/panel/src/
├── app/             # App entry, routing, theme
│   ├── App.tsx
│   ├── routes.tsx
│   └── theme/
│       ├── antdTheme.ts
│       └── ThemeProvider.tsx
├── features/
│   ├── dashboard/   # Landing page with status overview, quick launch, shell setup
│   ├── history/     # Session archive, provider/model stats, request logs
│   ├── live-session/# Live monitoring of currently active sessions
│   ├── logs/        # Real-time server log viewer via SSE
│   ├── model-chain/ # Model fallback chain editor with drag-and-drop
│   ├── providers/   # Provider management: API keys, OAuth, model selection, favorites
│   ├── routing/     # Tier-based routing rules (default/opus/sonnet/haiku)
│   ├── settings/    # Server, web tools, proxy, and token saver configuration
│   └── shell/       # App layout: sidebar, top bar, daemon lifecycle controls
└── shared/
    ├── api/         # HTTP client, base URL resolution
    ├── components/  # Reusable UI components (PageHeader, LoadingState, etc.)
    ├── hooks/       # Shared React hooks (useSSE, usePolling, etc.)
    └── utils/       # Time formatting, etc.
```

All features use React Router **lazy loading** — pages are code-split and loaded on demand. The routes are defined in `app/routes.tsx`.

---

## Shared Modules

Before diving into features, here are the foundational modules every feature depends on.

### API Client (`shared/api/`)

The API client resolves the daemon URL and provides typed HTTP helpers.

| File | Purpose |
|---|---|
| `base.ts` | Resolves the API base URL. In Tauri mode, prepends `http://127.0.0.1:6767`. In browser dev mode, uses relative `/api/...` paths. Controlled by `VITE_CC_GATEWAY_EXTERNAL_DAEMON` env var. |
| `client.ts` | Core `request<T>(path, init)` function wrapping `fetch`. Sets `Content-Type: application/json`. Throws `ApiError` on non-OK responses. |
| `http.ts` | Convenience object: `http.get<T>`, `http.put<T>`, `http.post<T>`, `http.delete<T>`. All return `Promise<T>`. |

**Usage example:**

```typescript
import { http } from "../../shared/api/http.js";

const data = await http.get<MyType>("/some-endpoint");
await http.put("/config", { key: "value" });
```

### Shared Hooks (`shared/hooks/`)

| Hook | File | Purpose |
|---|---|---|
| `useSSE<T>` | `useSSE.ts` | Opens an `EventSource` to `apiUrl(path)`, calls `onMessage` with parsed JSON on each event. Supports `paused` option. |
| `usePolling` | `usePolling.ts` | Runs a callback at a fixed interval. Takes `callback`, `intervalMs`, and optional `enabled` flag. |
| `useAsyncResource<T>` | `useAsyncResource.ts` | Generic async data loader with `data`, `status` (`idle`/`loading`/`success`/`error`), `error`, and `reload()`. |
| `useCopyToClipboard` | `useCopyToClipboard.ts` | Copies text to clipboard, returns `copiedKey` (which text was just copied) and `copy(key, text)`. Auto-resets after `resetMs` (default 1800ms). |
| `useSaveFeedback` | `useSaveFeedback.ts` | Wraps an async save action, exposes `saving`/`saved` booleans for button feedback. Auto-resets `saved` after `resetMs` (default 2500ms). |

### Shared Components (`shared/components/`)

| Component | Props | Purpose |
|---|---|---|
| `PageHeader` | `title`, `description?` | Section header with title and optional subtitle |
| `LoadingState` | `label?` (default `"Loading…"`) | Centered spinner with label |
| `MetricSummaryGrid` | `items: MetricSummaryItem[]`, `minWidth?` | Responsive grid of metric cards showing icon, title, and count |
| `SaveButton` | `onClick`, `saving`, `saved`, `label?`, `savedLabel?` | Primary button that shows a checkmark when saved |

### Utilities (`shared/utils/time.ts`)

- `formatUptime(ms)` — Formats milliseconds as `"2h 30m"`, `"45s"`, etc.
- `formatRelative(timestamp)` — Returns relative time like `"just now"`, `"5m ago"`, `"3h ago"`.

### External Link Handling (`shared/openExternal.ts`)

Detects Tauri runtime and opens URLs safely:

- **Browser mode**: Opens with `window.open(url, "_blank", "noopener,noreferrer")`.
- **Tauri mode**: Invokes the `open_url` Rust command.

Only allows `http:` and `https:` schemes.

---

## App Theme (`app/theme/`)

The panel uses a **dark theme** built on Ant Design's ConfigProvider.

**Key characteristics:**

- **Primary color**: `#FF6C2D` (warm orange) — used for buttons, links, active states, switch toggles, tab indicators.
- **Background hierarchy**: Layout → `#262624`, Container → `#2c2c2b`, Elevated → `#30302e`.
- **Text hierarchy**: Primary → `#f1f1ef`, Secondary → `#c3c0b6`, Tertiary → `#b7b5a9`, Quaternary → `#83827d`.
- **Borders**: `#3e3e38` (primary), `#33332f` (secondary).
- **Border radius**: Cards `16px`, Buttons/inputs `12px`, Small elements `8px`.
- **Fonts**: `Outfit` (UI text), `Geist Mono` (code/monospace).
- **Success color**: `#7fb069`, Warning: `#e0a458`, Error: `#ef4444`.

**Theme files:**

| File | Purpose |
|---|---|
| `antdTheme.ts` | Exports `antdTheme: ThemeConfig` — the full Ant Design theme object with tokens and component overrides for Layout, Card, Table, Menu, Button, Input, Select, Modal, etc. |
| `ThemeProvider.tsx` | Wraps children in `<ConfigProvider theme={antdTheme}><App>{children}</App></ConfigProvider>`. Used at the root in `main.tsx`. |

---

## Feature: Shell (`features/shell/`)

The shell feature provides the application chrome — layout, navigation, and daemon lifecycle controls.

### Components

| Component | Purpose |
|---|---|
| `AppShell` | Root layout using Ant Design `Layout` with `Sidebar` + `TopBar` + `Outlet`. Handles lazy route loading with a `Skeleton` fallback. |
| `Sidebar` | Left sidebar with brand logo, navigation menu, GitHub link, and version display. Uses `useLiveIndicator()` to pulse the "Live Sessions" nav item. Collapsible. |
| `TopBar` | Top header bar showing daemon status (running/stopped/checking) with a `Badge` indicator and a Start/Stop control button. |
| `navItems` | Navigation menu configuration — maps each route to an icon and label. |

### Hooks

| Hook | Purpose |
|---|---|
| `useDaemonStatus` | Polls `GET /api/status` every 5 seconds. Returns `state` (`"running"`/`"offline"`/`"unknown"`), `status`, `refresh()`, `pause()`, `resume()`. |
| `useGatewayControl` | Wraps `useDaemonStatus` with start/stop actions. Start delegates to Tauri `start_daemon` (in Tauri mode) or shows an error (dev mode). Stop calls `POST /api/control/shutdown` (dev) or Tauri `stop_daemon`. Includes a lifecycle lock to prevent concurrent start/stop. |
| `useLiveIndicator` | Polls `GET /api/sessions` every 10 seconds to check if any live sessions exist. Returns a boolean. Used by the sidebar to show a processing dot on the Live Sessions nav item. |

### Services

| Service | Purpose |
|---|---|
| `daemonControl.ts` | Daemon lifecycle commands: `start()`, `stop()`, `canStartFromPanel()`. Dual-runtime: delegates to Tauri invoke for desktop, HTTP POST `/api/control/shutdown` for dev. |

### Domain

- **`DaemonState`**: `"running" | "offline" | "unknown"` — state returned by `useDaemonStatus`.
- **`STATE_LABEL` / `STATE_BADGE`**: Maps `DaemonState` to display labels and Ant Design badge statuses.

---

## Feature: Dashboard (`features/dashboard/`)

The landing page. Composed of four main card sections.

### Components

| Component | Purpose |
|---|---|
| `DashboardPage` | Main page layout combining all dashboard cards. Conditionally shows `ShellSetupCard` based on shell setup state. |
| `StatusOverview` | Shows gateway running status, uptime, top model (most-used model from session history), and daemon PID. |
| `EnabledProvidersCard` | Displays per-provider stats (request count, avg latency, last activity) for enabled providers. |
| `QuickLaunchCard` | Copyable CLI launch commands for quick provider selection: "All providers", "All Model Chains", and per-provider flags. |
| `LiveLogsPanel` | Real-time streaming log viewer (last 1000 lines) embedded on the dashboard. Uses SSE. |
| `ShellSetupCard` | Guided shell integration setup: shows shell-appropriate `ccpg` command aliases, provides one-click install for zsh/bash/fish/powershell. Expandable/collapsible with dismiss. |
| `ShellInstallActions` | Per-shell install buttons with status feedback. |
| `ShellCommandCopyBox` | Copy-to-clipboard box for the shell snippet. |
| `ProviderStatCard` | Individual provider stat display card. |

### Hooks

| Hook | File | Purpose |
|---|---|---|
| `useDashboardPage` | `useDashboardPage.ts` | Orchestrator hook composing `useGatewayStatus`, `useLaunchCommands`, and `useShellSetup`. Computes `topProviders` and `topModel` from session history. Handles shell setup card dismiss state via `localStorage`. |
| `useGatewayStatus` | `useGatewayStatus.ts` | Polls `GET /api/status`, `GET /api/stats`, and `GET /api/sessions` every 5 seconds. Returns `status`, `stats`, `sessions`, `isLoading`. |
| `useLaunchCommands` | `useLaunchCommands.ts` | Fetches `GET /api/quick-launch` once on mount. Derives `LaunchItem[]` for quick launch cards including CLI flags. |
| `useShellSetup` | `useShellSetup.ts` | Fetches `GET /api/shell-setup` once on mount. Returns `setup` and `refresh()`. |
| `useShellSetupCard` | `useShellSetupCard.ts` | Manages shell install flow: `install(shells, key)`, install state, open/collapsed state. Announces install results via Ant Design `message`. |
| `useLiveLogs` | `useLiveLogs.ts` | Subscribes to SSE at `/api/logs`. Maintains last 1000 lines with `paused`, `clear`, and `togglePaused` controls. |
| `useStatusOverview` | `useStatusOverview.tsx` | Builds the 4 status cards: running status, uptime, top model (from session history), and daemon PID. |
| `useProviderStatCard` | `useProviderStatCard.ts` | Fetches per-provider models for a single stat card. |

### Services

| Service | Endpoints Used |
|---|---|
| `dashboardService` | `GET /api/status`, `GET /api/stats`, `GET /api/sessions`, `GET /api/launch-commands`, `GET /api/quick-launch`, `GET /api/shell-setup`, `POST /api/shell-setup/install` |

### Domain Types

```typescript
type GatewayStatus = GatewayStatusResponse  // daemon status, ports, uptime, model mode, etc.
type ProviderStat = GatewayProviderStat    // per-provider requests, errors, latency
type StatsResponse = { providers: GatewayProviderStat[] }
type LaunchCommands = LaunchCommandsResponse  // CLI command strings
type QuickLaunch = QuickLaunchResponse
type ShellSetup = ShellSetupResponse          // shell info: paths, installed status, snippets
type InstallResponse = InstallShellSetupResponse
```

---

## Feature: Live Sessions (`features/live-session/`)

Monitors all currently active Claude Code sessions in real time.

### Components

| Component | Purpose |
|---|---|
| `LiveSessionPage` | Shows all active sessions with a "RUNNING"/"IDLE" badge, aggregate metric summary, and one collapsed-by-default panel per session containing metadata, provider stats, models used, and request log. Auto-refreshes every 5 seconds. |

### Hooks

| Hook | Purpose |
|---|---|
| `useLiveSession` | Polls `GET /api/sessions` every 5 seconds, extracting `currentSessions` (all active sessions). Uses a request ID ref to ignore stale responses. Returns `sessions`, `isLoading`, `refresh()`, `pollIntervalMs`. |
| `useLiveIndicator` | Lightweight poll (every 10s) that checks if `current` is non-null. Used by the Sidebar for the pulsing dot indicator. |

### Relation to History

The live session page reuses components from the **history** feature:
- `SessionMetadataCards` — metadata display
- `ProvidersTable` — per-provider stats table
- `ModelsUsedTable` — per-model stats table
- `RequestLogTable` — request log entries

---

## Feature: History (`features/history/`)

Displays archived Claude Code sessions with detailed breakdowns.

### Components

| Component | Purpose |
|---|---|
| `HistoryPage` | Main page: summary stats, session list with expandable rows, per-session JSON export, and clear-history controls. |
| `HistorySummary` | Aggregated high-level stats (total sessions, requests, errors). |
| `HistoryTopStats` | Top provider and top model cards derived from session data. |
| `HistoryHeader` | Page controls: clear history button, help tooltip. |
| `ClearHistoryModal` | Confirmation modal for clearing the entire archive. |
| `SessionsTable` | Expandable table of archived sessions. Each row expands to show request log details and includes export/delete actions. |
| `SessionDetails` | Expanded row content: request log entries and metadata for a session. |
| `SessionMetadataCards` | Shows session metadata: launch hint, provider, model, duration. |
| `RequestLogTable` | Table of individual API requests within a session (model, provider, latency, status, response/preview availability, warnings). |
| `RequestDetails` | Detailed view of a single request log entry, including the human-readable prompt, sanitized provider request preview, conversion warnings, and response preview. |
| `ProvidersTable` | Per-provider aggregate stats within a session (or globally). |
| `ModelsUsedTable` | Per-model aggregate stats within a session (or globally). |
| `TableExpandButton` | Toggle to expand/collapse a session row. |
| `SectionLabel` | Section header used in table expand rows. |

### Hooks

| Hook | Purpose |
|---|---|
| `useHistory` | Polls `GET /api/sessions` and `GET /api/stats` every 5 seconds. Manages sessions, provider stats, totals, expanded keys, clear/delete/export operations. |
| `useHistoryPage` | Orchestrator hook that filters and sorts sessions, derives top provider/model info, manages the clear modal. |

### Services

| Service | Endpoints Used |
|---|---|
| `historyService` | `GET /api/sessions`, `GET /api/stats`, `DELETE /api/sessions` (clear archive), `DELETE /api/sessions/:id` (delete single session) |
| `sessionExport` | Exports a single `SessionRecord` as formatted JSON. In Tauri it invokes `save_session_json`; in browser/dev fallback it downloads a Blob. |

### Domain

| File | Purpose |
|---|---|
| `types.ts` | Type aliases: `Session`, `ModelStat`, `RequestLogEntry`. Imports contract types from daemon. |
| `metrics.ts` | `getTopProviderInfo(sessions)`, `getTopModelInfo(sessions)` — computes top providers/models from session data. |
| `format.ts` | `formatDate(ts)`, `formatTime(ts)`, `formatNumber(n)`, `commandFor(session)`, `topModel(session)`, `stripModelPrefix(model)`. |
| `labels.ts` | `providerLabel(id)` — maps provider IDs to human-friendly names (OpenAI, GitHub Copilot, DeepSeek, etc.). ~40 provider labels. |

### Data Flow

1. `useHistory` polls `/api/sessions` and `/api/stats` every 5 seconds.
2. Sessions are stored in `archive` (sorted newest-first) with per-session `requestLog`, `modelStats`, and `providerStats`.
3. `SessionsTable` renders sessions as expandable Ant Design table rows.
4. Expanding a row renders `SessionDetails`, which shows `RequestLogTable` from the session's `requestLog` entries.
5. Exporting a row serializes that session to `session-{id}.json`. Desktop builds save it through Tauri to the user's Downloads directory; browser/dev builds use a normal Blob download.
6. Global aggregate stats come from the `/api/stats` endpoint.

---

## Feature: Logs (`features/logs/`)

Real-time server log viewer using Server-Sent Events.

### Components

| Component | Purpose |
|---|---|
| `ServerLogsPage` | Main page: log summary cards (error/warn/info/debug counts), toolbar (search, level filter, pause, wrap, line numbers, download), and the `LogViewer` terminal. |
| `LogsSummary` | Card grid showing log level counts. |
| `LogViewer` | Virtualized log display terminal with syntax highlighting per log level. Auto-scrolls to bottom (unless user scrolls up). |
| `LogsToolbar` | Toolbar with search input, level filter dropdown, pause/resume, wrap toggle, line number toggle, clear, and download buttons. |

### Hooks

| Hook | Purpose |
|---|---|
| `useServerLogs` | Subscribes to SSE at `/api/logs`. Maintains last 5000 lines. Provides `filteredLogs` (by level + search), `stats` (counts per level), and all toolbar state (paused, search, levelFilter, wrapLines, showLineNumbers). Includes `downloadLogs()` to export as `.log`; desktop builds invoke `save_server_logs`, while browser/dev builds use a Blob download. |
| `useLogViewerScroll` | Manages auto-scroll behavior. Tracks whether the user is at bottom, scrolls to bottom on new lines when unpaused and at bottom. |

### Domain

```typescript
type LogLevel = "all" | "error" | "warn" | "info" | "debug"

interface ParsedLogLine {
  time: string | null
  level: string | null
  module: string | null
  message: string
}
```

- `parseLogLine(line)` — Parses daemon log format: `HH:MM:SS.ms [LEVEL] [MODULE] message`.
- `getLogLevelColor(level)` — Maps levels to Ant Design semantic colors.
- `getLogLineBackground(level)` — Returns subtle background tint for error/warn lines.
- `detectLogLevel(line)` — Regex-based level detection from raw log lines.

---

## Feature: Model Chain (`features/model-chain/`)

Editor for **model fallback chains**. When the primary model fails (rate limit, error, empty/malformed stream, or pre-content stream idle), the gateway falls back to the next model in the chain.

### Components

| Component | Purpose |
|---|---|
| `ModelChainPage` | Main page: list of chains with enable/disable toggles, edit/delete actions, "Economy/Local" preset, and "New Chain" button. |
| `ChainCard` | Card displaying a single chain with its models list, enable toggle, copy snippet button, and edit/delete actions. |
| `ChainModal` | Modal for creating/editing a chain. Includes name, slug (auto-derived), enable toggle, routing strategy, primary attempts, advanced chain timeout settings, and drag-and-drop model list. |
| `SortableModels` | Drag-and-drop list container using `@dnd-kit/sortable`. |
| `SortableModelRow` | Individual draggable model row with provider + model label and delete button. |
| `AddModelRow` | Form row to add a new model: provider dropdown + model dropdown (filtered by selected provider). |
| `CopySnippet` | Copies the CLI snippet for launching with a specific chain (`ccpg --chain-slug`). |

### Hooks

| Hook | Purpose |
|---|---|
| `useModelChainPage` | Fetches `GET /api/config` (model fallbacks/provider state) and `GET /api/routing/options`. Manages chain list state, enabled providers, `persist()`, `deleteChain()`, `toggleChainEnabled()`. |
| `useChainDraft` | Manages the chain edit modal: `openNew()`, `openEdit(chain)`, `saveDraft()`, `cancelEdit()`. Normalizes slugs via `normalizeSlug()`. |

### Services

| Service | Endpoints Used |
|---|---|
| `modelChainService` | `GET /api/config` (model fallbacks), `GET /api/routing/options`, `PUT /api/config` (save model fallbacks) |

### Domain

```typescript
type ModelFallbackConfig = {
  id: string
  name: string
  slug: string
  enabled: boolean
  models: ModelFallbackEntry[]  // provider + model pairs, ordered
}

type RoutingOption = {
  id: string
  label: string
  models: Array<{ id: string; display_name: string }>
}
```

- `normalizeSlug(value)` — Sanitizes a slug: trims, replaces spaces with hyphens, strips non-alphanumeric chars, truncates to 63 chars.

---

## Feature: Providers (`features/providers/`)

The most feature-rich module. Manages built-in and user-created LLM providers: API key configuration, OAuth login, custom OpenAI/Anthropic-compatible provider creation, model selection, connection testing, and favorites.

### Components

| Component | Purpose |
|---|---|
| `ProvidersPage` | Main page: search bar, status filter, provider grid grouped by configuration type, custom provider section, favorites toolbar, and custom-provider modal state. |
| `ProviderToolbar` | Search input + status filter (all/enabled/disabled/configured/unconfigured). |
| `ProviderTabs` | Tab bar with "Favorites" and "All Providers" tabs plus right-aligned tab actions for adding OpenAI- or Anthropic-compatible custom providers. |
| `ProviderGridSection` | Renders a group of provider cards with a section title. Built-in groups render first; the custom provider section renders last on the All Providers tab. |
| `SortableFavoritesGrid` | Drag-and-drop grid for favorite providers using `@dnd-kit`. |
| `ProviderCard` | Individual provider card: logo, label, enabled switch, test button, status indicator, favorite star. |
| `ProviderCardSkeleton` | Loading skeleton for a provider card. |
| `ProviderLogo` | Provider logo image. Built-ins load from `packages/panel/public/providers/`; custom providers can use daemon-served `logoUrl` files uploaded by the user. |
| `AddCustomProviderModal` | Creates OpenAI-compatible or Anthropic-compatible custom providers from name, immutable slug, base URL, API key, optional PNG/WebP logo, and a connection test that can return discovered models. |
| `ProviderConfigModal` | Full-featured configuration modal. Contains sections for API key, OAuth, base URL, model picker, manual/extra models, and custom-provider deletion. |
| `ProviderConfigContent` | Modal content orchestrator — renders the appropriate sections based on provider type. Custom providers show Custom Base URL, API Key Authentication, then Manual models before the shared sections. |
| `ApiKeySection` | API key input with preview, reveal/hide, and remove. |
| `OAuthSection` | OAuth login/logout buttons with status display. |
| `OAuthProviderSettings` | OAuth-specific UI for device flow providers (GitHub Copilot, Kilo Code) showing user code and verification URI. |
| `BaseUrlSection` | Custom base URL override input. |
| `ModelPickerSection` | Enabled/disabled model toggle list with search. Uses `useModelSelector`. |
| `ExtraModelsSection` | Add/remove additional model IDs not in the auto-discovered list. Custom providers label this surface as **Manual models**. |
| `ModelSelector` | Dual-list model picker: search, toggle individual models, toggle all, expand/collapse. |
| `ConfirmModal` | Confirmation dialog for destructive actions (replace/remove key, change URL, delete custom provider). |
| `CopilotDevicePrompt` | Prompts the user to enter their device code when the daemon returns a Copilot device flow. |

### Hooks

| Hook | Purpose |
|---|---|
| `useProviders` | Core hook: fetches `GET /api/providers`, manages `test()`, `toggleEnabled()`, `saveKey()`, `removeKey()`, `saveBaseUrl()`, `addModel()`, `removeModel()`, `setDisabledModels()`, `testCustom()`, `createCustom()`, and `deleteCustom()`. |
| `useProvidersPage` | Page orchestrator: composes `useProviders`, `useOAuth`, `useFavorites`. Manages search, status filter, selected provider for modal, custom-provider compatibility modal, and confirm action state. |
| `useOAuth` | Manages OAuth flows: `startBrowserFlow(id)` and `startDeviceFlow(id)`. Polls `GET /api/providers/:id/oauth/status/:key` until login completes or times out. Handles `logout()`. Device flow opens verification URI in external browser. |
| `useFavorites` | Persists favorite provider order to backend via `GET /api/config` and `PUT /api/config` (panel settings). Handles `toggleFavorite()`, `reorderFavorites()`, `dismissTip()`. |
| `useModelSelector` | Model selection logic: search filtering, toggle individual/all, counts (active/total). |
| `useProviderModels` | Fetches `GET /api/models/:id` lazily when the config modal opens. Returns `models`, `loading`, `load()`. |

### Services

| Service | Endpoints Used |
|---|---|
| `providersService` | `GET /api/providers`, `POST /api/providers/:id/test`, `GET /api/models/:id`, `PUT /api/config` (provider config), custom provider endpoints (`POST /api/custom-providers/test`, `POST /api/custom-providers`, `DELETE /api/custom-providers/:id`), OAuth endpoints (`/providers/:id/oauth/start`, `/providers/:id/oauth/status/:key`, `/providers/:id/oauth/logout`) |

### Domain

| File | Purpose |
|---|---|
| `types.ts` | Type aliases: `ProviderInfo` (including `custom`, `customCompatibility`, and `logoUrl`), `ModelInfo`, `TestResult`, `OAuthInfo`, `OAuthStatusResponse`, `CopilotFlow`, `ConfirmAction`. |
| `constants.ts` | Provider classification: `LOCAL_PROVIDERS` (ollama, lmstudio, llamacpp), `OAUTH_PROVIDERS` (openai_account, copilot, kiro, iflow, kilocode, cline), `DEVICE_FLOW_PROVIDERS` (copilot, kilocode), `COMING_SOON_PROVIDERS` (kiro, iflow). |
| `status.ts` | `getProviderKind(provider)` — "local" / "oauth" / "api-key". `isProviderReady(provider)` — whether the provider is configured and ready to use. `canTestProvider(provider)` — whether test is possible (enabled + ready). |
| `providerGroups.ts` | `groupProvidersByConfiguration(providers)` — sorts built-in providers into Local / OAuth / API Key groups, sorted by label. Custom providers are rendered separately at the end of All Providers. |
| `providerFilters.ts` | `filterProviders(providers, { searchTerm, status })` — filters by search text and status. |
| `utils.ts` | `mergeModelLists(value)` — deduplicates and trims model IDs. `stripModelPrefix(displayName)` — removes `"provider · "` prefix. |
| `oauthPresentation.ts` | Presentation helpers for OAuth provider labels and descriptions. |
| `apiKeyLinks.ts` | Maps provider IDs to their API key dashboard URLs (e.g., OpenAI's platform.openai.com/api-keys). |
| `data/suggestedModels.ts` | `SUGGESTED_MODELS` — curated model suggestions for ~20 providers (GLM, Kimi, MiniMax, Qwen, DeepSeek, etc.). Used to pre-populate the "Add Model" input with common model IDs. |

---

## Feature: Routing (`features/routing/`)

Configures **tier-based routing rules** that override which provider+model handles specific Claude model tiers.

### Components

| Component | Purpose |
|---|---|
| `RoutingPage` | Main page: save button, four tier cards (default/opus/sonnet/haiku), thinking toggle. |
| `TierCard` | Card for a single routing tier. Shows tier description, enabled toggle, provider dropdown, model dropdown. Color-coded border glow. |
| `TierCardSkeleton` | Loading skeleton for a tier card. |
| `ThinkingToggle` | Toggle switch for thinking mode (extended reasoning). |

### Hooks

| Hook | Purpose |
|---|---|
| `useRouting` | Fetches `GET /api/config` (routing) and `GET /api/routing/options`. Manages routing rules map (`RoutingMap`), thinking toggle, `updateRule()`, and `save()`. Sanitizes rules before save (disables rules with empty provider/model). |
| `useTierCard` | Derives display data for a single tier: provider options, model options (filtered by selected provider), validation (missing model detection), enable-ability. |

### Services

| Service | Endpoints Used |
|---|---|
| `routingService` | `GET /api/config` (routing), `GET /api/routing/options`, `PUT /api/config` (save routing + thinking) |

### Domain

```typescript
type Tier = "default" | "opus" | "sonnet" | "haiku"

type RoutingRule = {
  enabled: boolean
  providerId: string
  model: string
}

type RoutingMap = Record<Tier, RoutingRule>
```

**Tier descriptions:**
- **default**: Catch-all — applies when no tier-specific rule matches.
- **opus**: Overrides `claude-opus-*` model requests.
- **sonnet**: Overrides `claude-sonnet-*` model requests.
- **haiku**: Overrides `claude-haiku-*` model requests.

---

## Feature: Settings (`features/settings/`)

Configures server, web tools, proxy, and token saver settings.

### Components

| Component | Purpose |
|---|---|
| `SettingsPage` | Main page with save button and four settings sections. |
| `SettingsSection` | Wraps a settings card with a title and description. |
| `SettingsCard` | Base card container for a settings group. |
| `ServerCard` | Server port and host configuration (Ant Design Form). |
| `WebToolsCard` | Web tools toggle + "Allow private networks" checkbox. |
| `ProxyCard` | Proxy enable toggle + URL input. |
| `TokenSaversCard` | RTK and Caveman toggles + Caveman level selector (`"lite"`/`"full"`). |

### Hooks

| Hook | Purpose |
|---|---|
| `useSettings` | Fetches `GET /api/config` (settings subset). Manages server form, web tools, proxy, and token savers state. Handles `save()` with optimistic update and save feedback. |

### Services

| Service | Endpoints Used |
|---|---|
| `settingsService` | `GET /api/config` (settings), `PUT /api/config` (server + webTools + proxy + tokenSavers) |

### Domain Types

```typescript
type ServerConfig = Partial<Config["server"]>
type WebToolsConfig = { enabled: boolean; allowPrivateNetworks: boolean }
type ProxyConfig = { enabled: boolean; url: string }
type TokenSaversConfig = { rtkEnabled: boolean; cavemanEnabled: boolean; cavemanLevel: "lite" | "full" | "ultra" }
```

---

## API Connection Flow

All panel-daemon communication flows through the shared API layer:

```text
Feature Hook → Feature Service → shared/api/http.ts → shared/api/client.ts → shared/api/base.ts
```

**URL resolution (`base.ts`):**

1. Check if running in Tauri (`window.__TAURI_INTERNALS__`)
2. If Tauri and not external dev daemon: prepend `http://127.0.0.1:6767`
3. Otherwise: use relative path (same-origin in dev, proxied by Vite)

**SSE streaming:**

The `useSSE` hook creates an `EventSource` to `apiUrl(path)`. The daemon sends JSON-encoded events on the `message` channel. Used by:
- Live logs (`/api/logs`) — Dashboard live logs panel and Server Logs page.

**Polling:**

Most features use `usePolling` at 5-second intervals for real-time updates:
- Gateway status (`/api/status`)
- Sessions (`/api/sessions`)
- Live session indicator (10-second interval)

---

## Data Contracts

All types shared between panel and daemon are defined in `packages/daemon/src/panel/contracts.ts`. The panel feature domain files re-export and alias these types. Key contracts:

| Contract | Used By |
|---|---|
| `GatewayStatusResponse` | Shell (TopBar), Dashboard (StatusOverview) |
| `GatewayProviderStat` | Dashboard, History |
| `ProviderInfo` | Providers |
| `ModelInfo` | Providers (model selector) |
| `ProviderTestResult` | Providers (connection testing) |
| `OAuthInfo`, `OAuthStatusResponse` | Providers (OAuth flow) |
| `SessionsResponse`, `SessionRecord` | Live Sessions, History |
| `RoutingConfigResponse`, `RoutingOption`, `RoutingTier` | Routing, Model Chain |
| `ShellSetupResponse`, `ShellInfo` | Dashboard (shell setup) |
| `LaunchCommandsResponse`, `QuickLaunchResponse` | Dashboard (quick launch) |
| `SettingsConfigResponse` | Settings |

---

## Code Splitting

All feature pages are lazy-loaded via `React.lazy()` in `app/routes.tsx`. The `AppShell` provides a `<Suspense>` boundary with an Ant Design `Skeleton` fallback. This means each feature's code is split into its own chunk, loaded only when the user navigates to that route.
