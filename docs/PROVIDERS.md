# Providers

> Supported provider catalog, setup behavior, auth modes, and contributor notes.

CCPG keeps provider support in the daemon. The panel reads provider metadata from
the daemon API and only adds UI presentation details such as grouping,
favorites, icons, suggested models, and OAuth-specific controls.

## Provider Types

| Type | How users configure it | Examples |
|---|---|---|
| OAuth | Sign in from the Providers page. Tokens are stored in the encrypted secret store. | OpenAI Account, GitHub Copilot, Kilo Code, Cline |
| API key | Paste an upstream provider key in the provider modal. | OpenRouter, Groq, xAI, Mistral, Command Code |
| Local | Run the local model server and adjust the base URL if needed. | Ollama, LM Studio, llama.cpp |
| Custom OpenAI-compatible | Click **Add OpenAI Compatible**, enter name/slug/base URL/API key, optionally upload a PNG/WebP logo. | Self-hosted or third-party OpenAI Chat Completions-compatible endpoints |
| Custom Anthropic-compatible | Click **Add Anthropic Compatible**, enter name/slug/base URL/API key, optionally upload a PNG/WebP logo. | Self-hosted or third-party Anthropic Messages-compatible endpoints |
| Coming soon OAuth | Visible in the UI, disabled until the flow is implemented. | Kiro AI, iFlow AI |

## Supported Providers

### OAuth Providers

| Provider | ID | Status | Notes |
|---|---|---|---|
| OpenAI Account | `openai_account` | Functional | PKCE OAuth against the ChatGPT account backend. |
| GitHub Copilot | `copilot` | Functional | GitHub device flow plus short-lived Copilot API token. |
| Kilo Code | `kilocode` | Functional | Device flow OAuth, OpenAI-compatible routing, optional organization header. |
| Cline | `cline` | Functional | Browser authorization flow with token refresh. |
| Kiro AI | `kiro` | Coming soon | UI placeholder returns a clear not-implemented error if called. |
| iFlow AI | `iflow` | Coming soon | UI placeholder returns a clear not-implemented error if called. |

### API Key Cloud Providers

| Provider | ID | Transport |
|---|---|---|
| OpenRouter | `openrouter` | Anthropic Messages |
| DeepSeek | `deepseek` | Anthropic Messages |
| NVIDIA NIM | `nvidia_nim` | OpenAI Chat |
| Kimi (Moonshot) | `kimi` | OpenAI Chat |
| Google AI (Gemini) | `google` | OpenAI Chat |
| Groq | `groq` | OpenAI Chat |
| xAI (Grok) | `xai` | OpenAI Chat |
| Mistral | `mistral` | OpenAI Chat |
| Cerebras | `cerebras` | OpenAI Chat |
| Together AI | `together` | OpenAI Chat |
| Fireworks AI | `fireworks` | OpenAI Chat |
| GLM (Z.AI) | `glm` | Anthropic Messages |
| SiliconFlow | `siliconflow` | OpenAI Chat |
| Hyperbolic | `hyperbolic` | OpenAI Chat |
| Chutes AI | `chutes` | OpenAI Chat |
| Perplexity | `perplexity` | OpenAI Chat |
| Nebius AI | `nebius` | OpenAI Chat |
| GLM China | `glm_cn` | OpenAI Chat |
| Volcengine Ark | `volcengine_ark` | OpenAI Chat |
| BytePlus ModelArk | `byteplus` | OpenAI Chat |
| Alibaba Bailian | `alicode` | OpenAI Chat |
| Alibaba Bailian Intl | `alicode_intl` | OpenAI Chat |
| Minimax | `minimax` | Anthropic Messages |
| Minimax China | `minimax_cn` | Anthropic Messages |
| OpenCode Go | `opencode_go` | OpenAI Chat |
| Xiaomi MiMo | `xiaomi_mimo` | OpenAI Chat |
| Xiaomi MiMo Token Plan | `xiaomi_tokenplan` | OpenAI Chat |
| Cohere | `cohere` | OpenAI Chat |
| Blackbox AI | `blackbox` | OpenAI Chat |
| HuggingFace Router | `huggingface` | OpenAI Chat |
| Ollama Cloud | `ollama_cloud` | OpenAI Chat |
| Command Code | `commandcode` | Custom AI SDK v5 NDJSON stream |

### Local Providers

