import type { Config } from "../../../../daemon/src/config/schema.js";
import type { SettingsConfigResponse } from "../../../../daemon/src/panel/contracts.js";

export type ServerConfig = Partial<Config["server"]>;
export type WebToolsConfig = Config["webTools"];
export type ProxyConfig = Config["proxy"];
export type TokenSaversConfig = Config["tokenSavers"];
export type SettingsConfig = SettingsConfigResponse;
