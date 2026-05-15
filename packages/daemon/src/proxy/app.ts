import { Hono } from "hono";
import type { Config } from "../config/schema.js";
import { registerAnthropicRoutes } from "./routes/anthropic-routes.js";
import { registerStatusRoutes } from "./routes/status-routes.js";
import type { ConfigLoader } from "./runtime.js";
import { ProxyRuntime } from "./runtime.js";

interface ProxyAppOptions {
  loadConfig?: ConfigLoader;
}

export function createProxyApp(initialConfig: Config, options: ProxyAppOptions = {}) {
  const app = new Hono();
  const runtime = new ProxyRuntime(initialConfig, options.loadConfig);

  app.use("*", async (c, next) => {
    runtime.reloadConfig();
    await next();
  });

  registerStatusRoutes(app, runtime);
  registerAnthropicRoutes(app, runtime);

  return app;
}
