export const COMMANDCODE_VERSION = "0.25.7";
export const DEFAULT_COMMANDCODE_ENDPOINT = "https://api.commandcode.ai/alpha/generate";

const COMMANDCODE_MODELS_DOCS_URL = "https://commandcode.ai/docs/resources/pricing-limits";

export const COMMANDCODE_MODELS = [
  { id: "taste-1", name: "taste-1" },
  { id: "anthropic/claude-opus-4-7", name: "Claude Opus 4.7" },
  { id: "anthropic/claude-opus-4-6", name: "Claude Opus 4.6" },
  { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  { id: "anthropic/claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  { id: "openai/gpt-5.5", name: "GPT-5.5" },
  { id: "openai/gpt-5.4", name: "GPT-5.4" },
  { id: "openai/gpt-5.4-mini", name: "GPT-5.4 Mini" },
  { id: "openai/gpt-5.3-codex", name: "GPT-5.3 Codex" },
  { id: "anthropic/claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" },
  { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro" },
  { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash" },
  { id: "moonshotai/Kimi-K2.6", name: "Kimi K2.6" },
  { id: "moonshotai/Kimi-K2.5", name: "Kimi K2.5" },
  { id: "zai-org/GLM-5.1", name: "GLM 5.1" },
  { id: "zai-org/GLM-5", name: "GLM 5" },
  { id: "MiniMaxAI/MiniMax-M2.7", name: "MiniMax M2.7" },
  { id: "MiniMaxAI/MiniMax-M2.5", name: "MiniMax M2.5" },
  { id: "Qwen/Qwen3.6-Max-Preview", name: "Qwen 3.6 Max Preview" },
  { id: "Qwen/Qwen3.6-Plus", name: "Qwen 3.6 Plus" },
  { id: "stepfun/Step-3.5-Flash", name: "Step 3.5 Flash" },
] as const;

export function stripCommandCodeModelPrefix(requestedModel: string): string {
  let model = requestedModel;
  if (model.startsWith("anthropic/")) model = model.slice("anthropic/".length);
  if (model.startsWith("commandcode/")) model = model.slice("commandcode/".length);
  return model;
}

export function mergeCommandCodeModels(
  models: Array<(typeof COMMANDCODE_MODELS)[number]>,
  extraModels: string[],
): Array<{ id: string; name: string }> {
  const merged: Array<{ id: string; name: string }> = [...models];
  const seen = new Set(merged.map((model) => model.id));

  for (const rawModel of extraModels) {
    const id = stripCommandCodeModelPrefix(rawModel.trim());
    if (!id || seen.has(id)) continue;
    merged.push({ id, name: id });
    seen.add(id);
  }

  return merged;
}

export async function fetchCommandCodeModelsFromDocs(): Promise<
  Array<(typeof COMMANDCODE_MODELS)[number]>
> {
  const response = await fetch(COMMANDCODE_MODELS_DOCS_URL, {
    headers: { Accept: "text/html, text/plain;q=0.9" },
  });
  if (!response.ok) {
    throw new Error(`CommandCode models docs failed: HTTP ${response.status}`);
  }

  const html = await response.text();
  const modelsSection =
    html.match(/Models\.(?<section>[\s\S]*?)Model pricing\./)?.groups?.section ?? html;
  const discovered = COMMANDCODE_MODELS.map((model) => ({
    model,
    index: modelsSection.indexOf(model.name),
  }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index)
    .map(({ model }) => model);

  return discovered.length > 0 ? discovered : [...COMMANDCODE_MODELS];
}
