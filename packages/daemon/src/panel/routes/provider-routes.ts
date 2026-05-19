import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { Hono } from "hono";
import { getSecretStore } from "../../config/index.js";
import { getProviderLogoDir } from "../../config/paths.js";
import type { ProviderConfig, ProviderId } from "../../config/schema.js";
import { PROVIDER_LABELS } from "../../config/schema.js";
import { SECRET_KEYS } from "../../config/secrets/store.js";
import type { ModelInfo } from "../../core/anthropic/types.js";
import { AnthropicMessagesTransport } from "../../proxy/providers/transport-anthropic.js";
import { OpenAIChatTransport } from "../../proxy/providers/transport-openai.js";
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
        label: pc.custom?.label ?? PROVIDER_LABELS[id as keyof typeof PROVIDER_LABELS] ?? id,
        enabled: pc.enabled,
        hasKey: !!key,
        keyPreview,
        baseUrl: pc.baseUrl,
        models: pc.models ?? [],
        disabledModels: pc.disabledModels ?? [],
        authType: pc.authType,
        custom: !!pc.custom,
        customCompatibility: pc.custom?.compatibility,
        logoUrl: pc.custom?.logoFile ? `/api/provider-logos/${pc.custom.logoFile}` : undefined,
        oauth: oauth?.accessToken
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

  app.post("/api/custom-providers/test", async (c) => {
    const body = await c.req
      .json<{ slug?: string; name?: string; baseUrl?: string; apiKey?: string }>()
      .catch(() => ({}));
    const parsed = parseCustomProviderFields(body);
    if (!parsed.ok) return c.json({ ok: false, latencyMs: 0, error: parsed.error }, 400);
    const provider = createTempCustomProvider(parsed.config);
    const result = await provider.testConnection();
    const models = result.ok ? await provider.listModels().catch(() => [] as ModelInfo[]) : [];
    return c.json({ ...result, models });
  });

  app.post("/api/custom-providers", async (c) => {
    const form = await c.req.parseBody();
    const parsed = parseCustomProviderFields(form);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const config = structuredClone(runtime.currentConfig());
    if (RESERVED_CUSTOM_SLUGS.has(parsed.slug)) {
      return c.json({ error: `Provider slug "${parsed.slug}" is reserved` }, 409);
    }
    const existingLower = Object.keys(config.providers).map((k) => k.toLowerCase());
    if (existingLower.includes(parsed.slug)) {
      return c.json({ error: `Provider slug "${parsed.slug}" already exists` }, 409);
    }

    let logoFile: string | undefined;
    try {
      logoFile = await saveProviderLogo(parsed.slug, form.logo);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Invalid logo file" }, 400);
    }
    config.providers[parsed.slug] = {
      ...parsed.config,
      enabled: true,
      custom: {
        label: parsed.label,
        slug: parsed.slug,
        logoFile,
        compatibility: parsed.compatibility,
      },
    };
    if (!config.activeProvider || !config.providers[config.activeProvider]?.enabled) {
      config.activeProvider = parsed.slug;
    }
    runtime.saveAndUpdateConfig(config);
    return c.json({ ok: true, id: parsed.slug });
  });

  app.delete("/api/custom-providers/:id", (c) => {
    const id = c.req.param("id");
    const config = structuredClone(runtime.currentConfig());
    const provider = config.providers[id];
    if (!provider?.custom) return c.json({ error: "Custom provider not found" }, 404);

    if (provider.custom.logoFile) {
      rmSync(join(getProviderLogoDir(), provider.custom.logoFile), { force: true });
    }
    getSecretStore().delete(SECRET_KEYS.providerApiKey(id));
    delete config.providers[id];
    for (const rule of Object.values(config.routing)) {
      if (rule.providerId === id) {
        rule.enabled = false;
        rule.providerId = "";
        rule.model = "";
      }
    }
    config.modelFallbacks = config.modelFallbacks.map((fallback) => ({
      ...fallback,
      models: fallback.models.filter((model) => model.providerId !== id),
    }));
    config.panelSettings.favoriteProviders = config.panelSettings.favoriteProviders.filter(
      (providerId) => providerId !== id,
    );
    if (config.activeProvider === id) {
      config.activeProvider =
        Object.entries(config.providers).find(([, pc]) => pc.enabled)?.[0] ?? "nvidia_nim";
    }
    runtime.saveAndUpdateConfig(config);
    return c.json({ ok: true });
  });

  app.get("/api/provider-logos/:file", (c) => {
    const file = c.req.param("file");
    if (!/^[a-zA-Z0-9_-]+\.(png|webp)$/.test(file)) return c.body(null, 404);
    try {
      const bytes = readFileSync(join(getProviderLogoDir(), file));
      const type = file.endsWith(".png") ? "image/png" : "image/webp";
      return c.body(bytes, 200, { "Content-Type": type, "Cache-Control": "no-store" });
    } catch {
      return c.body(null, 404);
    }
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
        label:
          config.providers[id].custom?.label ??
          PROVIDER_LABELS[id as keyof typeof PROVIDER_LABELS] ??
          id,
        models: await listSelectableModels(runtime, id),
      })),
    )) satisfies RoutingOption[];

    return c.json(options);
  });
}

