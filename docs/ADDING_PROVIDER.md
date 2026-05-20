# Adding a Provider

> Checklist for adding a new LLM provider to CCPG.

Providers are daemon-owned. The panel should consume provider metadata through
the daemon API instead of hardcoding provider behavior wherever possible.

If the provider is simply OpenAI Chat Completions-compatible or Anthropic
Messages-compatible, users can add it at runtime from the Providers page with
**Add OpenAI Compatible** or **Add Anthropic Compatible**. That flow stores the
provider under a custom slug, encrypts the API key, supports optional PNG/WebP
logos, and exposes **Manual models** when catalog discovery is unavailable. Use
this checklist only when the provider should become a built-in provider or
needs behavior that cannot be represented by the runtime custom-provider flow.

## Before You Start

Decide which transport shape the provider uses:

| Provider API | Registry shape |
| --- | --- |
| Anthropic Messages compatible with no custom behavior | `createAnthropicProvider("<id>")` |
| OpenAI Chat Completions compatible with no custom behavior | `createOpenAIProvider("<id>")` |
| Anthropic/OpenAI compatible with minor static options | Factory options in `provider-factory.ts` |
| OAuth-backed OpenAI Chat provider | `OpenAIChatTransport` with OAuth credential overrides |
| OAuth placeholder while the flow is not ported | `OAuthStubProvider` |
| Custom auth, catalog, or streaming format | `BaseProvider` |

Prefer an existing transport unless the provider truly needs custom auth,
custom catalog handling, or a non-standard stream format.

If the provider supports **multiple protocols depending on the model** (e.g.,
native Anthropic for first-party models, OpenAI Chat for everything else),
extend `BaseProvider` and dispatch inside `streamResponse()` — see
`copilot.ts` + `copilot-native-anthropic.ts` + `copilot-chat-stream.ts` as a
reference.

## Implementation Checklist

1. Add the provider id to `PROVIDER_IDS` in `packages/daemon/src/config/schema.ts`.
2. Add provider defaults in `PROVIDER_DEFAULTS`.
3. Add the display label in `PROVIDER_LABELS`.
4. Add a CLI flag in `CLI_FLAGS` when the provider should be launchable with `ccpg --ProviderName`.
5. Register the provider constructor in `packages/daemon/src/proxy/providers/registry.ts`.
   - For a plain OpenAI-compatible provider, use `createOpenAIProvider("<id>")`.
   - For a plain Anthropic-compatible provider, use `createAnthropicProvider("<id>")`.
   - For static variations, pass factory options such as `requiresApiKey: false`, `authHeaderStyle: "x-api-key"`, or `extraHeaders`.
   - Add a dedicated `packages/daemon/src/proxy/providers/<provider>.ts` only when factory options are not enough.
6. Add the provider to `OAUTH_PROVIDER_IDS` when it is OAuth-backed.
7. Add or update panel provider metadata only when the daemon API cannot derive it:
   - `packages/panel/public/providers/<id>.webp` for the card icon.
   - `packages/panel/src/features/providers/domain/constants.ts` for local, OAuth, device-flow, or coming-soon grouping.
   - `packages/panel/src/features/providers/data/suggestedModels.ts` when model discovery is empty or incomplete.
   - `packages/panel/src/features/providers/domain/apiKeyLinks.ts` when the provider has a useful key-management page.
   - `packages/panel/src/features/providers/domain/oauthPresentation.ts` for OAuth labels, descriptions, and button text.
8. Add tests before opening the PR.

Keep `docs/PROVIDERS.md` in sync when the provider is user-visible. If the
change is part of a migration batch, update `PROVIDERS_MIGRATION.md` too.

## Declarative Provider Pattern

Most OpenAI-compatible providers should not get their own file. Put them in the
registry:

```ts
import { createOpenAIProvider } from "./provider-factory.js";

const PROVIDER_MAP = {
  example: createOpenAIProvider("example"),
};
```

For a plain Anthropic Messages provider:

```ts
import { createAnthropicProvider } from "./provider-factory.js";

const PROVIDER_MAP = {
  example: createAnthropicProvider("example"),
};
```

