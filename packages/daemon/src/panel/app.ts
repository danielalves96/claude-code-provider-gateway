import { Hono } from "hono";
import type { Config } from "../config/schema.js";
import { requirePanelAccess } from "./middleware/auth.js";
import { registerConfigRoutes } from "./routes/config-routes.js";
import { registerOAuthRoutes } from "./routes/oauth-routes.js";
import { registerProviderRoutes } from "./routes/provider-routes.js";
import { registerSessionRoutes } from "./routes/session-routes.js";
import { registerShellRoutes } from "./routes/shell-routes.js";
import { registerStaticRoutes } from "./routes/static-routes.js";
import { registerStatusRoutes } from "./routes/status-routes.js";
import { PanelRuntime } from "./runtime.js";

export type PanelAppOptions = {
  saveConfig?: (config: Config) => void;
};

export function createPanelApp(initialConfig: Config, options: PanelAppOptions = {}) {
  const app = new Hono();
  const runtime = new PanelRuntime(initialConfig, options.saveConfig);

  app.use("/api/*", requirePanelAccess(runtime));

  registerStatusRoutes(app, runtime);
  registerSessionRoutes(app);
  registerShellRoutes(app, runtime);
  registerConfigRoutes(app, runtime);
  registerProviderRoutes(app, runtime);
  registerOAuthRoutes(app, runtime);
  registerStaticRoutes(app);

  return app;
}
