import type { ModelInfo } from "../../core/anthropic/types.js";

interface ProviderFetchOptions {
  url: string;
  headers: Record<string, string>;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

interface ProviderStreamOptions extends ProviderFetchOptions {
  body: unknown;
  streamIdleTimeoutMs?: number;
  streamTotalTimeoutMs?: number;
}

interface ProviderModel {
  id: string;
  name?: string;
  created?: number;
}

export type ProviderStreamResponse =
  | { body: ReadableStream<Uint8Array> }
  | { error: { status: number; message: string } };

export async function postProviderStream(
  options: ProviderStreamOptions,
): Promise<ProviderStreamResponse> {
  const timeout = createFetchTimeout(options.timeoutMs, options.abortSignal);
  let response: Response;
  try {
    response = await fetch(options.url, {
      method: "POST",
      headers: options.headers,
      body: JSON.stringify(options.body),
      signal: timeout.signal,
    });
  } catch (err) {
    if (timeout.didAbort()) return { error: timeoutError() };
    if (timeout.didExternalAbort()) return { error: abortedError() };
    return { error: networkError(err) };
  } finally {
    timeout.clear();
  }

  if (!response.ok) return { error: await readProviderError(response) };
  if (!response.body)
    return { error: { status: 500, message: "Provider returned an empty response body" } };

  return {
    body: withStreamTimeouts(response.body, {
      idleTimeoutMs: options.streamIdleTimeoutMs,
      totalTimeoutMs: options.streamTotalTimeoutMs,
      abortSignal: options.abortSignal,
    }),
  };
}

export async function fetchProviderJson<T>(options: ProviderFetchOptions): Promise<T> {
  const timeout = createFetchTimeout(options.timeoutMs, options.abortSignal);
  let response: Response;
  try {
    response = await fetch(options.url, { headers: options.headers, signal: timeout.signal });
  } catch (err) {
    if (timeout.didAbort()) {
      const error = timeoutError();
      throw new Error(`HTTP ${error.status} at ${options.url}: ${error.message}`);
    }
    if (timeout.didExternalAbort()) {
      const error = abortedError();
      throw new Error(`HTTP ${error.status} at ${options.url}: ${error.message}`);
    }
    const error = networkError(err);
    throw new Error(`HTTP ${error.status} at ${options.url}: ${error.message}`);
  } finally {
    timeout.clear();
  }
  if (!response.ok) {
    const error = await readProviderError(response);
    throw new Error(`HTTP ${error.status} at ${options.url}: ${error.message.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

export function mapProviderModels(
  models: ProviderModel[],
  providerId: string,
  label: string,
): ModelInfo[] {
  return models.map((model) => ({
    type: "model" as const,
    id: `anthropic/${providerId}/${model.id}`,
    display_name: `${label} · ${model.name ?? model.id}`,
    created_at: new Date((model.created ?? 0) * 1000).toISOString(),
  }));
}

async function readProviderError(response: Response): Promise<{ status: number; message: string }> {
  const message = await response.text().catch(() => "");
  return { status: response.status, message: sanitizeProviderMessage(message) };
}

function createFetchTimeout(
  timeoutMs: number | undefined,
  upstreamAbortSignal?: AbortSignal,
): {
  signal?: AbortSignal;
  clear: () => void;
  didAbort: () => boolean;
  didExternalAbort: () => boolean;
} {
  if (!timeoutMs) {
    return {
      signal: upstreamAbortSignal,
      clear: () => {},
      didAbort: () => false,
      didExternalAbort: () => upstreamAbortSignal?.aborted ?? false,
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  let externalAborted = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromExternal = () => {
    externalAborted = true;
    controller.abort();
  };
  if (upstreamAbortSignal?.aborted) abortFromExternal();
  else upstreamAbortSignal?.addEventListener("abort", abortFromExternal, { once: true });
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      upstreamAbortSignal?.removeEventListener("abort", abortFromExternal);
    },
    didAbort: () => timedOut,
    didExternalAbort: () => externalAborted,
  };
}

function timeoutError(): { status: number; message: string } {
  return { status: 504, message: "Provider request timed out" };
}

function abortedError(): { status: number; message: string } {
  return { status: 499, message: "Provider request aborted by client" };
}

function networkError(err: unknown): { status: number; message: string } {
  return { status: 502, message: `Provider network error: ${formatError(err)}` };
}

function formatError(err: unknown): string {
  if (err instanceof Error) return sanitizeProviderMessage(err.message);
  return sanitizeProviderMessage(String(err));
}

function sanitizeProviderMessage(message: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char strip
  return message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, 4000);
}

function withStreamTimeouts(
  body: ReadableStream<Uint8Array>,
  options: { idleTimeoutMs?: number; totalTimeoutMs?: number; abortSignal?: AbortSignal },
): ReadableStream<Uint8Array> {
  const { idleTimeoutMs, totalTimeoutMs, abortSignal } = options;
  if (!idleTimeoutMs && !totalTimeoutMs && !abortSignal) return body;

  const reader = body.getReader();
  let idleTimer: NodeJS.Timeout | null = null;
  let totalTimer: NodeJS.Timeout | null = null;
  let closed = false;
  let abortFromClient: (() => void) | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const fail = (message: string) => {
        if (closed) return;
        closed = true;
        clearTimers();
        if (abortFromClient) abortSignal?.removeEventListener("abort", abortFromClient);
        reader.cancel().catch(() => {});
        controller.error(new Error(message));
      };

      abortFromClient = () => {
        fail("Provider stream aborted by client");
      };

      const resetIdleTimer = () => {
        if (!idleTimeoutMs) return;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          fail(`Provider stream idle timeout after ${idleTimeoutMs}ms`);
        }, idleTimeoutMs);
      };

      const clearTimers = () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        if (totalTimer) {
          clearTimeout(totalTimer);
          totalTimer = null;
        }
      };

      if (totalTimeoutMs) {
        totalTimer = setTimeout(() => {
          fail(`Provider stream total timeout after ${totalTimeoutMs}ms`);
        }, totalTimeoutMs);
      }

      if (abortSignal?.aborted) {
        fail("Provider stream aborted by client");
        return;
      }
      abortSignal?.addEventListener("abort", abortFromClient, { once: true });

      const pump = async () => {
        resetIdleTimer();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (closed) return;
            resetIdleTimer();
            if (done) {
              closed = true;
              clearTimers();
              if (abortFromClient) abortSignal?.removeEventListener("abort", abortFromClient);
              controller.close();
              return;
            }
            controller.enqueue(value);
          }
        } catch (err) {
          if (closed) return;
          closed = true;
          clearTimers();
          if (abortFromClient) abortSignal?.removeEventListener("abort", abortFromClient);
          controller.error(err);
        }
      };

      pump().catch((err) => {
        if (closed) return;
        closed = true;
        clearTimers();
        if (abortFromClient) abortSignal?.removeEventListener("abort", abortFromClient);
        controller.error(err);
      });
    },
    cancel(reason) {
      closed = true;
      if (idleTimer) clearTimeout(idleTimer);
      if (totalTimer) clearTimeout(totalTimer);
      if (abortFromClient) abortSignal?.removeEventListener("abort", abortFromClient);
      return reader.cancel(reason);
    },
  });
}
