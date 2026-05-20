import { http } from "../../../shared/api/http.js";
import type { SessionsResponse, StatsResponse } from "../domain/types.js";

export const historyService = {
  list: () => http.get<SessionsResponse>("/sessions"),
  stats: () => http.get<StatsResponse>("/stats"),
  clearArchive: () => http.delete<SessionsResponse>("/sessions"),
  deleteSession: (id: string) =>
    http.delete<{ ok: boolean; archive: SessionsResponse["archive"] }>(`/sessions/${id}`),
};
