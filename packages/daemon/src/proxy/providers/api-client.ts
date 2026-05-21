import type { ModelInfo } from "../../core/anthropic/types.js";

interface ProviderFetchOptions {
  url: string;
  headers: Record<string, string>;
  timeoutMs?: number;
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
  const timeout = createFetchTimeout(options.timeoutMs);
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
    }),
  };
}

export async function fetchProviderJson<T>(options: ProviderFetchOptions): Promise<T> {
  const timeout = createFetchTimeout(options.timeoutMs);
  let response: Response;
  try {
    response = await fetch(options.url, { headers: options.headers, signal: timeout.signal });
  } catch (err) {
    if (timeout.didAbort()) {
      const error = timeoutError();
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

function createFetchTimeout(timeoutMs: number | undefined): {
  signal?: AbortSignal;
  clear: () => void;
  didAbort: () => boolean;
} {
  if (!timeoutMs) return { clear: () => {}, didAbort: () => false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
    didAbort: () => controller.signal.aborted,
  };
}

function timeoutError(): { status: number; message: string } {
  return { status: 504, message: "Provider request timed out" };
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
  options: { idleTimeoutMs?: number; totalTimeoutMs?: number },
): ReadableStream<Uint8Array> {
  const { idleTimeoutMs, totalTimeoutMs } = options;
  if (!idleTimeoutMs && !totalTimeoutMs) return body;

  const reader = body.getReader();
  let idleTimer: NodeJS.Timeout | null = null;
  let totalTimer: NodeJS.Timeout | null = null;
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const fail = (message: string) => {
        if (closed) return;
        closed = true;
        clearTimers();
        reader.cancel().catch(() => {});
        controller.error(new Error(message));
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
              controller.close();
              return;
            }
            controller.enqueue(value);
          }
        } catch (err) {
          if (closed) return;
          closed = true;
          clearTimers();
          controller.error(err);
        }
      };

      pump().catch((err) => {
        if (closed) return;
        closed = true;
        clearTimers();
        controller.error(err);
      });
    },
    cancel(reason) {
      closed = true;
      if (idleTimer) clearTimeout(idleTimer);
      if (totalTimer) clearTimeout(totalTimer);
      return reader.cancel(reason);
    },
  });
}
