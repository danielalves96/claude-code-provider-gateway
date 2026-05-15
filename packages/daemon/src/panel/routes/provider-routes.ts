import type { Hono } from "hono";
import type { ProviderConfig, ProviderId } from "../../config/schema.js";
import { PROVIDER_LABELS } from "../../config/schema.js";
import type { ProviderInfo, RoutingOption } from "../contracts.js";
import type { PanelRuntime } from "../runtime.js";

export function registerProviderRoutes(app: Hono, runtime: PanelRuntime): void {
  app.get("/api/providers", (c) => {
    const config = runtime.currentConfig();
    const result = Object.entries(config.providers).map(([id, pc]) => {
      const key = pc.apiKey ?? "";
      const keyPreview = key ? `${key.slice(0, Math.min(12, Math.max(4, key.length - 4)))}…` : null;
      const oauth = pc.oauth;
      return {
        id,
        label: PROVIDER_LABELS[id as ProviderId] ?? id,
        enabled: pc.enabled,
        hasKey: !!key,
        keyPreview,
        baseUrl: pc.baseUrl,
        models: pc.models ?? [],
        disabledModels: pc.disabledModels ?? [],
        authType: pc.authType,
        oauth: oauth?.accountId
          ? {
              loggedIn: true,
              accountId: oauth.accountId,
              planType: oauth.planType ?? null,
              expiresAt: oauth.expiresAt ?? null,
            }
          : { loggedIn: false },
      };
    }) satisfies ProviderInfo[];
    return c.json(result);
  });

  app.post("/api/providers/:id/test", async (c) => {
    const id = c.req.param("id") as ProviderId;
    const provider = runtime.registry.get(id);
    if (!provider) return c.json({ ok: false, error: "Provider not enabled" }, 400);
    return c.json(await provider.testConnection());
  });

  app.get("/api/models/:providerId", async (c) => {
    const id = c.req.param("providerId") as ProviderId;
    const provider = runtime.registry.get(id);
    if (!provider) return c.json([], 200);
    return c.json(await provider.listModels().catch(() => []));
  });

  app.get("/api/routing/options", async (c) => {
    const config = runtime.currentConfig();
    const enabledProviders = (Object.entries(config.providers) as [ProviderId, ProviderConfig][])
      .filter(([, pc]) => pc.enabled)
      .map(([id]) => id);

    const options = (await Promise.all(
      enabledProviders.map(async (id) => ({
        id,
        label: PROVIDER_LABELS[id] ?? id,
        models: await listSelectableModels(runtime, id),
      })),
    )) satisfies RoutingOption[];

    return c.json(options);
  });
}

async function listSelectableModels(
  runtime: PanelRuntime,
  id: ProviderId,
): Promise<Array<{ id: string; display_name: string }>> {
  const config = runtime.currentConfig();
  const provider = runtime.registry.get(id);
  let models: Array<{ id: string; display_name: string }> = [];
  if (provider) {
    try {
      const list = await provider.listEnabledModels();
      models = list.map((model) => ({ id: model.id, display_name: model.display_name }));
    } catch {
      models = [];
    }
  }

  const seen = new Set(models.map((model) => model.id));
  for (const extra of config.providers[id].models ?? []) {
    if (seen.has(extra)) continue;
    models.push({ id: extra, display_name: extra });
    seen.add(extra);
  }
  return models;
}
