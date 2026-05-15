import type { Context, Next } from "hono";
import type { PanelRuntime } from "../runtime.js";

const PANEL_AUTH_HEADERS = "Content-Type, Authorization, x-api-key";
const PANEL_AUTH_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const TAURI_PANEL_ORIGINS = new Set([
  "tauri://localhost",
  "https://tauri.localhost",
  "http://tauri.localhost",
]);
const DEV_PANEL_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);

export function requirePanelAccess(runtime: PanelRuntime) {
  return async (c: Context, next: Next) => {
    const config = runtime.currentConfig();
    const origin = c.req.header("Origin") ?? "";
    const token = readBearerToken(c.req.header("Authorization") ?? c.req.header("x-api-key") ?? "");
    const hasValidToken = !!config.server.authToken && token === config.server.authToken;
    const isAllowedOrigin = isAllowedPanelOrigin(origin);
    const isCrossSiteBrowserRequest = c.req.header("Sec-Fetch-Site") === "cross-site";

    if (origin && !isAllowedOrigin && !hasValidToken) {
      return c.json({ error: "Forbidden origin" }, 403);
    }
    if (!origin && isCrossSiteBrowserRequest && !hasValidToken) {
      return c.json({ error: "Forbidden origin" }, 403);
    }
    if (!origin && requiresLocalToken(c.req.path, c.req.method) && !hasValidToken) {
      return c.json({ error: "Authentication required" }, 401);
    }

    if (origin && isAllowedOrigin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Headers", PANEL_AUTH_HEADERS);
      c.header("Access-Control-Allow-Methods", PANEL_AUTH_METHODS);
      c.header("Vary", "Origin");
    }

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    await next();
  };
}

function isAllowedPanelOrigin(origin: string): boolean {
  if (!origin) return false;
  if (TAURI_PANEL_ORIGINS.has(origin)) return true;
  if (process.env["NODE_ENV"] !== "production" && DEV_PANEL_ORIGINS.has(origin)) return true;
  return false;
}

function readBearerToken(auth: string): string {
  return auth.replace(/^Bearer\s+/i, "");
}

function requiresLocalToken(path: string, method: string): boolean {
  if (method === "PUT" && path === "/api/config") return true;
  if (method === "DELETE" && path === "/api/sessions") return true;
  if (method === "POST" && path === "/api/control/shutdown") return true;
  if (method === "POST" && path === "/api/shell-setup/install") return true;
  if (method === "GET" && (path === "/api/launch-commands" || path === "/api/launch-command"))
    return true;
  return (
    method === "POST" &&
    /^\/api\/providers\/(?:openai_account|copilot)\/oauth\/(?:start|logout)$/.test(path)
  );
}
