import type { Config } from "../schema.js";
import { SECRET_KEYS, type SecretStore } from "./store.js";

// Drains secrets *out of* `config` into `store`, leaving the config object
// safe to persist as plain JSON. Mutates `config` in place.
export function extractSecretsToStore(config: Config, store: SecretStore): void {
  writeIfPresent(store, SECRET_KEYS.serverAuthToken, config.server.authToken);
  config.server.authToken = "";

  for (const id of Object.keys(config.providers)) {
    const provider = config.providers[id];
    if (!provider) continue;

    writeOrDelete(store, SECRET_KEYS.providerApiKey(id), provider.apiKey);
    provider.apiKey = "";

    if (provider.oauth) {
      writeOrDelete(store, SECRET_KEYS.providerOAuthAccessToken(id), provider.oauth.accessToken);
      writeOrDelete(store, SECRET_KEYS.providerOAuthRefreshToken(id), provider.oauth.refreshToken);
      writeOrDelete(store, SECRET_KEYS.providerOAuthCopilotToken(id), provider.oauth.copilotToken);
      provider.oauth.accessToken = undefined;
      provider.oauth.refreshToken = undefined;
      provider.oauth.copilotToken = undefined;
    } else {
      clearProviderOAuthSecrets(store, id);
    }
  }
}

// Hydrates secrets *from* `store` back into `config`. Used by loadConfig after
// reading the JSON skeleton from disk.
export function hydrateSecretsFromStore(config: Config, store: SecretStore): void {
  config.server.authToken = store.get(SECRET_KEYS.serverAuthToken) ?? config.server.authToken;

  for (const id of Object.keys(config.providers)) {
    const provider = config.providers[id];
    if (!provider) continue;

    provider.apiKey = store.get(SECRET_KEYS.providerApiKey(id)) ?? provider.apiKey;

    if (provider.oauth) {
      const access = store.get(SECRET_KEYS.providerOAuthAccessToken(id));
      const refresh = store.get(SECRET_KEYS.providerOAuthRefreshToken(id));
      const copilot = store.get(SECRET_KEYS.providerOAuthCopilotToken(id));
      if (access !== null) provider.oauth.accessToken = access;
      if (refresh !== null) provider.oauth.refreshToken = refresh;
      if (copilot !== null) provider.oauth.copilotToken = copilot;
    }
  }
}

function writeIfPresent(store: SecretStore, key: string, value: string | undefined | null): void {
  if (!value) return;
  store.set(key, value);
}

function writeOrDelete(store: SecretStore, key: string, value: string | undefined | null): void {
  if (value) store.set(key, value);
  else store.delete(key);
}

export function clearProviderOAuthSecrets(store: SecretStore, id: string): void {
  store.delete(SECRET_KEYS.providerOAuthAccessToken(id));
  store.delete(SECRET_KEYS.providerOAuthRefreshToken(id));
  store.delete(SECRET_KEYS.providerOAuthCopilotToken(id));
}

// True iff the on-disk JSON still carries any secret field. Drives the
// one-shot migration that moves secrets into the SecretStore.
export function jsonStillHasSecrets(config: Config): boolean {
  if (config.server.authToken) return true;
  for (const id of Object.keys(config.providers)) {
    const p = config.providers[id];
    if (!p) continue;
    if (p.apiKey) return true;
    if (p.oauth?.accessToken || p.oauth?.refreshToken || p.oauth?.copilotToken) return true;
  }
  return false;
}
