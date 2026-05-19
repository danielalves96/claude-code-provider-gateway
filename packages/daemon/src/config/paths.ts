import { homedir, platform } from "node:os";
import { join } from "node:path";

export function getConfigDir(): string {
  if (platform() === "win32") {
    return join(process.env.APPDATA ?? homedir(), "claude-code-provider-gateway");
  }
  return join(homedir(), ".config", "claude-code-provider-gateway");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export function getPidPath(): string {
  return join(getConfigDir(), "daemon.pid");
}

export function getLogPath(): string {
  return join(getConfigDir(), "daemon.log");
}

export function getSecretsPath(): string {
  return join(getConfigDir(), "secrets.enc.json");
}

export function getMasterKeyPath(): string {
  return join(getConfigDir(), "secret.key");
}

export function getCurrentSessionPath(): string {
  return join(getConfigDir(), "current-session.json");
}

export function getSessionArchivePath(): string {
  return join(getConfigDir(), "sessions.jsonl");
}

export function getProviderLogoDir(): string {
  return join(getConfigDir(), "provider-logos");
}
