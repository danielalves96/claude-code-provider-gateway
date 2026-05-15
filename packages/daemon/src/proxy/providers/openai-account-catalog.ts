import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getConfigPath } from "../../config/index.js";
import type { ModelInfo } from "../../core/anthropic/types.js";

interface CodexModelEntry {
  slug: string;
  display_name?: string;
  description?: string;
  visibility?: string;
  supported_in_api?: boolean;
  base_instructions?: string;
  default_reasoning_level?: string;
  priority?: number;
}

interface ModelsDevModel {
  id: string;
  name?: string;
  release_date?: string;
  last_updated?: string;
}

interface CachedCatalog {
  fetchedAt: number;
  codexModels: CodexModelEntry[];
  modelsDevModels: ModelsDevModel[];
}

export interface OpenAIAccountModel {
  id: string;
  displayName: string;
  instructions?: string;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh";
  priority: number;
  createdAt?: string;
}

const CODEX_MODELS_URL =
  "https://raw.githubusercontent.com/openai/codex/main/codex-rs/models-manager/models.json";
const MODELS_DEV_URL = "https://models.dev/api.json";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const FALLBACK_MODELS: OpenAIAccountModel[] = [
  { id: "gpt-5.5", displayName: "GPT-5.5", reasoningEffort: "medium", priority: 0 },
  { id: "gpt-5.4", displayName: "gpt-5.4", reasoningEffort: "medium", priority: 2 },
  { id: "gpt-5.4-mini", displayName: "GPT-5.4-Mini", reasoningEffort: "medium", priority: 4 },
  { id: "gpt-5.3-codex", displayName: "gpt-5.3-codex", reasoningEffort: "medium", priority: 6 },
  { id: "gpt-5.2", displayName: "gpt-5.2", reasoningEffort: "medium", priority: 10 },
  { id: "gpt-5.2-codex", displayName: "gpt-5.2-codex", reasoningEffort: "medium", priority: 20 },
  {
    id: "gpt-5.1-codex-max",
    displayName: "gpt-5.1-codex-max",
    reasoningEffort: "medium",
    priority: 30,
  },
  { id: "gpt-5.1-codex", displayName: "gpt-5.1-codex", reasoningEffort: "medium", priority: 31 },
  {
    id: "gpt-5.1-codex-mini",
    displayName: "gpt-5.1-codex-mini",
    reasoningEffort: "medium",
    priority: 32,
  },
  { id: "gpt-5.1", displayName: "gpt-5.1", reasoningEffort: "medium", priority: 33 },
];

const FALLBACK_INSTRUCTIONS = [
  "You are Codex, a coding agent running in claude-code-provider-gateway.",
  "Help the user complete software engineering tasks accurately and pragmatically.",
  "When tools are available, use valid function calls that match the provided schemas.",
].join("\n");

let catalogPromise: Promise<CachedCatalog> | null = null;

export async function listOpenAIAccountModels(
  extraModels: string[] = [],
): Promise<OpenAIAccountModel[]> {
  const catalog = await loadCatalog();
  const official = normalizeCodexModels(catalog.codexModels);

  // Only fall back to supplemental/hardcoded lists when official discovery returns nothing.
  let base: OpenAIAccountModel[];
  if (official.length > 0) {
    base = official;
  } else {
    const supplemental = normalizeModelsDev(catalog.modelsDevModels, []);
    base = supplemental.length > 0 ? supplemental : [...FALLBACK_MODELS];
  }

  const merged = mergeModels(base);

  for (const extra of extraModels) {
    const id = extra.trim();
    if (!id || merged.some((model) => model.id === id)) continue;
    merged.push({
      id,
      displayName: id,
      instructions: bestInstructionsForModel(id, merged),
      reasoningEffort: bestReasoningEffortForModel(id, merged),
      priority: 1000 + merged.length,
    });
  }

  return merged;
}

export async function getCodexInstructions(modelId: string): Promise<string> {
  const models = await listOpenAIAccountModels();
  return bestInstructionsForModel(modelId, models) ?? FALLBACK_INSTRUCTIONS;
}

export async function getReasoningEffort(
  modelId: string,
): Promise<"low" | "medium" | "high" | "xhigh"> {
  const models = await listOpenAIAccountModels();
  return bestReasoningEffortForModel(modelId, models) ?? "medium";
}

export function toModelInfo(model: OpenAIAccountModel): ModelInfo {
  return {
    type: "model" as const,
    id: `anthropic/openai_account/${model.id}`,
    display_name: `OpenAI Account · ${model.displayName}`,
    created_at: model.createdAt ?? new Date(0).toISOString(),
  };
}

async function loadCatalog(): Promise<CachedCatalog> {
  if (!catalogPromise) catalogPromise = loadCatalogInner();
  return catalogPromise;
}

