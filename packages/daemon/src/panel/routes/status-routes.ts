import type { Hono } from "hono";
import type { ProviderId } from "../../config/schema.js";
import { PROVIDER_LABELS } from "../../config/schema.js";
import { addLogListener, getLogBuffer } from "../../observability/log.js";
import { getDaemonStatus } from "../../runtime/process.js";
import { getStats, getUptimeMs } from "../../runtime/stats.js";
import type { GatewayStatusResponse, StatsResponse } from "../contracts.js";
import type { PanelRuntime } from "../runtime.js";

export function registerStatusRoutes(app: Hono, runtime: PanelRuntime): void {
  app.get("/api/status", (c) => {
    const config = runtime.currentConfig();
    const status = getDaemonStatus();
    const response = {
      running: status.running,
      pid: status.pid,
      activeProvider: config.activeProvider,
      uptimeMs: getUptimeMs(),
      proxyPort: config.server.proxyPort,
      panelPort: config.server.panelPort,
      modelMode: config.modelMode ?? "single",
    } satisfies GatewayStatusResponse;
    return c.json(response);
  });

  app.post("/api/control/shutdown", (c) => {
    setTimeout(() => process.kill(process.pid, "SIGTERM"), 50);
    return c.json({ ok: true, signal: "SIGTERM" });
  });

  app.get("/api/stats", (c) => {
    const config = runtime.currentConfig();
    const runtimeStats = getStats();
    const providers = (
      Object.entries(config.providers) as [ProviderId, (typeof config.providers)[ProviderId]][]
    )
      .filter(([, pc]) => pc.enabled)
      .map(([id, pc]) => ({
        id,
        label: PROVIDER_LABELS[id] ?? id,
        baseUrl: pc.baseUrl,
        hasKey: !!pc.apiKey,
        ...(runtimeStats[id] ?? {
          requests: 0,
          errors: 0,
          avgLatencyMs: 0,
          totalLatencyMs: 0,
          lastActivityAt: null,
          lastError: null,
        }),
      }));

    const response = {
      uptimeMs: getUptimeMs(),
      activeProvider: config.activeProvider,
      modelMode: config.modelMode ?? "single",
      providers,
    } satisfies StatsResponse;
    return c.json(response);
  });

  app.get("/api/logs", (c) => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const line of getLogBuffer()) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ line })}\n\n`));
        }

        const remove = addLogListener((line) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ line })}\n\n`));
          } catch {
            remove();
          }
        });

        c.req.raw.signal.addEventListener("abort", () => {
          remove();
          try {
            controller.close();
          } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });
}
