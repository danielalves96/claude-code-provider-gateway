import { randomUUID } from "node:crypto";
import type {
  ContentBlock,
  Message,
  MessagesRequest,
  ModelInfo,
} from "../../core/anthropic/types.js";
import {
  sseContentBlockDelta,
  sseContentBlockStart,
  sseContentBlockStop,
  sseError,
  sseMessageDelta,
  sseMessageStart,
  sseMessageStop,
  ssePing,
} from "../../core/sse/writer.js";
import { postProviderStream } from "./api-client.js";
import type { StreamResult } from "./base.js";
import { BaseProvider } from "./base.js";

const COMMANDCODE_VERSION = "0.25.7";
const DEFAULT_COMMANDCODE_ENDPOINT = "https://api.commandcode.ai/alpha/generate";
const COMMANDCODE_MODELS_DOCS_URL = "https://commandcode.ai/docs/resources/pricing-limits";

const COMMANDCODE_MODELS = [
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

type CommandCodeContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; image: string }
  | { type: "reasoning"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      output: { type: "text" | "error-text"; value: string };
    };

interface CommandCodeMessage {
  role: "user" | "assistant" | "tool";
  content: string | CommandCodeContentBlock[];
}

interface CommandCodeRequest {
  threadId: string;
  memory: string;
  config: {
    workingDir: string;
    date: string;
    environment: string;
    structure: unknown[];
    isGitRepo: boolean;
    currentBranch: string;
    mainBranch: string;
    gitStatus: string;
    recentCommits: unknown[];
  };
  params: {
    model: string;
    messages: CommandCodeMessage[];
    stream: boolean;
    max_tokens: number;
    temperature: number;
    system?: string;
    tools?: Array<{ name: string; description?: string; input_schema: Record<string, unknown> }>;
    top_p?: number;
    top_k?: number;
    stop_sequences?: string[];
  };
}

type CommandCodeEvent = Record<string, unknown> & { type?: string };

interface TransformState {
  textIndex: number | null;
  reasoningIndex: number | null;
  nextBlockIndex: number;
  toolById: Map<
    string,
    { index: number; id: string; name: string; stopped: boolean; streamed: boolean }
  >;
  finishReason: string | null;
  outputTokens: number;
  finished: boolean;
  emittedContent: boolean;
}

export class CommandCodeProvider extends BaseProvider {
  get id() {
    return "commandcode";
  }

  get label() {
    return "Command Code";
  }

  async streamResponse(req: MessagesRequest, inputTokens: number): Promise<StreamResult> {
    if (this.requiresApiKey() && !this.hasApiKey()) {
      return { error: { status: 401, message: this.missingApiKeyMessage() } };
    }

    const providerModel = stripCommandCodeModelPrefix(req.model);
    const result = await postProviderStream({
      url: this.endpointUrl(),
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: this.authHeader(),
        "x-command-code-version": COMMANDCODE_VERSION,
        "x-cli-environment": "cli",
        "x-session-id": randomUUID(),
      },
      body: await anthropicToCommandCode(req, providerModel),
      timeoutMs: this.requestTimeoutMs(),
    });

    if ("error" in result) return { error: result.error };

    const messageId = `msg_${randomUUID().replace(/-/g, "")}`;
    return {
      stream: commandCodeStreamToAnthropic(result.body, {
        messageId,
        model: req.model,
        inputTokens,
      }),
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    if (this.requiresApiKey() && !this.hasApiKey()) {
      throw new Error(this.missingApiKeyMessage());
    }

    const models = await fetchCommandCodeModelsFromDocs().catch(() => [...COMMANDCODE_MODELS]);
    return mergeCommandCodeModels(models, this.config.models ?? []).map((model) => ({
      type: "model" as const,
      id: `anthropic/${this.id}/${model.id}`,
      display_name: `${this.label} · ${model.name}`,
      created_at: new Date(0).toISOString(),
    }));
  }

  protected override baseUrl(): string {
    return this.config.baseUrl?.trim() || DEFAULT_COMMANDCODE_ENDPOINT;
  }

  private endpointUrl(): string {
    return this.baseUrl().replace(/\/$/, "");
  }
}

