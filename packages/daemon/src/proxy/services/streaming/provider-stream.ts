import type { Config } from "../../../config/schema.js";
import { logger } from "../../../observability/log.js";
import type { RequestWarning } from "../../../runtime/sessions/types.js";
import type { StreamResult } from "../../providers/shared/base.js";
import { acquireProviderLimit } from "./provider-limiter.js";

export function logWarnings(
  providerId: string,
  providerModel: string,
  warnings: RequestWarning[] | undefined,
): void {
  for (const warning of warnings ?? []) {
    logger.warn("proxy", `⚠ ${providerId}/${providerModel} ${warning.code}: ${warning.message}`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function safeProviderStream<T extends { error?: { status: number; message: string } }>(
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call();
  } catch (err) {
    return {
      error: {
        status: 502,
        message: `Provider transport failed: ${formatTransportError(err)}`,
      },
    } as T;
  }
}

export async function limitedProviderStream(
  providerId: string,
  config: Config["providers"][string] | undefined,
  abortSignal: AbortSignal | undefined,
  call: () => Promise<StreamResult>,
): Promise<StreamResult> {
  const limit = acquireProviderLimit(providerId, config, abortSignal);
  if (!limit.ok) return { error: { status: limit.status, message: limit.message } };

  const result = await safeProviderStream(call);
  if (result.stream) {
    return { ...result, stream: releaseWhenStreamSettles(result.stream, limit.release) };
  }

  limit.release();
  return result;
}

function releaseWhenStreamSettles(
  stream: ReadableStream<string>,
  release: () => void,
): ReadableStream<string> {
  const reader = stream.getReader();
  let released = false;
  const releaseOnce = () => {
    if (released) return;
    released = true;
    release();
  };

  return new ReadableStream<string>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          releaseOnce();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        releaseOnce();
        controller.error(err);
      }
    },
    cancel(reason) {
      releaseOnce();
      return reader.cancel(reason);
    },
  });
}

function formatTransportError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char strip
  return message.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").slice(0, 1000);
}
