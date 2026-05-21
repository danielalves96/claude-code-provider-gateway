import type { Hono } from "hono";
import type { PanelRuntime } from "../runtime.js";
import { startClineFlow } from "./oauth-cline.js";
import { startCopilotFlow } from "./oauth-copilot.js";
import { startKiloCodeFlow } from "./oauth-kilocode.js";
import { startOpenAIAccountFlow } from "./oauth-openai-account.js";

export function registerOAuthRoutes(app: Hono, runtime: PanelRuntime): void {
  app.post("/api/providers/openai_account/oauth/start", async (c) =>
    startOpenAIAccountFlow(c, runtime),
  );

  app.get("/api/providers/openai_account/oauth/status/:state", (c) => {
    const flow = runtime.oauthFlows.get(c.req.param("state"));
    if (!flow) return c.json({ status: "unknown" });
    return c.json({ status: flow.status, error: flow.error });
  });

  app.post("/api/providers/openai_account/oauth/logout", (c) => {
    const config = runtime.currentConfig();
    config.providers.openai_account.oauth = {};
    config.providers.openai_account.enabled = false;
    runtime.saveAndUpdateConfig(config);
    return c.json({ ok: true });
  });

  app.post("/api/providers/copilot/oauth/start", async (c) => startCopilotFlow(c, runtime));

  app.get("/api/providers/copilot/oauth/status/:flowId", (c) => {
    const flow = runtime.copilotFlows.get(c.req.param("flowId"));
    if (!flow) return c.json({ status: "unknown" });
    return c.json({
      status: flow.status,
      error: flow.error,
      userCode: flow.userCode,
      verificationUri: flow.verificationUri,
      expiresAt: flow.expiresAt,
    });
  });

  app.post("/api/providers/copilot/oauth/logout", (c) => {
    const config = runtime.currentConfig();
    config.providers.copilot.oauth = {};
    config.providers.copilot.enabled = false;
    runtime.saveAndUpdateConfig(config);
    return c.json({ ok: true });
  });

  app.post("/api/providers/kilocode/oauth/start", async (c) => startKiloCodeFlow(c, runtime));

  app.get("/api/providers/kilocode/oauth/status/:flowId", (c) => {
    const flow = runtime.kilocodeFlows.get(c.req.param("flowId"));
    if (!flow) return c.json({ status: "unknown" });
    return c.json({
      status: flow.status,
      error: flow.error,
      userCode: flow.userCode,
      verificationUri: flow.verificationUri,
      expiresAt: flow.expiresAt,
    });
  });

  app.post("/api/providers/kilocode/oauth/logout", (c) => {
    for (const [id, flow] of runtime.kilocodeFlows) {
      if (flow.poller) clearTimeout(flow.poller);
      runtime.kilocodeFlows.delete(id);
    }
    const config = runtime.currentConfig();
    config.providers.kilocode.oauth = {};
    config.providers.kilocode.enabled = false;
    runtime.saveAndUpdateConfig(config);
    return c.json({ ok: true });
  });

  app.post("/api/providers/cline/oauth/start", async (c) => startClineFlow(c, runtime));

  app.get("/api/providers/cline/oauth/status/:state", (c) => {
    const flow = runtime.oauthFlows.get(c.req.param("state"));
    if (!flow) return c.json({ status: "unknown" });
    return c.json({ status: flow.status, error: flow.error });
  });

  app.post("/api/providers/cline/oauth/logout", (c) => {
    for (const [state, flow] of runtime.oauthFlows) {
      if (flow.provider !== "cline") continue;
      if (flow.timer) clearTimeout(flow.timer);
      flow.server?.close();
      runtime.oauthFlows.delete(state);
    }
    const config = runtime.currentConfig();
    config.providers.cline.oauth = {};
    config.providers.cline.enabled = false;
    runtime.saveAndUpdateConfig(config);
    return c.json({ ok: true });
  });
}
