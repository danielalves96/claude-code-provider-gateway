import { http } from "../../../shared/api/http.js";
import type {
  CopilotFlow,
  ModelInfo,
  OAuthStartResponse,
  OAuthStatusResponse,
  ProviderInfo,
  TestResult,
} from "../domain/types.js";

interface ProviderPatch {
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  disabledModels?: string[];
  rateLimit?: number;
  rateWindow?: number;
  maxConcurrency?: number;
}

export interface CustomProviderDraft {
  name: string;
  slug: string;
  baseUrl: string;
  apiKey: string;
  compatibility: "openai" | "anthropic";
  logo?: File | null;
}

function patchConfig(providerId: string, patch: ProviderPatch) {
  return http.put("/config", { providers: { [providerId]: patch } });
}

export const providersService = {
  list: () => http.get<ProviderInfo[]>("/providers"),
  test: (id: string) => http.post<TestResult>(`/providers/${id}/test`),
  testCustom: (draft: CustomProviderDraft) =>
    http.post<TestResult & { models?: ModelInfo[] }>("/custom-providers/test", draft),
  createCustom: (draft: CustomProviderDraft) => {
    const form = new FormData();
    form.set("name", draft.name);
    form.set("slug", draft.slug);
    form.set("baseUrl", draft.baseUrl);
    form.set("apiKey", draft.apiKey);
    form.set("compatibility", draft.compatibility);
    if (draft.logo) form.set("logo", draft.logo);
    return http.post<{ ok: boolean; id: string }>("/custom-providers", form);
  },
  deleteCustom: (id: string) => http.delete(`/custom-providers/${encodeURIComponent(id)}`),
  listModels: (id: string) => http.get<ModelInfo[]>(`/models/${id}`),

  setEnabled: (id: string, enabled: boolean) => patchConfig(id, { enabled }),
  setKey: (id: string, apiKey: string) => patchConfig(id, { apiKey, enabled: true }),
  removeKey: (id: string) => patchConfig(id, { apiKey: "" }),
  setBaseUrl: (id: string, baseUrl: string) => patchConfig(id, { baseUrl }),
  setModels: (id: string, models: string[]) => patchConfig(id, { models }),
  setDisabledModels: (id: string, disabledModels: string[]) => patchConfig(id, { disabledModels }),
  setRuntimeLimits: (
    id: string,
    limits: Pick<ProviderPatch, "rateLimit" | "rateWindow" | "maxConcurrency">,
  ) => patchConfig(id, limits),

  oauthStart: (id: string) => http.post<OAuthStartResponse>(`/providers/${id}/oauth/start`),
  oauthStartDeviceFlow: (id: string) => http.post<CopilotFlow>(`/providers/${id}/oauth/start`),
  oauthStatus: (id: string, key: string) =>
    http.get<OAuthStatusResponse>(`/providers/${id}/oauth/status/${key}`),
  oauthLogout: (id: string) => http.post(`/providers/${id}/oauth/logout`),
};
