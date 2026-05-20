import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultConfig } from "../../config/index.js";
import { ProxyRuntime } from "../runtime.js";
import { ModelService } from "./model-service.js";

test("ModelService returns empty model list when active provider is disabled", async () => {
  const config = buildDefaultConfig();
  for (const provider of Object.values(config.providers)) provider.enabled = false;
  const service = new ModelService(new ProxyRuntime(config));

  const result = await service.listModels();

  assert.deepEqual(result, {
    data: [],
    has_more: false,
    first_id: null,
    last_id: null,
  });
});

test("ModelService advertises only the active model chain during chain launch", async () => {
  const config = buildDefaultConfig();
  config.providers.nvidia_nim.enabled = true;
  config.activeProvider = "nvidia_nim";
  config.activeModelFallbackSlug = "foode";
  config.modelFallbacks = [
    {
      id: "chain_foode",
      name: "Foode",
      slug: "foode",
      enabled: true,
      models: [{ providerId: "nvidia_nim", model: "anthropic/nvidia_nim/some-model" }],
    },
    {
      id: "chain_other",
      name: "Other",
      slug: "other",
      enabled: true,
      models: [{ providerId: "openrouter", model: "anthropic/openrouter/other-model" }],
    },
  ];
  const service = new ModelService(new ProxyRuntime(config));

  const result = await service.listModels();

  assert.deepEqual(
    result.data.map((model) => model.id),
    ["anthropic/chain/foode"],
  );
  assert.equal(result.first_id, "anthropic/chain/foode");
  assert.equal(result.last_id, "anthropic/chain/foode");
});

test("ModelService advertises all model chains in chains mode", async () => {
  const config = buildDefaultConfig();
  config.providers.nvidia_nim.enabled = true;
  config.activeProvider = "nvidia_nim";
  config.modelMode = "chains";
  config.modelFallbacks = [
    {
      id: "chain_foode",
      name: "Foode",
      slug: "foode",
      enabled: true,
      models: [{ providerId: "nvidia_nim", model: "anthropic/nvidia_nim/some-model" }],
    },
    {
      id: "chain_other",
      name: "Other",
      slug: "other",
      enabled: true,
      models: [{ providerId: "openrouter", model: "anthropic/openrouter/other-model" }],
    },
  ];
  const service = new ModelService(new ProxyRuntime(config));

  const result = await service.listModels();

  assert.deepEqual(
    result.data.map((model) => model.id),
    ["anthropic/chain/foode", "anthropic/chain/other"],
  );
});

test("ModelService does not advertise model chains during single provider launch", async () => {
  const config = buildDefaultConfig();
  config.providers.openrouter.enabled = true;
  config.providers.openrouter.models = ["openrouter-model"];
  config.activeProvider = "openrouter";
  config.modelMode = "single";
  config.activeModelFallbackSlug = null;
  config.modelFallbacks = [
    {
      id: "chain_copilot",
      name: "Copilot Chain",
      slug: "copilot-chain",
      enabled: true,
      models: [{ providerId: "copilot", model: "anthropic/copilot/claude-sonnet-4" }],
    },
  ];
  const service = new ModelService(new ProxyRuntime(config));

  const result = await service.listModels();

  assert.equal(
    result.data.some((model) => model.id.startsWith("anthropic/chain/")),
    false,
  );
});