const RESERVED_CUSTOM_SLUGS = new Set(["anthropic", "chain", "fallback"]);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

type CustomFields = Record<string, unknown>;

function parseCustomProviderFields(fields: CustomFields):
  | {
      ok: true;
      slug: string;
      label: string;
      compatibility: "openai" | "anthropic";
      config: ProviderConfig;
    }
  | { ok: false; error: string } {
  const label = stringField(fields.name)?.trim();
  const slug = normalizeSlug(stringField(fields.slug))?.toLowerCase() ?? null;
  const baseUrl = stringField(fields.baseUrl)?.trim().replace(/\/+$/, "");
  const apiKey = stringField(fields.apiKey)?.trim();
  const compatibility = parseCompatibility(fields.compatibility);
  if (!label) return { ok: false, error: "Provider name is required" };
  if (!slug)
    return { ok: false, error: "Slug must start with a letter and use letters, numbers, _ or -" };
  if (!baseUrl || (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://"))) {
    return { ok: false, error: "Base URL must start with http:// or https://" };
  }
  if (!apiKey) return { ok: false, error: "API key is required" };
  return {
    ok: true,
    slug,
    label,
    compatibility,
    config: {
      enabled: true,
      apiKey,
      authType: "api_key",
      models: [],
      disabledModels: [],
      baseUrl,
      rateLimit: 40,
      rateWindow: 60,
      maxConcurrency: 5,
      custom: { label, slug, compatibility },
    },
  };
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().replace(/^--/, "");
  return /^[a-zA-Z][a-zA-Z0-9_-]{1,62}$/.test(slug) ? slug : null;
}

function parseCompatibility(value: unknown): "openai" | "anthropic" {
  return value === "anthropic" ? "anthropic" : "openai";
}

async function saveProviderLogo(slug: string, value: unknown): Promise<string | undefined> {
  if (!(value instanceof File) || value.size === 0) return undefined;
  if (value.size > MAX_LOGO_BYTES) throw new Error("Logo file must not exceed 5 MB");
  if (value.type !== "image/png" && value.type !== "image/webp") {
    throw new Error("Logo must be a PNG or WebP image");
  }
  const ext = value.type === "image/png" ? ".png" : extname(value.name).toLowerCase() || ".webp";
  const file = `${slug}${ext === ".png" ? ".png" : ".webp"}`;
  mkdirSync(getProviderLogoDir(), { recursive: true });
  writeFileSync(join(getProviderLogoDir(), file), Buffer.from(await value.arrayBuffer()));
  return file;
}

function createTempCustomProvider(config: ProviderConfig) {
  return config.custom?.compatibility === "anthropic"
    ? new TempCustomAnthropicProvider(config)
    : new TempCustomOpenAIProvider(config);
}

class TempCustomOpenAIProvider extends OpenAIChatTransport {
  get id() {
    return this.config.custom?.slug ?? "custom";
  }

  get label() {
    return this.config.custom?.label ?? "Custom Provider";
  }
}

class TempCustomAnthropicProvider extends AnthropicMessagesTransport {
  get id() {
    return this.config.custom?.slug ?? "custom";
  }

  get label() {
    return this.config.custom?.label ?? "Custom Provider";
  }
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