async function loadCatalogInner(): Promise<CachedCatalog> {
  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;

  const fresh = await fetchCatalog().catch(() => null);
  if (fresh) {
    writeCache(fresh);
    return fresh;
  }

  return cached ?? { fetchedAt: 0, codexModels: [], modelsDevModels: [] };
}

async function fetchCatalog(): Promise<CachedCatalog> {
  const [codexModels, modelsDevModels] = await Promise.all([
    fetchCodexModels().catch(() => []),
    fetchModelsDevOpenAI().catch(() => []),
  ]);
  return { fetchedAt: Date.now(), codexModels, modelsDevModels };
}

async function fetchCodexModels(): Promise<CodexModelEntry[]> {
  const response = await fetch(CODEX_MODELS_URL);
  if (!response.ok) throw new Error(`Codex model catalog failed: HTTP ${response.status}`);
  const json = (await response.json()) as { models?: CodexModelEntry[] };
  return Array.isArray(json.models) ? json.models : [];
}

async function fetchModelsDevOpenAI(): Promise<ModelsDevModel[]> {
  const response = await fetch(MODELS_DEV_URL);
  if (!response.ok) throw new Error(`models.dev catalog failed: HTTP ${response.status}`);
  const json = (await response.json()) as { openai?: { models?: Record<string, ModelsDevModel> } };
  return Object.values(json.openai?.models ?? {});
}

function normalizeCodexModels(models: CodexModelEntry[]): OpenAIAccountModel[] {
  return models
    .filter((model) => model.visibility === "list" && model.supported_in_api !== false)
    .filter((model) => model.slug.startsWith("gpt-"))
    .map((model) => ({
      id: model.slug,
      displayName: model.display_name ?? model.slug,
      instructions: model.base_instructions,
      reasoningEffort: normalizeReasoningEffort(model.default_reasoning_level),
      priority: typeof model.priority === "number" ? model.priority : 100,
    }));
}

function normalizeModelsDev(
  models: ModelsDevModel[],
  official: OpenAIAccountModel[],
): OpenAIAccountModel[] {
  return models
    .filter((model) => isLikelyCodexAccountModel(model.id))
    .map((model, index) => ({
      id: model.id,
      displayName: model.name ?? model.id,
      instructions: bestInstructionsForModel(model.id, official),
      reasoningEffort: bestReasoningEffortForModel(model.id, official),
      priority: 200 + index,
      createdAt: dateToIso(model.release_date ?? model.last_updated),
    }));
}

function mergeModels(models: OpenAIAccountModel[]): OpenAIAccountModel[] {
  const seen = new Set<string>();
  return models
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .filter((model) => {
      if (seen.has(model.id)) return false;
      seen.add(model.id);
      return true;
    });
}

function bestInstructionsForModel(
  modelId: string,
  models: OpenAIAccountModel[],
): string | undefined {
  return bestModelMatch(modelId, models)?.instructions;
}

function bestReasoningEffortForModel(
  modelId: string,
  models: OpenAIAccountModel[],
): "low" | "medium" | "high" | "xhigh" | undefined {
  return bestModelMatch(modelId, models)?.reasoningEffort;
}

function bestModelMatch(
  modelId: string,
  models: OpenAIAccountModel[],
): OpenAIAccountModel | undefined {
  const exact = models.find((model) => model.id === modelId && model.instructions);
  if (exact) return exact;

  const family = modelFamilyPrefix(modelId);
  return (
    models.find((model) => model.id.startsWith(family) && model.instructions) ??
    models.find((model) => model.id === "gpt-5.5" && model.instructions) ??
    models.find((model) => model.instructions)
  );
}

function modelFamilyPrefix(modelId: string): string {
  const match = /^gpt-\d+(?:\.\d+)?/.exec(modelId);
  return match?.[0] ?? modelId;
}

function isLikelyCodexAccountModel(id: string): boolean {
  return (
    /^gpt-5(?:[.-]|$)/.test(id) &&
    !id.includes("audio") &&
    !id.includes("image") &&
    !id.includes("transcribe") &&
    !id.includes("tts")
  );
}

function normalizeReasoningEffort(value: unknown): "low" | "medium" | "high" | "xhigh" | undefined {
  return value === "low" || value === "medium" || value === "high" || value === "xhigh"
    ? value
    : undefined;
}

function dateToIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function readCache(): CachedCatalog | null {
  try {
    const path = cachePath();
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as CachedCatalog;
    if (!Array.isArray(parsed.codexModels) || !Array.isArray(parsed.modelsDevModels)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(catalog: CachedCatalog): void {
  try {
    const path = cachePath();
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(catalog, null, 2), "utf-8");
  } catch {
    // Cache writes are best-effort; model listing must still work.
  }
}

function cachePath(): string {
  return join(dirname(getConfigPath()), "openai-account-catalog.json");
}
