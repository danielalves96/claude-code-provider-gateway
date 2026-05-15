import type { Context, Next } from "hono";
import { anthropicError } from "../errors.js";
import type { ProxyRuntime } from "../runtime.js";

export function requireAnthropicAuth(runtime: ProxyRuntime) {
  return async (c: Context, next: Next) => {
    const config = runtime.currentConfig();
    if (!config.server.authToken) return next();

    const auth = c.req.header("Authorization") ?? c.req.header("x-api-key") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (token !== config.server.authToken) {
      return c.json(anthropicError("authentication_error", "Invalid API key"), 401);
    }

    return next();
  };
}
