import type { Context, Next } from "hono";
import { resolveSessionIdFromAuthToken } from "../../runtime/sessions.js";
import { anthropicError } from "../errors.js";
import type { ProxyRuntime } from "../runtime.js";

export const PROXY_SESSION_ID_KEY = "ccpgSessionId";

export function getProxySessionId(c: Context): string | null {
  return (c.get(PROXY_SESSION_ID_KEY) as string | undefined) ?? null;
}

export function requireAnthropicAuth(runtime: ProxyRuntime) {
  return async (c: Context, next: Next) => {
    const config = runtime.currentConfig();
    if (!config.server.authToken) return next();

    const auth = c.req.header("Authorization") ?? c.req.header("x-api-key") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    const sessionId = resolveSessionIdFromAuthToken(token);
    if (sessionId) c.set(PROXY_SESSION_ID_KEY, sessionId);

    if (token !== config.server.authToken && !sessionId) {
      return c.json(anthropicError("authentication_error", "Invalid API key"), 401);
    }

    return next();
  };
}
