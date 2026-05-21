import type { Context } from "hono";
import {
  fetchKiloCodeOrgId,
  pollKiloCodeDeviceFlow,
  startKiloCodeDeviceFlow,
} from "../../../proxy/providers/kilocode/auth.js";
import { createState } from "../../../proxy/providers/openai-account/auth.js";
import type { PanelRuntime } from "../../runtime.js";

export async function startKiloCodeFlow(c: Context, runtime: PanelRuntime) {
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
