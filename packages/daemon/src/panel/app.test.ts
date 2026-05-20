import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultConfig } from "../config/index.js";
import type { Config } from "../config/schema.js";
import { createPanelApp } from "./app.js";

function testPanelApp(config: Config) {
  return createPanelApp(config, { saveConfig: () => {} });
}

test("panel API rejects browser requests from untrusted origins", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/launch-commands", {
    headers: {
      Origin: "https://example.invalid",
      "Sec-Fetch-Site": "cross-site",
    },
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden origin" });
});

test("panel API allows trusted Tauri origins in production", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const config = buildDefaultConfig();
    config.server.authToken = "secret";
    const app = testPanelApp(config);

    const response = await app.request("/api/status", {
      headers: { Origin: "https://tauri.localhost" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://tauri.localhost");
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("panel API allows vite dev origin only outside production", async () => {
  const previous = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  try {
    const config = buildDefaultConfig();
    config.server.authToken = "secret";
    const app = testPanelApp(config);

    const response = await app.request("/api/status", {
      headers: { Origin: "http://localhost:5173" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("panel API rejects vite dev origin in production", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const config = buildDefaultConfig();
    config.server.authToken = "secret";
    const app = testPanelApp(config);

    const response = await app.request("/api/status", {
      headers: { Origin: "http://localhost:5173" },
    });

    assert.equal(response.status, 403);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("panel API accepts gateway token as explicit local bypass", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/status", {
    headers: {
      Origin: "https://example.invalid",
      Authorization: "Bearer secret",
    },
  });

  assert.equal(response.status, 200);
});

test("panel API keeps local curl-style reads working without Origin", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/status");

  assert.equal(response.status, 200);
  const body = (await response.json()) as { proxyPort?: number };
  assert.equal(body.proxyPort, config.server.proxyPort);
});

test("panel API requires token for sensitive local requests without Origin", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/launch-commands");

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Authentication required" });
});

test("panel API exposes token-free quick launch commands without Origin", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  config.providers.openrouter.enabled = true;
  const app = testPanelApp(config);

  const response = await app.request("/api/quick-launch");

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    all?: string;
    modelChains?: string;
    manual?: string;
    perProvider?: Array<{ id: string; cli: string }>;
  };
  assert.equal(body.all, "ccpg --all");
  assert.equal(body.modelChains, "ccpg --ModelChain");
  assert.equal(body.manual, undefined);
  assert.deepEqual(body.perProvider, [
    { id: "openrouter", label: "OpenRouter", cli: "ccpg --OpenRouter" },
  ]);
});

test("panel API allows sensitive local requests with gateway token", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/launch-commands", {
    headers: { Authorization: "Bearer secret" },
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { manual?: string };
  assert.ok(body.manual?.includes("ANTHROPIC_AUTH_TOKEN=secret"));
});

test("panel API rejects sensitive local requests with wrong gateway token", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/control/shutdown", {
    method: "POST",
    headers: { Authorization: "Bearer wrong" },
  });

  assert.equal(response.status, 401);
});

test("panel API rejects unknown shell names before installing snippets", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/shell-setup/install", {
    method: "POST",
    headers: {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ shells: ["zsh", "../bad"] }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Unknown shell: ../bad" });
});

test("PUT /api/config persists proxy settings and returns them on GET", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const putResponse = await app.request("/api/config", {
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ proxy: { enabled: true, url: "http://127.0.0.1:7890" } }),
  });
  assert.equal(putResponse.status, 200);

  const getResponse = await app.request("/api/config", {
    headers: { Authorization: "Bearer secret" },
  });
  const body = (await getResponse.json()) as { proxy?: { enabled: boolean; url: string } };
  assert.equal(body.proxy?.enabled, true);
  assert.equal(body.proxy?.url, "http://127.0.0.1:7890");
});

test("PUT /api/config persists token saver settings and returns them on GET", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const putResponse = await app.request("/api/config", {
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tokenSavers: {
        rtkEnabled: true,
        cavemanEnabled: true,
        cavemanLevel: "full",
      },
    }),
  });
  assert.equal(putResponse.status, 200);

  const getResponse = await app.request("/api/config", {
    headers: { Authorization: "Bearer secret" },
  });
  const body = (await getResponse.json()) as {
    tokenSavers?: {
      rtkEnabled: boolean;
      cavemanEnabled: boolean;
      cavemanLevel: string;
    };
  };
  assert.deepEqual(body.tokenSavers, {
    rtkEnabled: true,
    cavemanEnabled: true,
    cavemanLevel: "full",
  });
});