function mergeCommandCodeModels(
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

async function fetchCommandCodeModelsFromDocs(): Promise<
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

export async function anthropicToCommandCode(
  req: MessagesRequest,
  providerModel = stripCommandCodeModelPrefix(req.model),
): Promise<CommandCodeRequest> {
  const params: CommandCodeRequest["params"] = {
    model: providerModel,
    messages: await convertMessages(req.messages),
    stream: true,
    max_tokens: req.max_tokens,
    temperature: req.temperature ?? 0.3,
  };

  const system = systemToString(req.system);
  if (system) params.system = system;
  if (req.tools?.length) {
    params.tools = req.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));
  }
  if (req.top_p != null) params.top_p = req.top_p;
  if (req.top_k != null) params.top_k = req.top_k;
  if (req.stop_sequences?.length) params.stop_sequences = req.stop_sequences;

  return {
    threadId: randomUUID(),
    memory: "",
    config: {
      workingDir: process.cwd(),
      date: new Date().toISOString().slice(0, 10),
      environment: process.platform,
      structure: [],
      isGitRepo: false,
      currentBranch: "",
      mainBranch: "",
      gitStatus: "",
      recentCommits: [],
    },
    params,
  };
}

export function commandCodeStreamToAnthropic(
  body: ReadableStream<Uint8Array>,
  options: { messageId: string; model: string; inputTokens: number },
): ReadableStream<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  const state = createTransformState();

  return new ReadableStream<string>({
    async start(controller) {
      const reader = body.getReader();
      const enq = (chunk: string) => controller.enqueue(chunk);

      enq(ssePing());
      enq(sseMessageStart(options.messageId, options.model, options.inputTokens));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            handleCommandCodeLine(line, state, enq);
          }
        }

        const trailing = buffer.trim();
        if (trailing) handleCommandCodeLine(trailing, state, enq);
        finishAnthropicMessage(state, enq);
      } catch (err) {
        enq(sseError("api_error", err instanceof Error ? err.message : String(err)));
      } finally {
        controller.close();
      }
    },
  });
}

async function convertMessages(messages: Message[]): Promise<CommandCodeMessage[]> {
  const out: CommandCodeMessage[] = [];
  const toolNames = buildToolNameMap(messages);

  for (const message of messages) {
    if (typeof message.content === "string") {
      out.push({ role: message.role, content: message.content });
      continue;
    }

    if (message.role === "user") {
      const toolResults = await Promise.all(
        message.content
          .filter((block) => block.type === "tool_result")
          .map((block) => convertToolResultBlock(block, toolNames)),
      );
      const nonToolResults = (
        await Promise.all(
          message.content.map((block) =>
            block.type === "tool_result" ? Promise.resolve([]) : convertContentBlock(block),
          ),
        )
      ).flat();

      if (nonToolResults.length) {
        out.push({ role: "user", content: collapseTextContent(nonToolResults) });
      }
      for (const toolResult of toolResults) {
        out.push({ role: "tool", content: [toolResult] });
      }
      if (!nonToolResults.length && !toolResults.length) out.push({ role: "user", content: "" });
      continue;
    }

    const blocks = (
      await Promise.all(message.content.map((block) => convertContentBlock(block)))
    ).flat();
    out.push({
      role: "assistant",
      content: collapseTextContent(blocks),
    });
  }

  return out;
}

function buildToolNameMap(messages: Message[]): Map<string, string> {
  const toolNames = new Map<string, string>();
  for (const message of messages) {
    if (typeof message.content === "string") continue;
    for (const block of message.content) {
      if (block.type === "tool_use") toolNames.set(block.id, block.name);
    }
  }
  return toolNames;
}

function collapseTextContent(
  blocks: CommandCodeContentBlock[],
): string | CommandCodeContentBlock[] {
  if (blocks.length === 0) return "";
  if (blocks.length === 1 && blocks[0]?.type === "text") return blocks[0].text;
  return blocks;
}

function stripCommandCodeModelPrefix(requestedModel: string): string {
  let model = requestedModel;
  if (model.startsWith("anthropic/")) model = model.slice("anthropic/".length);
  if (model.startsWith("commandcode/")) model = model.slice("commandcode/".length);
  return model;
}

async function convertContentBlock(block: ContentBlock): Promise<CommandCodeContentBlock[]> {
  switch (block.type) {
    case "text":
      return [{ type: "text", text: block.text }];
    case "thinking":
      return block.thinking ? [{ type: "reasoning", text: block.thinking }] : [];
    case "image":
      return [{ type: "image", image: imageSourceToString(block.source) }];
    case "document":
      return [{ type: "text", text: documentText(block) }];
    case "tool_use":
      return [
        {
          type: "tool-call",
          toolCallId: block.id,
          toolName: block.name,
          input: block.input,
        },
      ];
    case "tool_result":
      return [];
  }
}

