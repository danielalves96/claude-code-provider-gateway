# Maintenance Notes

> Known limitations, fragile areas, and improvement priorities for maintainers.
> This is not a public product roadmap; it is a practical map of places that
> deserve extra care during implementation and review.

## Current Maintenance Priorities

| Area | Why it matters | Suggested direction |
|---|---|---|
| Config reload | The proxy reloads config from disk on each request, which keeps settings fresh but adds synchronous file I/O to the hot path. | Cache parsed config and invalidate it with file watching or a short TTL. Only refresh provider instances whose config changed. |
| Provider registry invalidation | Clearing the full provider cache after every config reload can recreate providers unnecessarily, especially now that runtime custom providers are created from config. | Compare provider config snapshots or hashes and invalidate specific providers. |
| Session persistence | Session checkpoints and archive operations use local JSON files and can become expensive as request logs grow. | Add pagination/lazy loading for request logs, atomic archive writes, and clearer retention controls. |
| Request history privacy | Prompt and response previews are useful for debugging but are stored locally in plain JSON session records. | Add a config toggle for prompt/response capture, retention policy controls, and consider encrypted session archives. |
| Panel test coverage | The daemon has focused tests; the React panel currently relies mostly on manual validation. | Start with tests for shared hooks/services and critical flows like provider config, Model Chain setup, history, and shell setup. |
| Streaming edge cases | Provider SSE transforms are stateful and can be fragile with malformed or partial upstream events. Recent tests cover split useful content, cancellation, and mid-stream failures, but new providers can still regress this. | Keep adding transport-specific tests for partial chunks, malformed events, stalled streams, cancellation, and mid-stream provider failures. |
| Active-stream shutdown | The daemon shutdown path closes connections immediately, which can interrupt in-flight responses. | Track active requests, stop accepting new ones, wait with a timeout, then force close remaining connections. |

## Fragile Code Paths

| Path | Risk | Review guidance |
|---|---|---|
| `packages/daemon/src/proxy/services/message-service.ts` | Central orchestration for routing, token savers, Model Chains, native Claude passthrough, session logging, and provider dispatch. | Prefer small, well-tested changes. Add focused tests for every new branch in routing/fallback behavior. |
| `packages/daemon/src/proxy/services/provider-limiter.ts` | Enforces process-local provider concurrency and rate-window limits before upstream dispatch. | Verify slots release on stream completion, cancellation, and errors. Remember limits reset on daemon restart. |
| `packages/daemon/src/proxy/providers/transport-openai.ts` | Converts Anthropic Messages into OpenAI Chat Completions and transforms streaming chunks back to Anthropic SSE. | Verify text, tool calls, finish reasons, empty chunks, and provider error mapping. |
| `packages/daemon/src/proxy/providers/transport-anthropic.ts` | Streams native Anthropic-compatible provider responses. | Test partial lines and invalid upstream events when changing parser behavior. |
| `packages/daemon/src/proxy/providers/commandcode.ts` | Custom provider with request conversion, catalog handling, and NDJSON/SSE stream transformation. | Split new behavior into helper modules where possible and keep tests close to the stream state machine. |
| `packages/daemon/src/runtime/session-store.ts` | Reads, writes, archives, and deletes session JSON/JSONL files. | Prefer atomic writes, explicit logging on failure, and temp-directory tests for file operations. |
| `packages/daemon/src/config/secrets/` | Encrypts and hydrates API keys, OAuth tokens, and gateway auth token. | Treat changes as security-sensitive. Preserve backward compatibility and test corrupted/missing store cases. |
| `packages/daemon/src/panel/routes/provider-routes.ts` | Owns provider config updates plus custom provider create/test/delete and logo serving. | Verify deletion cleans config, encrypted API keys, routing refs, Model Chain refs, favorites, active provider fallback, and uploaded logos. |
| `packages/desktop/src-tauri/src/daemon_supervisor.rs` | Owns sidecar lifecycle in the desktop app. | Add tests around pure policy code and manually validate start/stop/restart behavior on the target OS. |

## Security Review Checklist

Use this checklist for changes touching auth, local APIs, provider errors, logs,
or storage:

- Does the proxy still bind to `127.0.0.1` only?
- Does every proxy API request still require the gateway auth token?
- Does any new panel API route need auth or origin handling updates?
- Are provider API keys and OAuth tokens kept out of `config.json`, logs, and docs?
- Do custom provider deletion paths remove encrypted API keys and uploaded logos?
- Are provider error messages sanitized before being shown or logged?
- Do client disconnects still abort upstream provider calls rather than waiting
  for request or stream timeout?
- Does any new file containing prompts, responses, tokens, or account data need
  retention controls or encryption?
- Does any new external URL opening path use the desktop allowlist rules?

## Performance Review Checklist

- Avoid adding synchronous filesystem work to per-request proxy paths.
- Avoid fetching every enabled provider catalog unless the feature genuinely
  needs an aggregated model list.
- Add or preserve timeouts and cancellation paths for long-running provider calls.
- For new transports, pass `ProviderRequestOptions.abortSignal` into
  `postProviderStream()` or equivalent upstream fetch logic.
- Keep SSE transforms streaming; do not buffer full model responses before
  writing downstream unless the feature explicitly requires capture.
- Keep dashboard/history endpoints bounded as session archives grow.

## Documentation Promotion Workflow

When a `.planning/` note becomes useful outside local analysis:

1. Verify it against source code.
2. Rewrite it for its real audience: user, contributor, or maintainer.
3. Remove implementation speculation unless it is clearly marked as a known
   limitation or future improvement.
4. Link to the relevant public docs from [Documentation Hub](README.md).
5. Update the root [README](../README.md) if the document belongs in the main
   reader path.

This keeps `.planning/` free to be detailed and exploratory while `docs/`
stays navigable, stable, and repository-ready.