test("PUT /api/config tolerates legacy config without panel settings", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  delete (config as Partial<Config>).panelSettings;
  const app = testPanelApp(config);

  const putResponse = await app.request("/api/config", {
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      panelSettings: {
        favoriteProviders: ["openrouter"],
      },
    }),
  });
  assert.equal(putResponse.status, 200);

  const getResponse = await app.request("/api/config", {
    headers: { Authorization: "Bearer secret" },
  });
  const body = (await getResponse.json()) as {
    panelSettings?: {
      favoriteProviders: string[];
      favoritesTipDismissed: boolean;
    };
  };
  assert.deepEqual(body.panelSettings, {
    favoriteProviders: ["openrouter"],
    favoritesTipDismissed: false,
  });
});

test("PUT /api/config rejects model chain slugs that collide with providers", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  config.providers.acme_ai = {
    enabled: true,
    apiKey: "sk-acme",
    authType: "api_key",
    models: ["acme-large"],
    disabledModels: [],
    baseUrl: "https://api.acme.test/v1",
    rateLimit: 40,
    rateWindow: 60,
    maxConcurrency: 5,
    custom: {
      label: "Acme AI",
      slug: "acme_ai",
      compatibility: "openai",
    },
  };
  const app = testPanelApp(config);

  for (const slug of ["openrouter", "acme_ai"]) {
    const response = await app.request("/api/config", {
      method: "PUT",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        modelFallbacks: [
          {
            id: `chain_${slug}`,
            name: `${slug} Chain`,
            slug,
            enabled: true,
            models: [
              { providerId: "nvidia_nim", model: "meta/llama" },
              { providerId: "openrouter", model: "anthropic/claude-sonnet" },
            ],
          },
        ],
      }),
    });

    assert.equal(response.status, 409);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /conflicts with an existing provider/);
  }
});

test("PUT /api/config rejects duplicate model chain slugs", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/config", {
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelFallbacks: [
        {
          id: "chain_one",
          name: "One",
          slug: "rescue-chain",
          enabled: true,
          models: [
            { providerId: "nvidia_nim", model: "meta/llama" },
            { providerId: "openrouter", model: "anthropic/claude-sonnet" },
          ],
        },
        {
          id: "chain_two",
          name: "Two",
          slug: "--Rescue-Chain",
          enabled: true,
          models: [
            { providerId: "nvidia_nim", model: "meta/llama" },
            { providerId: "openrouter", model: "anthropic/claude-sonnet" },
          ],
        },
      ],
    }),
  });

  assert.equal(response.status, 409);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /already exists/);
});

test("PUT /api/config rejects model chains with fewer than two models", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/config", {
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelFallbacks: [
        {
          id: "chain_one",
          name: "One",
          slug: "one-chain",
          enabled: true,
          models: [{ providerId: "nvidia_nim", model: "meta/llama" }],
        },
      ],
    }),
  });

  assert.equal(response.status, 409);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /at least 2 models/);
});

test("PUT /api/config rejects malformed modelFallbacks payloads", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/config", {
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ modelFallbacks: { slug: "not-an-array" } }),
  });

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /invalid request shape/i);
});

test("PUT /api/config rejects model chains with invalid slugs", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/config", {
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelFallbacks: [
        {
          id: "chain_invalid",
          name: "Invalid",
          slug: "bad slug!",
          enabled: true,
          models: [
            { providerId: "nvidia_nim", model: "meta/llama" },
            { providerId: "openrouter", model: "anthropic/claude-sonnet" },
          ],
        },
      ],
    }),
  });

  assert.equal(response.status, 409);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /invalid slug|slug.*invalid/i);
});

test("PUT /api/config rejects invalid proxy URL when enabled", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/config", {
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ proxy: { enabled: true, url: "not-a-url" } }),
  });
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.ok(body.error.includes("http://") || body.error.includes("https://"));
});

test("PUT /api/config rejects proxy URL with embedded credentials even when disabled", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  for (const enabled of [true, false]) {
    const response = await app.request("/api/config", {
      method: "PUT",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ proxy: { enabled, url: "http://user:pass@proxy.example.com:8080" } }),
    });
    assert.equal(response.status, 400, `expected rejection when enabled=${enabled}`);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.toLowerCase().includes("credential"));
  }
});

test("PUT /api/config rejects enabling proxy when existing URL is empty", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = testPanelApp(config);

  const response = await app.request("/api/config", {
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ proxy: { enabled: true } }),
  });
  assert.equal(response.status, 400);
});

test("PUT /api/config disabling proxy clears the enabled flag", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  config.proxy = { enabled: true, url: "http://127.0.0.1:7890" };
  const app = testPanelApp(config);

  const putResponse = await app.request("/api/config", {
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ proxy: { enabled: false } }),
  });
  assert.equal(putResponse.status, 200);

  const getResponse = await app.request("/api/config", {
    headers: { Authorization: "Bearer secret" },
  });
  const body = (await getResponse.json()) as { proxy?: { enabled: boolean; url: string } };
  assert.equal(body.proxy?.enabled, false);
  assert.equal(body.proxy?.url, "http://127.0.0.1:7890");
});