async function convertToolResultBlock(
  block: Extract<ContentBlock, { type: "tool_result" }>,
  toolNames: Map<string, string>,
): Promise<CommandCodeContentBlock> {
  return {
    type: "tool-result",
    toolCallId: block.tool_use_id,
    toolName: toolNames.get(block.tool_use_id) ?? "unknown",
    output: {
      type: block.is_error ? "error-text" : "text",
      value: toolResultText(block.content),
    },
  };
}

function imageSourceToString(block: Extract<ContentBlock, { type: "image" }>["source"]): string {
  if (block.type === "url") return block.url;
  return `data:${block.media_type};base64,${block.data}`;
}

function documentText(block: Extract<ContentBlock, { type: "document" }>): string {
  if (block.source.type === "text") return block.source.text;
  return block.title ? `[document omitted: ${block.title}]` : "[document omitted]";
}

function toolResultText(
  content: Extract<ContentBlock, { type: "tool_result" }>["content"],
): string {
  if (typeof content === "string") return content;
  const parts = content.map((block) => {
    if (block.type === "text") return block.text;
    if (block.type === "tool_use") return JSON.stringify(block.input);
    if (block.type === "thinking") return block.thinking;
    if (block.type === "document") return documentText(block);
    return `[${block.type} omitted]`;
  });
  return parts.join("\n");
}

function systemToString(system: MessagesRequest["system"]): string | undefined {
  if (!system) return undefined;
  if (typeof system === "string") return system;
  const text = system
    .map((block) => block.text)
    .filter(Boolean)
    .join("\n\n");
  return text || undefined;
}

function createTransformState(): TransformState {
  return {
    textIndex: null,
    reasoningIndex: null,
    nextBlockIndex: 0,
    toolById: new Map(),
    finishReason: null,
    outputTokens: 0,
    finished: false,
    emittedContent: false,
  };
}

function handleCommandCodeLine(
  line: string,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  const data = normalizeEventLine(line);
  if (!data) return;

  let event: CommandCodeEvent;
  try {
    event = JSON.parse(data) as CommandCodeEvent;
  } catch {
    return;
  }

  handleCommandCodeEvent(event, state, enq);
}

function normalizeEventLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
  if (!data || data === "[DONE]") return null;
  return data;
}

function handleCommandCodeEvent(
  event: CommandCodeEvent,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  switch (event.type) {
    case "text-delta":
      emitTextDelta(stringValue(event.text ?? event.delta), state, enq);
      break;
    case "reasoning-delta":
      emitReasoningDelta(stringValue(event.text ?? event.delta), state, enq);
      break;
    case "tool-input-start":
      startToolBlock(toolId(event), stringValue(event.toolName), state, enq);
      break;
    case "tool-input-delta":
      emitToolDelta(toolId(event), stringValue(event.delta ?? event.inputTextDelta), state, enq);
      break;
    case "tool-input-end":
      stopToolBlock(toolId(event), state, enq);
      break;
    case "tool-call":
      emitToolCall(event, state, enq);
      break;
    case "finish-step":
      state.finishReason = mapFinishReason(stringValue(event.finishReason));
      updateUsage(event.usage, state);
      break;
    case "finish":
      state.finishReason = state.finishReason ?? mapFinishReason(stringValue(event.finishReason));
      updateUsage(event.totalUsage ?? event.usage, state);
      finishAnthropicMessage(state, enq);
      break;
    case "error":
      enq(sseError("api_error", errorMessage(event)));
      state.finishReason = "end_turn";
      finishAnthropicMessage(state, enq);
      break;
    default:
      if (isCommandCodeErrorObject(event)) {
        emitTextDelta(`CommandCode error: ${errorMessage(event)}`, state, enq);
        state.finishReason = "end_turn";
        finishAnthropicMessage(state, enq);
        break;
      }
      emitKnownTextPayload(event, state, enq);
      updateUsage(event.usage, state);
      break;
  }
}

function isCommandCodeErrorObject(event: CommandCodeEvent): boolean {
  return event.success === false || typeof event.error === "object";
}

function emitKnownTextPayload(
  event: CommandCodeEvent,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  if (typeof event.message === "string") emitTextDelta(event.message, state, enq);
  if (typeof event.content === "string") emitTextDelta(event.content, state, enq);
  if (!Array.isArray(event.content)) return;

  for (const block of event.content) {
    if (!block || typeof block !== "object") continue;
    const contentBlock = block as CommandCodeEvent;
    if (contentBlock.type === "text") emitTextDelta(stringValue(contentBlock.text), state, enq);
    if (contentBlock.type === "reasoning") {
      emitReasoningDelta(stringValue(contentBlock.text), state, enq);
    }
    if (contentBlock.type === "tool-call") emitToolCall(contentBlock, state, enq);
  }
}

