import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultConfig } from "./index.js";
import { normalizeConfig } from "./validation.js";

test("normalizeConfig preserves valid config values", () => {
  const defaults = buildDefaultConfig();
  const config = {
    ...defaults,
    server: { ...defaults.server, proxyPort: 5000 },
    activeProvider: "ollama" as const,
    modelMode: "all" as const,
    providers: {
      ...defaults.providers,
      ollama: {
        ...defaults.providers.ollama,
        enabled: true,
        requestTimeoutMs: 1200,
      },
    },
  };

  const normalized = normalizeConfig(config, defaults);

  assert.equal(normalized.server.proxyPort, 5000);
  assert.equal(normalized.activeProvider, "ollama");
  assert.equal(normalized.modelMode, "all");
  assert.equal(normalized.providers.ollama.requestTimeoutMs, 1200);
});

test("normalizeConfig uses proxy defaults when proxy field is absent (legacy config)", () => {
  const defaults = buildDefaultConfig();
  const legacyConfig = { ...defaults } as Record<string, unknown>;
  delete legacyConfig.proxy;
  delete legacyConfig.tokenSavers;

  const normalized = normalizeConfig(legacyConfig as unknown as typeof defaults, defaults);

  assert.equal(normalized.proxy.enabled, false);
  assert.equal(normalized.proxy.url, "");
  assert.equal(normalized.tokenSavers.rtkEnabled, false);
  assert.equal(normalized.tokenSavers.cavemanEnabled, false);
  assert.equal(normalized.tokenSavers.cavemanLevel, "lite");
});

test("normalizeConfig preserves proxy config when present", () => {
  const defaults = buildDefaultConfig();
  const config = { ...defaults, proxy: { enabled: true, url: "http://127.0.0.1:7890" } };

  const normalized = normalizeConfig(config, defaults);

  assert.equal(normalized.proxy.enabled, true);
  assert.equal(normalized.proxy.url, "http://127.0.0.1:7890");
});

test("normalizeConfig falls back to defaults for invalid proxy values", () => {
  const defaults = buildDefaultConfig();
  const config = {
    ...defaults,
    proxy: { enabled: "yes" as unknown as boolean, url: 123 as unknown as string },
  };

  const normalized = normalizeConfig(config, defaults);

  assert.equal(normalized.proxy.enabled, false);
  assert.equal(normalized.proxy.url, "");
});

test("normalizeConfig falls back for invalid runtime values", () => {
  const defaults = buildDefaultConfig();
  const config = {
    ...defaults,
    server: { ...defaults.server, proxyPort: "bad" as unknown as number },
    activeProvider: "missing" as typeof defaults.activeProvider,
    modelMode: "many" as typeof defaults.modelMode,
    providers: {
      ...defaults.providers,
      nvidia_nim: {
        ...defaults.providers.nvidia_nim,
        enabled: "yes" as unknown as boolean,
        requestTimeoutMs: -1,
      },
    },
  };

  const normalized = normalizeConfig(config, defaults);

  assert.equal(normalized.server.proxyPort, defaults.server.proxyPort);
  assert.equal(normalized.activeProvider, defaults.activeProvider);
  assert.equal(normalized.modelMode, defaults.modelMode);
  assert.equal(normalized.providers.nvidia_nim.enabled, defaults.providers.nvidia_nim.enabled);
  assert.equal(normalized.providers.nvidia_nim.requestTimeoutMs, undefined);
});

test("normalizeConfig preserves valid token saver settings", () => {
  const defaults = buildDefaultConfig();
  const config = {
    ...defaults,
    tokenSavers: {
      rtkEnabled: true,
      cavemanEnabled: true,
      cavemanLevel: "ultra" as const,
    },
  };

  const normalized = normalizeConfig(config, defaults);

  assert.equal(normalized.tokenSavers.rtkEnabled, true);
  assert.equal(normalized.tokenSavers.cavemanEnabled, true);
  assert.equal(normalized.tokenSavers.cavemanLevel, "ultra");
});

test("normalizeConfig preserves OAuth provider metadata", () => {
  const defaults = buildDefaultConfig();
  const config = {
    ...defaults,
    providers: {
      ...defaults.providers,
      copilot: {
        ...defaults.providers.copilot,
        oauth: {
          accessToken: "github-token",
          copilotToken: "copilot-token",
          copilotExpiresAt: Date.now() + 60_000,
          copilotEndpoint: "https://api.individual.githubcopilot.com",
        },
      },
      kilocode: {
        ...defaults.providers.kilocode,
        oauth: {
          accessToken: "kilo-token",
          orgId: "org_123",
        },
      },
    },
  };

  const normalized = normalizeConfig(config, defaults);

  assert.equal(normalized.providers.copilot.oauth?.copilotToken, "copilot-token");
  assert.equal(
    normalized.providers.copilot.oauth?.copilotEndpoint,
    "https://api.individual.githubcopilot.com",
  );
  assert.equal(normalized.providers.kilocode.oauth?.orgId, "org_123");
});