| Provider | ID | Default URL |
|---|---|---|
| Ollama Local | `ollama` | `http://localhost:11434` |
| LM Studio | `lmstudio` | `http://localhost:1234/v1` |
| llama.cpp | `llamacpp` | `http://localhost:8080/v1` |

### User-Created Custom Providers

Custom providers are not part of `PROVIDER_IDS`; they are stored in
`config.providers` under the user-chosen slug. The daemon creates the provider
at runtime from `config.providers.<slug>.custom.compatibility`:

| Compatibility | Runtime transport | Upstream endpoints |
|---|---|---|
| `openai` | `OpenAIChatTransport` | `{baseUrl}/models`, `{baseUrl}/chat/completions` |
| `anthropic` | `AnthropicMessagesTransport` | `{baseUrl}/models`, `{baseUrl}/messages` |

Creation flow:

1. Open **Providers**.
2. Use the tab action **Add OpenAI Compatible** or **Add Anthropic Compatible**.
3. Enter display name, immutable slug, Base URL, API key, and optionally a PNG/WebP logo.
4. Click **Test Connection** to probe model discovery before saving.
5. Save the provider. If discovery fails or returns no models, open the provider details and add **Manual models**.

Custom provider details intentionally allow editing only Base URL, API key, enabled state, manual/disabled models, and deletion. Name, slug, and logo are immutable after creation; delete and recreate the provider to change them.

Uploaded logos are stored locally in
`~/.config/claude-code-provider-gateway/provider-logos/` (or the Windows
`%APPDATA%` equivalent). API keys are stored in `secrets.enc.json`, not
`config.json`.

## CLI Flags

Provider flags are defined in `packages/daemon/src/config/schema.ts`. They are
case-insensitive in the shell setup flow.

| Provider | Flags |
|---|---|
| OpenAI Account | `--OpenAIAccount` |
| GitHub Copilot | `--Copilot`, `--GitHubCopilot` |
| NVIDIA NIM | `--NvidiaNim` |
| OpenRouter | `--OpenRouter` |
| DeepSeek | `--DeepSeek` |
| Kimi | `--Kimi` |
| Google AI | `--Google`, `--GoogleAI` |
| Ollama Local | `--Ollama`, `--OllamaLocal` |
| Ollama Cloud | `--OllamaCloud` |
| LM Studio | `--LMStudio` |
| llama.cpp | `--LlamaCpp` |
| Groq | `--Groq` |
| xAI | `--XAI`, `--Grok` |
| Mistral | `--Mistral` |
| Cerebras | `--Cerebras` |
| Together AI | `--Together` |
| Fireworks AI | `--Fireworks` |
| GLM | `--GLM`, `--ZAI` |
| SiliconFlow | `--SiliconFlow` |
| Hyperbolic | `--Hyperbolic` |
| Chutes AI | `--Chutes` |
| Perplexity | `--Perplexity` |
| Nebius AI | `--Nebius` |
| GLM China | `--GLMCN` |
| Volcengine Ark | `--VolcengineArk`, `--Ark` |
| BytePlus | `--BytePlus` |
| Alibaba Bailian | `--Alicode`, `--Bailian` |
| Alibaba Bailian Intl | `--AlicodeIntl` |
| Minimax | `--Minimax` |
| Minimax China | `--MinimaxCN` |
| OpenCode Go | `--OpenCodeGo` |
| Xiaomi MiMo | `--XiaomiMimo`, `--MiMo` |
| Xiaomi MiMo Token Plan | `--XiaomiTokenPlan` |
| Cohere | `--Cohere` |
| Blackbox AI | `--Blackbox` |
| HuggingFace Router | `--HuggingFace`, `--HF` |
| Kiro AI | `--Kiro` |
| iFlow AI | `--IFlow` |
| Kilo Code | `--KiloCode` |
| Cline | `--Cline` |
| Command Code | `--CommandCode` |
| All enabled providers | `--all`, `--a` |
| All enabled Model Chains | `--ModelChain`, `--ModelChains`, `--chains` |
| One enabled Model Chain | `--<chain-slug>` |
| One custom provider | `--<custom-provider-slug>` |

## Model Discovery And Manual Models

Most providers expose `/models` and CCPG maps those records into Anthropic
`ModelInfo` entries. Some providers return no useful catalog or have special
catalog behavior. For those, the panel can show a manual model picker after the
provider is ready.

- Suggested manual model IDs live in
  `packages/panel/src/features/providers/data/suggestedModels.ts`.
