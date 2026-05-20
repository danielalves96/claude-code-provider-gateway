import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultConfig } from "../index.js";
import {
  extractSecretsToStore,
  hydrateSecretsFromStore,
  jsonStillHasSecrets,
} from "./config-splitter.js";
import { SECRET_KEYS, type SecretStore } from "./store.js";

class MemoryStore implements SecretStore {
  private map = new Map<string, string>();
  get(k: string) {
    return this.map.get(k) ?? null;
  }
  set(k: string, v: string) {
    if (v) this.map.set(k, v);
    else this.map.delete(k);
  }
  delete(k: string) {
    this.map.delete(k);
  }
  keys() {
    return Array.from(this.map.keys());
  }
}

test("extracts all secret fields out of config and blanks them", () => {
  const store = new MemoryStore();
  const cfg = buildDefaultConfig();
  cfg.providers.openrouter.apiKey = "sk-or-secret";
  cfg.providers.openai_account.oauth = { accessToken: "at", refreshToken: "rt" };

  extractSecretsToStore(cfg, store);

  assert.equal(cfg.server.authToken, "");
  assert.equal(cfg.providers.openrouter.apiKey, "");
  assert.equal(cfg.providers.openai_account.oauth?.accessToken, undefined);
  assert.equal(cfg.providers.openai_account.oauth?.refreshToken, undefined);

  assert.ok(store.get("server.authToken"));
  assert.equal(store.get("provider.openrouter.apiKey"), "sk-or-secret");
  assert.equal(store.get("provider.openai_account.oauth.accessToken"), "at");
  assert.equal(store.get("provider.openai_account.oauth.refreshToken"), "rt");
});

test("hydrate restores secrets back into config from store", () => {
  const store = new MemoryStore();
  const cfg = buildDefaultConfig();
  cfg.providers.openrouter.apiKey = "sk-or-secret";
  extractSecretsToStore(cfg, store);

  const fresh = buildDefaultConfig();
  fresh.server.authToken = "";
  fresh.providers.openrouter.apiKey = "";
  hydrateSecretsFromStore(fresh, store);

  assert.equal(fresh.providers.openrouter.apiKey, "sk-or-secret");
  assert.ok(fresh.server.authToken.length > 0);
});

test("extract deletes provider secrets when credentials are cleared", () => {
  const store = new MemoryStore();
  const cfg = buildDefaultConfig();
  cfg.providers.openrouter.apiKey = "sk-or-secret";
  cfg.providers.copilot.oauth = {
    accessToken: "github-token",
    refreshToken: "refresh-token",
    copilotToken: "copilot-token",
  };
  extractSecretsToStore(cfg, store);

  const cleared = buildDefaultConfig();
  cleared.providers.openrouter.apiKey = "";
  cleared.providers.copilot.oauth = {};
  extractSecretsToStore(cleared, store);

  assert.equal(store.get(SECRET_KEYS.providerApiKey("openrouter")), null);
  assert.equal(store.get(SECRET_KEYS.providerOAuthAccessToken("copilot")), null);
  assert.equal(store.get(SECRET_KEYS.providerOAuthRefreshToken("copilot")), null);
  assert.equal(store.get(SECRET_KEYS.providerOAuthCopilotToken("copilot")), null);
});

test("jsonStillHasSecrets detects unmigrated config", () => {
  const cfg = buildDefaultConfig();
  assert.ok(jsonStillHasSecrets(cfg), "fresh config has generated tokens");

  const store = new MemoryStore();
  extractSecretsToStore(cfg, store);
  assert.equal(jsonStillHasSecrets(cfg), false);
});
