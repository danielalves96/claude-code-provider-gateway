# Changelog

All notable changes to Claude Code Provider Gateway will be documented here.

The first public release is planned as **v0.1.0** with desktop installers attached to GitHub Releases.

## v0.1.3

### Added
- **Outbound proxy support** — new Outbound Proxy card in Settings to configure an HTTP/HTTPS proxy URL. When enabled, all daemon outbound requests (OpenAI OAuth token exchange, token refresh, provider API calls, model catalog fetches) are routed through the proxy. Local services (panel, Ollama, LM Studio, llama.cpp) always remain direct. Takes effect on next gateway restart.
- Actionable error message when OpenAI OAuth token exchange fails with `unsupported_country_region_territory`, guiding users to configure an outbound proxy.

### Changed
- Minimum Node.js version for development raised to **>=24** (end users are unaffected — the distributed app is a compiled Bun binary).

## 0.1.0 - Initial Release

- Desktop-first Tauri app with daemon sidecar.
- Local Anthropic-compatible proxy for Claude Code.
- Provider support for OpenAI Account, GitHub Copilot, OpenRouter, DeepSeek, NVIDIA NIM, Kimi, Google AI (Gemini), Ollama, LM Studio, and llama.cpp.
- Provider routing for single-provider mode and all-providers model discovery mode.
- Tier routing for Claude `opus`, `sonnet`, and `haiku` model classes.
- Local session history with request metadata, prompt capture, response preview, token counts, latency, and errors.
- Encrypted local secret store for API keys, OAuth tokens, and gateway auth token.
- Cross-platform desktop build workflow for macOS, Linux, and Windows.
