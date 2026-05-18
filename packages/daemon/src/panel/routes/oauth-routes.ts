import type { ServerResponse } from "node:http";
import type { Context, Hono } from "hono";
import {
  CLINE_REDIRECT_URI,
  createClineAuthorizationUrl,
  exchangeClineAuthorizationCode,
} from "../../proxy/providers/cline-auth.js";
import {
  exchangeForCopilotToken,
  fetchGithubLogin,
  pollDeviceFlow,
  startDeviceFlow,
} from "../../proxy/providers/copilot-auth.js";
import {
  fetchKiloCodeOrgId,
  pollKiloCodeDeviceFlow,
  startKiloCodeDeviceFlow,
} from "../../proxy/providers/kilocode-auth.js";
import {
  createAuthorizationUrl,
  createPkcePair,
  createState,
  exchangeAuthorizationCode,
  OPENAI_ACCOUNT_REDIRECT_URI,
} from "../../proxy/providers/openai-account-auth.js";
import type { OAuthFlow, PanelRuntime } from "../runtime.js";
import { oauthBadRequestPage, oauthErrorPage, oauthSuccessPage } from "./oauth-pages.js";

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
    const config = runtime.currentConfig();
    config.providers.cline.oauth = {};
    config.providers.cline.enabled = false;
    runtime.saveAndUpdateConfig(config);
    return c.json({ ok: true });
  });
}

async function startOpenAIAccountFlow(c: Context, runtime: PanelRuntime) {
  cleanupOAuthFlows(runtime);

  const existing = Array.from(runtime.oauthFlows.entries()).find(
    ([, flow]) => flow.status === "pending",
  );
  if (existing) return c.json({ error: "An OpenAI login flow is already pending" }, 409);

  const state = createState();
  const pkce = createPkcePair();
  const flow: OAuthFlow = { verifier: pkce.verifier, status: "pending" };
  runtime.oauthFlows.set(state, flow);

  try {
    const server = runtime.createCallbackServer(async (req, res) => {
      const requestUrl = new URL(req.url ?? "/", OPENAI_ACCOUNT_REDIRECT_URI);
      if (requestUrl.pathname !== "/auth/callback") {
        res.writeHead(404).end("Not found");
        return;
      }

      const returnedState = requestUrl.searchParams.get("state") ?? "";
      const code = requestUrl.searchParams.get("code") ?? "";
      const activeFlow = runtime.oauthFlows.get(returnedState);
      if (!activeFlow || returnedState !== state || !code) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(oauthBadRequestPage());
        return;
      }

      await completeOpenAIAccountFlow(runtime, activeFlow, code, res);
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(1455, "127.0.0.1", () => resolve());
    });

    flow.server = server;
    flow.timer = setTimeout(() => timeoutOpenAIFlow(runtime, state), 5 * 60 * 1000);
  } catch (err) {
    runtime.oauthFlows.delete(state);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  return c.json({ state, url: createAuthorizationUrl(pkce, state) });
}

async function completeOpenAIAccountFlow(
  runtime: PanelRuntime,
  activeFlow: OAuthFlow,
  code: string,
  res: ServerResponse,
): Promise<void> {
  try {
    const tokens = await exchangeAuthorizationCode(code, activeFlow.verifier);
    const config = runtime.currentConfig();
    config.providers.openai_account.oauth = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      accountId: tokens.accountId,
      planType: tokens.planType,
    };
    config.providers.openai_account.authType = "oauth";
    config.providers.openai_account.enabled = true;
    runtime.saveAndUpdateConfig(config);
    activeFlow.status = "success";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(oauthSuccessPage("OpenAI"));
  } catch (err) {
    activeFlow.status = "error";
    activeFlow.error = err instanceof Error ? err.message : String(err);
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(oauthErrorPage("OpenAI", activeFlow.error));
  } finally {
    activeFlow.server?.close();
  }
}