Use factory options for small static differences:

```ts
const PROVIDER_MAP = {
  local_example: createAnthropicProvider("local_example", { requiresApiKey: false }),
  x_key_example: createAnthropicProvider("x_key_example", { authHeaderStyle: "x-api-key" }),
  header_example: createOpenAIProvider("header_example", {
    extraHeaders: { "X-Product": "ccpg" },
  }),
};
```

Create a dedicated provider file only when the behavior cannot be expressed
declaratively. Good reasons include:

- OAuth token refresh or non-API-key credentials.
- Custom `baseUrl()` normalization.
- Provider-specific `listModels()`.
- Dynamic headers based on config.
- Non-standard request or stream formats.
- Dual protocol dispatch.

### Dedicated Provider Pattern

When a provider does need code, keep it focused:

```ts
import { OpenAIChatTransport } from "./transport-openai.js";

export class ExampleProvider extends OpenAIChatTransport {
  get id() {
    return "example";
  }

  get label() {
    return "Example";
  }

  protected override extraHeaders(): Record<string, string> {
    return { "X-Example-Tenant": this.config.oauth?.orgId ?? "" };
  }
}
```

The shared transports already strip gateway model prefixes through
`stripGatewayProviderPrefix()`, so most providers do not need to override
`resolveModel()`.

## Required Tests

At minimum, add daemon tests for:

- Provider auth behavior: missing credentials should return a clear provider error.
- Model catalog mapping: provider model ids should become gateway model ids.
- Stream behavior: provider stream chunks should become Anthropic-compatible SSE.
- Routing behavior when the provider can be selected through model prefixes.

Use existing tests as patterns:

- `packages/daemon/src/proxy/providers/api-client.test.ts`
- `packages/daemon/src/proxy/services/model-service.test.ts`
- `packages/daemon/src/proxy/services/message-service.test.ts`
- `packages/daemon/src/proxy/routes/anthropic-routes.test.ts`

For custom OAuth/device flows, add focused tests around pure parsing, expiry,
refresh, and error classification code. Avoid tests that require live provider
accounts.

For custom stream formats, add focused tests for:

- Request conversion from Anthropic messages, tools, and tool results.
- Stream event conversion into valid Anthropic SSE.
- Error events and malformed provider chunks.
- Model prefix stripping and manual model merging, when applicable.

### Handling gateway model prefixes

If your provider is listed under the `all` model mode, Claude Code will send
requests with gateway-prefixed model names such as `anthropic/example/model-id`
or `example/model-id`. `OpenAIChatTransport` and `AnthropicMessagesTransport`
strip those prefixes automatically.

Only call the helper yourself when implementing a custom `BaseProvider` or a
custom model resolver:

```ts
import { stripGatewayProviderPrefix } from './model-prefix.js'

protected resolveModel(requestedModel: string): string {
  return stripGatewayProviderPrefix(requestedModel, this.id)
}
```

### Wrapping the response stream

Use the helpers in `proxy/services/stream-result.ts` to package your stream
into the `MessageServiceResult` type expected by the message service:

```ts
import { streamResult, streamResultWithCapture } from '../services/stream-result.js'

// Without response capture (simple case):
return streamResult(myReadableStream)

// With response capture for session logging (preferred):
return streamResultWithCapture(myReadableStream, logEntryId)
```

`streamResultWithCapture` tees the stream, stores a 4 KB response preview in
the session log entry, and does not affect delivery to the client.

### Dual-transport pattern

When a provider exposes both an Anthropic-native endpoint and an OpenAI Chat
endpoint, dispatch on the resolved model name inside `streamResponse()`:

```ts
async streamResponse(req: MessagesRequest, inputTokens: number): Promise<StreamResult> {
  const providerModel = this.resolveModel(req.model)

  if (providerModel.startsWith('claude-')) {
    // Native Anthropic protocol — preserves tool_use / thinking blocks
    return streamMyProviderNativeAnthropic({ req, providerModel, ... })
  }

  // Fallback to OpenAI Chat Completions
  const openaiReq = anthropicToOpenAI(req, providerModel)
  const result = await postProviderStream({ url: '...', body: openaiReq, ... })
  if ('error' in result) return { error: result.error }
  return { stream: transformMyChatStream(result.body, ...) }
}
```

