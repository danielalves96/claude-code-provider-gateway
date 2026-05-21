import type { ServerResponse } from "node:http";
import type { Context } from "hono";
import {
  CLINE_REDIRECT_URI,
  createClineAuthorizationUrl,
  exchangeClineAuthorizationCode,
} from "../../proxy/providers/cline-auth.js";
import { createState } from "../../proxy/providers/openai-account-auth.js";
import type { OAuthFlow, PanelRuntime } from "../runtime.js";
import { oauthBadRequestPage, oauthErrorPage, oauthSuccessPage } from "./oauth-pages.js";
import { cleanupOAuthFlows, listenOnLocalhost, timeoutBrowserOAuthFlow } from "./oauth-shared.js";

export async function startClineFlow(c: Context, runtime: PanelRuntime) {
  cleanupOAuthFlows(runtime);

  const existing = Array.from(runtime.oauthFlows.entries()).find(
    ([, flow]) => flow.status === "pending",
  );
  if (existing) return c.json({ error: "A browser login flow is already pending" }, 409);

  const state = createState();
  const flow: OAuthFlow = { provider: "cline", verifier: "", status: "pending" };
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
      if (!activeFlow || returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(oauthBadRequestPage());
        return;
      }
      if (!code) {
        activeFlow.status = "error";
        activeFlow.error = error || "Cline authorization callback did not include a code";
        activeFlow.server?.close();
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(oauthBadRequestPage());
        return;
      }

      await completeClineFlow(runtime, activeFlow, code, res);
    });

    await listenOnLocalhost(server, 1456, "Cline");

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
