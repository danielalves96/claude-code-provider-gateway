import type { ServerResponse } from "node:http";
import type { Context } from "hono";
import {
  createAuthorizationUrl,
  createPkcePair,
  createState,
  exchangeAuthorizationCode,
  OPENAI_ACCOUNT_REDIRECT_URI,
} from "../../proxy/providers/openai-account-auth.js";
import type { OAuthFlow, PanelRuntime } from "../runtime.js";
import { oauthBadRequestPage, oauthErrorPage, oauthSuccessPage } from "./oauth-pages.js";
import { cleanupOAuthFlows, listenOnLocalhost, timeoutBrowserOAuthFlow } from "./oauth-shared.js";

export async function startOpenAIAccountFlow(c: Context, runtime: PanelRuntime) {
  cleanupOAuthFlows(runtime);

  const existing = Array.from(runtime.oauthFlows.entries()).find(
    ([, flow]) => flow.status === "pending",
  );
  if (existing) return c.json({ error: "An OpenAI login flow is already pending" }, 409);

  const state = createState();
  const pkce = createPkcePair();
  const flow: OAuthFlow = {
    provider: "openai_account",
    verifier: pkce.verifier,
    status: "pending",
  };
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

    await listenOnLocalhost(server, 1455, "OpenAI");

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

function timeoutOpenAIFlow(runtime: PanelRuntime, state: string): void {
  timeoutBrowserOAuthFlow(runtime, state, "OpenAI");
}
