import type { Hono } from "hono";
import type { CountTokensRequest, MessagesRequest } from "../../core/anthropic/types.js";
import { requireAnthropicAuth } from "../middleware/auth.js";
import type { ProxyRuntime } from "../runtime.js";
import { MessageService } from "../services/message-service.js";
import { ModelService } from "../services/model-service.js";

export function registerAnthropicRoutes(app: Hono, runtime: ProxyRuntime): void {
  const messages = new MessageService(runtime);
  const models = new ModelService(runtime);

  app.use("/v1/*", requireAnthropicAuth(runtime));

  app.on(["HEAD", "OPTIONS"], "/v1/messages", (_c) => new Response(null, { status: 204 }));
  app.on(
    ["HEAD", "OPTIONS"],
    "/v1/messages/count_tokens",
    (_c) => new Response(null, { status: 204 }),
  );

  app.post("/v1/messages/count_tokens", async (c) => {
    const req = await c.req.json<CountTokensRequest>();
    const tokens = messages.countTokens(req as MessagesRequest);
    return c.json({ input_tokens: tokens });
  });

  app.get("/v1/models", async (c) => {
    return c.json(await models.listModels());
  });

  app.post("/v1/messages", async (c) => {
    const req = await c.req.json<MessagesRequest>();
    const result = await messages.createMessage(req);

    if (result.kind === "error") return c.json(result.body, result.status);

    return new Response(result.stream as unknown as BodyInit, {
      status: result.status,
      headers: result.headers,
    });
  });
}
