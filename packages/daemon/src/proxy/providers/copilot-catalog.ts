import type { ModelInfo } from "../../core/anthropic/types.js";
import { copilotEditorHeaders } from "./copilot-auth.js";

interface CopilotApiModel {
  id: string;
  name?: string;
  vendor?: string;
  capabilities?: {
    type?: string;
    family?: string;
    supports?: { tool_calls?: boolean; streaming?: boolean };
  };
  model_picker_enabled?: boolean;
  policy?: { state?: string; terms?: string };
  preview?: boolean;
  supported_endpoints?: string[] | null;
}

export interface CopilotModel {
  id: string;
  displayName: string;
}

export async function listCopilotModels(
  copilotToken: string,
  endpoint: string,
): Promise<CopilotModel[]> {
  const url = `${endpoint.replace(/\/$/, "")}/models`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${copilotToken}`,
      Accept: "application/json",
      ...copilotEditorHeaders(),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Copilot model list failed: HTTP ${response.status} ${text.slice(0, 300)}`);
  }
  const json = (await response.json()) as { data?: CopilotApiModel[] };
  const data = Array.isArray(json.data) ? json.data : [];
  const seen = new Set<string>();
  const result: CopilotModel[] = [];
  for (const model of data) {
    if (!isAvailableForAccount(model)) continue;
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    result.push({ id: model.id, displayName: model.name ?? model.id });
  }
  return result;
}

// Mirrors opencode/VS Code Copilot extension behavior: only surface models the
// signed-in account can actually invoke. The /models endpoint returns the full
// catalog; the per-account gating lives in `model_picker_enabled` (false hides
// preview/internal models) and `policy.state` (any value other than "enabled"
// means the user has not accepted terms or the model is disabled for the plan).
function isAvailableForAccount(model: CopilotApiModel): boolean {
  if (model.capabilities?.type !== "chat") return false;
  if (model.model_picker_enabled !== true) return false;
  // Some models gate behind terms-of-use; only "enabled" means the account accepted.
  if (model.policy?.state && model.policy.state !== "enabled") return false;
  // Preview models are visible in the API but hidden in the picker by opencode/VSCode.
  if (model.preview === true) return false;
  // Codex-style models only expose /responses; our transport speaks /chat/completions,
  // so they would 404 anyway. Models without supported_endpoints declared default to /chat/completions.
  if (
    Array.isArray(model.supported_endpoints) &&
    !model.supported_endpoints.includes("/chat/completions")
  ) {
    return false;
  }
  return true;
}

export function toCopilotModelInfo(model: CopilotModel): ModelInfo {
  return {
    type: "model" as const,
    id: `anthropic/copilot/${model.id}`,
    display_name: `GitHub Copilot · ${model.displayName}`,
    created_at: new Date(0).toISOString(),
  };
}
