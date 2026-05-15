import type { Hono } from "hono";
import type { ProxyRuntime } from "../runtime.js";

export function registerStatusRoutes(app: Hono, runtime: ProxyRuntime): void {
  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/", (c) => {
    const config = runtime.currentConfig();
    return c.json({
      status: "ok",
      provider: config.activeProvider,
      proxy_port: config.server.proxyPort,
    });
  });
}
