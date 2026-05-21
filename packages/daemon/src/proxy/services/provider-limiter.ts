import type { ProviderConfig } from "../../config/schema.js";

export type ProviderLimitResult =
  | { ok: true; release: () => void }
  | { ok: false; status: 429 | 499; message: string };

interface ProviderLimitState {
  active: number;
  starts: number[];
}

const states = new Map<string, ProviderLimitState>();

export function acquireProviderLimit(
  providerId: string,
  config: ProviderConfig | undefined,
  signal?: AbortSignal,
): ProviderLimitResult {
  if (signal?.aborted) {
    return { ok: false, status: 499, message: "Request aborted by client" };
  }

  const state = states.get(providerId) ?? { active: 0, starts: [] };
  states.set(providerId, state);

  const maxConcurrency = positiveInteger(config?.maxConcurrency);
  if (maxConcurrency && state.active >= maxConcurrency) {
    return {
      ok: false,
      status: 429,
      message: `Provider "${providerId}" concurrency limit reached (${maxConcurrency}).`,
    };
  }

  const rateLimit = positiveInteger(config?.rateLimit);
  const rateWindow = positiveInteger(config?.rateWindow);
  if (rateLimit && rateWindow) {
    const now = Date.now();
    const windowStart = now - rateWindow * 1000;
    state.starts = state.starts.filter((startedAt) => startedAt > windowStart);
    if (state.starts.length >= rateLimit) {
      return {
        ok: false,
        status: 429,
        message: `Provider "${providerId}" rate limit reached (${rateLimit}/${rateWindow}s).`,
      };
    }
    state.starts.push(now);
  }

  state.active += 1;
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      state.active = Math.max(0, state.active - 1);
    },
  };
}

export function resetProviderLimitsForTest(): void {
  states.clear();
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}
