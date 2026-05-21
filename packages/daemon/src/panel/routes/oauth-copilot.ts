import type { Context } from "hono";
import {
  exchangeForCopilotToken,
  fetchGithubLogin,
  pollDeviceFlow,
  startDeviceFlow,
} from "../../proxy/providers/copilot-auth.js";
import { createState } from "../../proxy/providers/openai-account-auth.js";
import type { PanelRuntime } from "../runtime.js";

export async function startCopilotFlow(c: Context, runtime: PanelRuntime) {
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

function cleanupCopilotFlows(runtime: PanelRuntime): void {
  for (const [id, flow] of runtime.copilotFlows) {
    if (flow.status === "pending") continue;
    if (flow.poller) clearTimeout(flow.poller);
    runtime.copilotFlows.delete(id);
  }
}