For providers with a static or filtered model list, keep that logic inside the
provider class. For provider-wide HTTP concerns, prefer extending the shared
client or transport instead of duplicating fetch code.

### OAuth-backed OpenAI-compatible providers

When a provider uses OAuth but exposes an OpenAI-compatible API, extend
`OpenAIChatTransport` and override the credential hooks instead of adding a new
transport:

```ts
export class ExampleOAuthProvider extends OpenAIChatTransport {
  get id() { return 'example_oauth' }
  get label() { return 'Example OAuth' }

  protected override hasApiKey(): boolean {
    return !!this.config.oauth?.accessToken
  }

  protected override missingApiKeyMessage(): string {
    return `${this.label} is not logged in. Sign in via the Providers page.`
  }

  protected override authHeader(): string {
    return `Bearer ${this.config.oauth?.accessToken ?? ''}`
  }
}
```

If the UI card should exist before the OAuth flow is implemented, use
`OAuthStubProvider` and add the id to `COMING_SOON_PROVIDERS`. The stub should
make the state explicit to users instead of silently behaving like a broken API
key provider.

### Manual model picker support

Some providers do not expose a reliable `/models` endpoint. In that case:

1. Return an empty model list or a small fallback list from the provider.
2. Add useful suggestions in `suggestedModels.ts`.
3. Let users add extra models through the provider modal.
4. Store any user-added models in `config.providers.<id>.models`.

Do not hardcode panel-only model routing. The daemon must still own the final
model list and request routing.

#### `suggestedModels.ts` format

**File:** `packages/panel/src/features/providers/data/suggestedModels.ts`

`SUGGESTED_MODELS` is a `Partial<Record<ProviderId, SuggestedModel[]>>`. Each entry is keyed by the built-in provider ID and contains an ordered array of model suggestions shown in the "Add Model" input when no catalog models are available.

```ts
interface SuggestedModel {
  id: string;   // model ID sent to the provider API (exact string, case-sensitive)
  name: string; // human-readable label shown in the dropdown
}
```

Example entry for a new provider `my_provider`:

```ts
my_provider: [
  { id: "my-model-v2-pro", name: "My Model V2 Pro" },
  { id: "my-model-v2-lite", name: "My Model V2 Lite" },
],
```

Rules:
- `id` must match what the provider's API expects — it is sent verbatim in the request. Do not include gateway prefixes (`anthropic/`) here.
- Keep the list to the 3–8 most useful models. Avoid listing deprecated or region-restricted models unless they are commonly used.
- Suggestions are displayed regardless of whether catalog discovery succeeds, so keep them in sync with the provider's current model lineup.
- For providers with regional variants (e.g. `my_provider` vs `my_provider_cn`), maintain separate suggestion arrays — model IDs often differ between regions.

### Model Chain compatibility

The Model Chain page consumes `GET /api/routing/options`, which is built from
enabled providers and their enabled model catalogs. New providers become
selectable in chains automatically when their daemon model listing is accurate.

Before considering a provider done, verify:

- `listModels()` returns usable model ids and display names, or manual models
  are available through `config.providers.<id>.models`.
- Disabled models are respected through `config.providers.<id>.disabledModels`.
- A model selected in a chain can be routed by `message-service.ts` without
  provider-specific panel logic.
- Failure responses are returned as structured provider errors so the Model
  Chain executor can retry the target and advance to the next model.

## Local Verification

Run the same checks used by the PR quality gate:

```bash
npm test
npm run typecheck
npm run build

cd packages/desktop/src-tauri
cargo fmt --check
cargo check
cargo test
cargo clippy --all-targets -- -D warnings
```

## PR Notes

Every provider PR should include:

- Provider name and API protocol.
- Auth type: API key, OAuth, local unauthenticated, or custom.
- Example model id used during manual testing.
- Which tests were added.
- Whether the provider supports streaming tool calls.
- Whether the provider uses a single transport or dual-transport dispatch.
