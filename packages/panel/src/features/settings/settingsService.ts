import { http } from "../../shared/api/http.js";
import type {
  ProxyConfig,
  ServerConfig,
  SettingsConfig,
  TokenSaversConfig,
  WebToolsConfig,
} from "./types.js";

export const settingsService = {
  get: () => http.get<SettingsConfig>("/config"),
  save: (
    server: Partial<ServerConfig>,
    webTools: WebToolsConfig,
    proxy: ProxyConfig,
    tokenSavers: TokenSaversConfig,
  ) => http.put<unknown>("/config", { server, webTools, proxy, tokenSavers }),
};