async function startCopilotFlow(c: Context, runtime: PanelRuntime) {
  cleanupCopilotFlows(runtime);

  try {
    const device = await startDeviceFlow();
    const flowId = createState();
    const flow = {
      deviceCode: device.device_code,
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      interval: Math.max(device.interval, 1),
      expiresAt: Date.now() + device.expires_in * 1000,
      status: "pending" as const,
    };
    runtime.copilotFlows.set(flowId, flow);
    scheduleCopilotPoll(runtime, flowId, flow.interval * 1000);

    return c.json({
      flowId,
      userCode: flow.userCode,
      verificationUri: flow.verificationUri,
      expiresAt: flow.expiresAt,
      interval: flow.interval,
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

function scheduleCopilotPoll(runtime: PanelRuntime, flowId: string, intervalMs: number): void {
  const flow = runtime.copilotFlows.get(flowId);
  if (!flow) return;
  flow.poller = setTimeout(() => pollCopilotFlow(runtime, flowId, intervalMs), intervalMs);
}

async function pollCopilotFlow(
  runtime: PanelRuntime,
  flowId: string,
  intervalMs: number,
): Promise<void> {
  const flow = runtime.copilotFlows.get(flowId);
  if (!flow || flow.status !== "pending") return;
  if (Date.now() > flow.expiresAt) {
    flow.status = "error";
    flow.error = "Device code expired — please try logging in again";
    return;
  }

  try {
    const result = await pollDeviceFlow(flow.deviceCode);
    if (result.status === "pending") return scheduleCopilotPoll(runtime, flowId, intervalMs);
    if (result.status === "slow_down")
      return scheduleCopilotPoll(runtime, flowId, result.interval * 1000);
    if (result.status === "expired") {
      flow.status = "error";
      flow.error = "Device code expired — please try logging in again";
      return;
    }
    if (result.status === "denied") {
      flow.status = "error";
      flow.error = "GitHub login was denied";
      return;
    }
    if (result.status === "error") {
      flow.status = "error";
      flow.error = result.error;
      return;
    }

    const githubToken = result.token.accessToken;
    const copilot = await exchangeForCopilotToken(githubToken);
    const login = await fetchGithubLogin(githubToken).catch(() => undefined);
    const config = runtime.currentConfig();
    config.providers.copilot.oauth = {
      accessToken: githubToken,
      accountId: login,
      copilotToken: copilot.token,
      copilotExpiresAt: copilot.expiresAt,
      copilotEndpoint: copilot.endpoint,
    };
    config.providers.copilot.authType = "oauth";
    config.providers.copilot.enabled = true;
    runtime.saveAndUpdateConfig(config);
    flow.status = "success";
  } catch (err) {
    flow.status = "error";
    flow.error = err instanceof Error ? err.message : String(err);
  }
}

function cleanupOAuthFlows(runtime: PanelRuntime): void {
  for (const [state, flow] of runtime.oauthFlows) {
    if (flow.status === "pending") continue;
    if (flow.timer) clearTimeout(flow.timer);
    flow.server?.close();
    runtime.oauthFlows.delete(state);
  }
}

function cleanupCopilotFlows(runtime: PanelRuntime): void {
  for (const [id, flow] of runtime.copilotFlows) {
    if (flow.status === "pending") continue;
    if (flow.poller) clearTimeout(flow.poller);
    runtime.copilotFlows.delete(id);
  }
}

async function startKiloCodeFlow(c: Context, runtime: PanelRuntime) {
  cleanupKiloCodeFlows(runtime);

  try {
    const device = await startKiloCodeDeviceFlow();
    const flowId = createState();
    const flow = {
      deviceCode: device.device_code,
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      interval: Math.max(device.interval, 1),
      expiresAt: Date.now() + device.expires_in * 1000,
      status: "pending" as const,
    };
    runtime.kilocodeFlows.set(flowId, flow);
    scheduleKiloCodePoll(runtime, flowId, flow.interval * 1000);

    return c.json({
      flowId,
      userCode: flow.userCode,
      verificationUri: flow.verificationUri,
      expiresAt: flow.expiresAt,
      interval: flow.interval,
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

function scheduleKiloCodePoll(runtime: PanelRuntime, flowId: string, intervalMs: number): void {
  const flow = runtime.kilocodeFlows.get(flowId);
  if (!flow) return;
  flow.poller = setTimeout(() => pollKiloCodeFlow(runtime, flowId, intervalMs), intervalMs);
}

async function pollKiloCodeFlow(
  runtime: PanelRuntime,
  flowId: string,
  intervalMs: number,
): Promise<void> {
  const flow = runtime.kilocodeFlows.get(flowId);
  if (!flow || flow.status !== "pending") return;
  if (Date.now() > flow.expiresAt) {
    flow.status = "error";
    flow.error = "Device code expired — please try logging in again";
    return;
  }

  try {
    const result = await pollKiloCodeDeviceFlow(flow.deviceCode);
    if (result.status === "pending") return scheduleKiloCodePoll(runtime, flowId, intervalMs);
    if (result.status === "expired") {
      flow.status = "error";
      flow.error = "Device code expired — please try logging in again";
      return;
    }
    if (result.status === "denied") {
      flow.status = "error";
      flow.error = "KiloCode login was denied";
      return;
    }
    if (result.status === "error") {
      flow.status = "error";
      flow.error = result.error;
      return;
    }

    const orgId = await fetchKiloCodeOrgId(result.token);
    const config = runtime.currentConfig();
    config.providers.kilocode.oauth = {
      accessToken: result.token,
      accountId: result.userEmail,
      orgId,
    };
    config.providers.kilocode.authType = "oauth";
    config.providers.kilocode.enabled = true;
    runtime.saveAndUpdateConfig(config);
    flow.status = "success";
  } catch (err) {
    flow.status = "error";
    flow.error = err instanceof Error ? err.message : String(err);
  }
}

function cleanupKiloCodeFlows(runtime: PanelRuntime): void {
  for (const [id, flow] of runtime.kilocodeFlows) {
    if (flow.status === "pending") continue;
    if (flow.poller) clearTimeout(flow.poller);
    runtime.kilocodeFlows.delete(id);
  }
}

async function startClineFlow(c: Context, runtime: PanelRuntime) {
  cleanupOAuthFlows(runtime);

  const existing = Array.from(runtime.oauthFlows.entries()).find(
    ([, flow]) => flow.status === "pending",
  );
  if (existing) return c.json({ error: "A browser login flow is already pending" }, 409);

  const state = createState();
  const flow: OAuthFlow = { verifier: "", status: "pending" };
  runtime.oauthFlows.set(state, flow);

  try {
    const server = runtime.createCallbackServer(async (req, res) => {
      const requestUrl = new URL(req.url ?? "/", CLINE_REDIRECT_URI);
      if (requestUrl.pathname !== "/auth/callback") {
        res.writeHead(404).end("Not found");
        return;
      }

      const returnedState = requestUrl.searchParams.get("state") ?? "";
      const code = requestUrl.searchParams.get("code") ?? "";
      const error = requestUrl.searchParams.get("error") ?? "";
      const activeFlow = runtime.oauthFlows.get(state);
      if (!activeFlow || returnedState !== state || !code) {
        if (activeFlow) {
          activeFlow.status = "error";
          activeFlow.error =
            error ||
            (returnedState !== state
              ? "Cline authorization callback state did not match"
              : "Cline authorization callback did not include a code");
          activeFlow.server?.close();
        }
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(oauthBadRequestPage());
        return;
      }

      await completeClineFlow(runtime, activeFlow, code, res);
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(1456, "127.0.0.1", () => resolve());
    });

    flow.server = server;
    flow.timer = setTimeout(() => timeoutBrowserOAuthFlow(runtime, state, "Cline"), 5 * 60 * 1000);
  } catch (err) {
    runtime.oauthFlows.delete(state);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  return c.json({ state, url: createClineAuthorizationUrl(state) });
}

async function completeClineFlow(
  runtime: PanelRuntime,
  activeFlow: OAuthFlow,
  code: string,
  res: ServerResponse,
): Promise<void> {
  try {
    const tokens = await exchangeClineAuthorizationCode(code);
    const config = runtime.currentConfig();
    config.providers.cline.oauth = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      accountId: tokens.accountId,
    };
    config.providers.cline.authType = "oauth";
    config.providers.cline.enabled = true;
    runtime.saveAndUpdateConfig(config);
    activeFlow.status = "success";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(oauthSuccessPage("Cline"));
  } catch (err) {
    activeFlow.status = "error";
    activeFlow.error = err instanceof Error ? err.message : String(err);
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(oauthErrorPage("Cline", activeFlow.error));
  } finally {
    activeFlow.server?.close();
  }
}

function timeoutOpenAIFlow(runtime: PanelRuntime, state: string): void {
  timeoutBrowserOAuthFlow(runtime, state, "OpenAI");
}

function timeoutBrowserOAuthFlow(
  runtime: PanelRuntime,
  state: string,
  providerLabel: string,
): void {
  const current = runtime.oauthFlows.get(state);
  if (current?.status === "pending") {
    current.status = "error";
    current.error = `${providerLabel} login timed out`;
  }
  current?.server?.close();
}