function emitTextDelta(text: string, state: TransformState, enq: (chunk: string) => void): void {
  if (!text) return;
  if (state.textIndex == null) {
    state.textIndex = state.nextBlockIndex++;
    enq(sseContentBlockStart(state.textIndex, { type: "text", text: "" }));
  }
  state.emittedContent = true;
  enq(sseContentBlockDelta(state.textIndex, { type: "text_delta", text }));
}

function emitReasoningDelta(
  text: string,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  if (!text) return;
  if (state.reasoningIndex == null) {
    state.reasoningIndex = state.nextBlockIndex++;
    enq(sseContentBlockStart(state.reasoningIndex, { type: "thinking", thinking: "" }));
  }
  state.emittedContent = true;
  enq(sseContentBlockDelta(state.reasoningIndex, { type: "thinking_delta", thinking: text }));
}

function startToolBlock(
  id: string,
  name: string,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  if (!id) return;
  const existing = state.toolById.get(id);
  if (existing) return;

  const tool = {
    index: state.nextBlockIndex++,
    id,
    name,
    stopped: false,
    streamed: false,
  };
  state.toolById.set(id, tool);
  state.emittedContent = true;
  enq(sseContentBlockStart(tool.index, { type: "tool_use", id, name, input: {} }));
}

function emitToolDelta(
  id: string,
  partialJson: string,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  if (!id || !partialJson) return;
  const tool = state.toolById.get(id);
  if (!tool || tool.stopped) return;
  tool.streamed = true;
  enq(sseContentBlockDelta(tool.index, { type: "input_json_delta", partial_json: partialJson }));
}

function stopToolBlock(id: string, state: TransformState, enq: (chunk: string) => void): void {
  const tool = state.toolById.get(id);
  if (!tool || tool.stopped) return;
  tool.stopped = true;
  enq(sseContentBlockStop(tool.index));
}

function emitToolCall(
  event: CommandCodeEvent,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  const id = toolId(event);
  if (!id) return;
  const existing = state.toolById.get(id);
  if (existing?.streamed) {
    stopToolBlock(id, state, enq);
    return;
  }

  startToolBlock(id, stringValue(event.toolName), state, enq);
  const input = typeof event.input === "string" ? event.input : JSON.stringify(event.input ?? {});
  emitToolDelta(id, input, state, enq);
  stopToolBlock(id, state, enq);
}

function finishAnthropicMessage(state: TransformState, enq: (chunk: string) => void): void {
  if (state.finished) return;
  state.finished = true;

  const openIndexes: number[] = [];
  if (state.reasoningIndex != null) openIndexes.push(state.reasoningIndex);
  if (state.textIndex != null) openIndexes.push(state.textIndex);
  for (const tool of state.toolById.values()) {
    if (!tool.stopped) {
      tool.stopped = true;
      openIndexes.push(tool.index);
    }
  }
  for (const index of openIndexes.sort((a, b) => a - b)) {
    enq(sseContentBlockStop(index));
  }

  if (!state.emittedContent) {
    const index = state.nextBlockIndex++;
    enq(sseContentBlockStart(index, { type: "text", text: "" }));
    enq(
      sseContentBlockDelta(index, {
        type: "text_delta",
        text: "CommandCode returned an empty response for this request.",
      }),
    );
    enq(sseContentBlockStop(index));
  }

  enq(sseMessageDelta(state.finishReason ?? "end_turn", state.outputTokens));
  enq(sseMessageStop());
}

function toolId(event: CommandCodeEvent): string {
  return stringValue(event.id ?? event.toolCallId);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mapFinishReason(reason: string): string {
  switch (reason) {
    case "tool-calls":
    case "tool_use":
      return "tool_use";
    case "length":
      return "max_tokens";
    case "stop":
    case "":
      return "end_turn";
    default:
      return reason;
  }
}

function updateUsage(usage: unknown, state: TransformState): void {
  if (!usage || typeof usage !== "object") return;
  const value = usage as Record<string, unknown>;
  const outputTokens = value.outputTokens ?? value.completion_tokens ?? value.output_tokens;
  if (typeof outputTokens === "number" && Number.isFinite(outputTokens)) {
    state.outputTokens = outputTokens;
  }
}

function errorMessage(event: CommandCodeEvent): string {
  const value = event.error ?? event.message ?? "unknown error";
  if (value && typeof value === "object" && "message" in value) {
    return stringValue((value as { message?: unknown }).message) || JSON.stringify(value);
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}
