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
