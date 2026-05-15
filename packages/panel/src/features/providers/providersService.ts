import { http } from "../../shared/api/http.js";
import type {
  CopilotFlow,
  ModelInfo,
  OAuthStartResponse,
  OAuthStatusResponse,
  ProviderInfo,
  TestResult,
} from "./types.js";

interface ProviderPatch {
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  disabledModels?: string[];
}

function patchConfig(providerId: string, patch: ProviderPatch) {
  return http.put("/config", { providers: { [providerId]: patch } });
}

export const providersService = {
  list: () => http.get<ProviderInfo[]>("/providers"),
  test: (id: string) => http.post<TestResult>(`/providers/${id}/test`),
  listModels: (id: string) => http.get<ModelInfo[]>(`/models/${id}`),

  setEnabled: (id: string, enabled: boolean) => patchConfig(id, { enabled }),
  setKey: (id: string, apiKey: string) => patchConfig(id, { apiKey, enabled: true }),
  removeKey: (id: string) => patchConfig(id, { apiKey: "" }),
  setBaseUrl: (id: string, baseUrl: string) => patchConfig(id, { baseUrl }),
  setModels: (id: string, models: string[]) => patchConfig(id, { models }),
  setDisabledModels: (id: string, disabledModels: string[]) => patchConfig(id, { disabledModels }),

  oauthStart: (id: string) => http.post<OAuthStartResponse>(`/providers/${id}/oauth/start`),
  oauthStartDeviceFlow: (id: string) => http.post<CopilotFlow>(`/providers/${id}/oauth/start`),
  oauthStatus: (id: string, key: string) =>
    http.get<OAuthStatusResponse>(`/providers/${id}/oauth/status/${key}`),
  oauthLogout: (id: string) => http.post(`/providers/${id}/oauth/logout`),
};
