import type { ModelInfo } from "../../core/anthropic/types.js";

interface ProviderFetchOptions {
  url: string;
  headers: Record<string, string>;
  timeoutMs?: number;
}

interface ProviderStreamOptions extends ProviderFetchOptions {
  body: unknown;
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
    throw err;
  } finally {
    timeout.clear();
  }

  if (!response.ok) return { error: await readProviderError(response) };
  if (!response.body)
    return { error: { status: 500, message: "Provider returned an empty response body" } };

  return { body: response.body };
}

export async function fetchProviderJson<T>(options: ProviderFetchOptions): Promise<T> {
  const timeout = createFetchTimeout(options.timeoutMs);
  let response: Response;
  try {
    response = await fetch(options.url, { headers: options.headers, signal: timeout.signal });
  } catch (err) {
    if (timeout.didAbort()) {
      const error = timeoutError();
      throw new Error(`HTTP ${error.status} em ${options.url}: ${error.message}`);
    }
    throw err;
  } finally {
    timeout.clear();
  }
  if (!response.ok) {
    const error = await readProviderError(response);
    throw new Error(`HTTP ${error.status} em ${options.url}: ${error.message.slice(0, 300)}`);
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
  return { status: response.status, message };
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
