import { http } from "../../shared/api/http.js";
import type { SettingsConfig, ServerConfig, WebToolsConfig, ProxyConfig } from "./types.js";

export const settingsService = {
  get: () => http.get<SettingsConfig>("/config"),
  save: (server: Partial<ServerConfig>, webTools: WebToolsConfig, proxy: ProxyConfig) =>
    http.put<unknown>("/config", { server, webTools, proxy }),
};
