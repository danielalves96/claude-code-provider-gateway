import type {
  GatewayProviderStat,
  ProviderStat,
  SessionModelStat,
  SessionRecord,
  SessionRequestLogEntry,
  SessionsResponse,
} from "../../../../daemon/src/panel/contracts.js";

export type ModelStat = SessionModelStat;
export type RequestLogEntry = SessionRequestLogEntry;
export type Session = SessionRecord;

export type { GatewayProviderStat, ProviderStat, SessionsResponse };

export interface StatsResponse {
  providers: GatewayProviderStat[];
}