- User-added model IDs are stored in `config.providers.<id>.models`.
- Disabled model IDs are stored in `config.providers.<id>.disabledModels`.
- Custom providers always expose the manual picker as **Manual models** in the
  details modal, even when auto-discovery succeeds.
- In `all` mode, models are exposed as gateway-prefixed IDs such as
  `anthropic/groq/llama-3.3-70b-versatile`.
- Model Chain entries are exposed as synthetic IDs such as
  `anthropic/chain/my-chain`.

## Model Chains

Model Chains are user-defined custom models built from active provider models.
They are configured in the panel under **Model Chain** and stored as
non-secret config in `config.modelFallbacks`.

Each chain contains:

| Field | Purpose |
|---|---|
| `id` | Stable internal id generated by the app. |
| `name` | Human-readable name shown in the panel and Claude Code model picker. |
| `slug` | CLI/model slug. `ccpg --<slug>` launches only that chain. |
| `enabled` | Controls whether the chain is exposed to Claude Code. |
| `models[]` | Ordered fallback targets, each with `providerId` and `model`. |

The chain model name shown to Claude Code is:

```text
{Name} · Gateway : Custom Models (Defined by user)
```

The daemon exposes chain models as `anthropic/chain/<slug>`. For backward
compatibility, the router also understands the older `anthropic/fallback/<slug>`
shape.

Launch behavior:

| Command | Catalog behavior |
|---|---|
| `ccpg --<chain-slug>` | Sets `activeModelFallbackSlug` and exposes only that chain. |
| `ccpg --ModelChain` | Sets `modelMode` to `chains` and exposes every enabled chain. |
| `ccpg --all` | Sets `modelMode` to `all` and exposes enabled chains plus all enabled provider models. |
| `ccpg --<Provider>` | Sets `modelMode` to `single`, clears active chain state, and exposes chains plus the selected provider's models. |

At request time, the message service calls the first target in the chain. If
that target returns a non-successful response such as an API error, rate limit,
quota/credit failure, or network error, CCPG retries that target and then moves
to the next target. The configured order is therefore the user's priority
order. When a chain is selected as the session primary model, background Claude
Code tier requests stay on the chain instead of falling back to a provider's
default model list.

The Model Chain editor uses `GET /api/routing/options`, so a provider must be
enabled and its models must be discoverable or manually configured before those
models are selectable in a chain.

## Panel Provider UX

The Providers page supports:

- Search by provider label.
- Active/inactive filtering.
- Provider groups by configuration type.
- A **Custom Providers (OpenAI/Anthropic Compatible)** section at the end of
  the All Providers tab; creation buttons are aligned with the tab bar actions.
- Favorite providers saved in `config.panelSettings.favoriteProviders`.
- Drag-and-drop ordering for favorites.
- Confirmation before replacing/removing API keys or changing local base URLs.
- Custom provider deletion requires confirmation and removes its config,
  encrypted API key, uploaded logo, routing references, Model Chain targets,
  and favorite entry.
- Direct API key documentation links for known providers.

Built-in provider icons live in `packages/panel/public/providers/<provider_id>.webp`.
Custom provider logos live in the user's config directory under `provider-logos/`.

## Adding Or Updating Providers

Use [Adding a Provider](ADDING_PROVIDER.md) for the full checklist. In short,
the daemon source of truth is:

- `PROVIDER_IDS`, defaults, labels, CLI flags, and OAuth membership in
  `packages/daemon/src/config/schema.ts`
- Registry entry in `packages/daemon/src/proxy/providers/registry.ts`
- Declarative factories in `packages/daemon/src/proxy/providers/provider-factory.ts`
  for simple OpenAI Chat or Anthropic Messages providers
- Dedicated provider implementation in `packages/daemon/src/proxy/providers/`
  only for custom behavior such as OAuth, dynamic headers, custom catalogs,
  base URL normalization, custom streams, or dual transport dispatch
- Focused tests for auth, model mapping, stream transformation, and custom
  parsing/refresh code

Panel additions are usually limited to icons, suggested models, API key links,
and OAuth presentation text.

The current provider architecture intentionally avoids one file per provider
when that file would only contain `id`, `label`, and `extends Transport`.
Plain built-in providers are registered with `createOpenAIProvider("<id>")` or
`createAnthropicProvider("<id>")`; dedicated files are reserved for built-ins
with custom behavior. User-created custom providers are config-defined and do
not need source files.
