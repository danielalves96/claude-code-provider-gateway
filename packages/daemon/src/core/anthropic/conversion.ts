// Anthropic Messages ↔ OpenAI Chat Completions conversion

import type { ContentBlock, Message, MessagesRequest } from "./types.js";

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenAIContentPart[];
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OpenAIContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface OpenAITool {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stream: boolean;
  tools?: OpenAITool[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  stop?: string[];
}

export interface ConversionWarning {
  code: string;
  message: string;
  path?: string;
}

interface ConversionContext {
  warnings: ConversionWarning[];
}

function warn(ctx: ConversionContext, code: string, message: string, path?: string): void {
  ctx.warnings.push({ code, message, path });
}

function contentBlocksToOpenAI(
  content: string | ContentBlock[],
  ctx: ConversionContext,
  path: string,
): string | OpenAIContentPart[] {
  if (typeof content === "string") return content;

  const parts: OpenAIContentPart[] = [];
  for (const [index, block] of content.entries()) {
    warnForBlockMetadata(block, ctx, `${path}[${index}]`);
    if (block.type === "text") {
      parts.push({ type: "text", text: block.text });
    } else if (block.type === "image") {
      const src = block.source;
      if (src.type === "base64") {
        parts.push({
          type: "image_url",
          image_url: { url: `data:${src.media_type};base64,${src.data}` },
        });
      } else {
        parts.push({ type: "image_url", image_url: { url: src.url } });
      }
    } else if (block.type === "thinking") {
      warn(
        ctx,
        "thinking_block_dropped",
        "Anthropic thinking content blocks are not forwarded to OpenAI-compatible providers.",
        `${path}[${index}]`,
      );
      // Thinking blocks are not forwarded to OpenAI-compat providers.
    } else if (block.type === "document") {
      warn(
        ctx,
        "document_block_dropped",
        "Anthropic document content blocks are not supported by OpenAI Chat Completions conversion.",
        `${path}[${index}]`,
      );
    }
  }
  return parts.length === 1 && parts[0]?.type === "text" ? (parts[0].text ?? "") : parts;
}

function messageToOpenAI(msg: Message, ctx: ConversionContext, index: number): OpenAIMessage[] {
  const content = msg.content;

  if (typeof content === "string") {
    return [{ role: msg.role, content }];
  }

  // Assistant messages with tool_use blocks need special handling
  if (msg.role === "assistant") {
    const toolCalls: OpenAIToolCall[] = [];
    const textParts: string[] = [];

    for (const [blockIndex, block] of content.entries()) {
      warnForBlockMetadata(block, ctx, `messages[${index}].content[${blockIndex}]`);
      if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input) },
        });
      } else if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "thinking") {
        warn(
          ctx,
          "thinking_block_dropped",
          "Anthropic thinking content blocks are not forwarded to OpenAI-compatible providers.",
          `messages[${index}].content[${blockIndex}]`,
        );
      }
    }

    const msg_: OpenAIMessage = {
      role: "assistant",
      content: textParts.join("") || (null as unknown as string),
    };
    if (toolCalls.length > 0) msg_.tool_calls = toolCalls;
    return [msg_];
  }

  // User messages with tool_result blocks become tool-role messages
  const toolResultMessages: OpenAIMessage[] = [];
  const otherBlocks: ContentBlock[] = [];

  for (const [blockIndex, block] of content.entries()) {
    warnForBlockMetadata(block, ctx, `messages[${index}].content[${blockIndex}]`);
    if (block.type === "tool_result") {
      const resultContent =
        typeof block.content === "string"
          ? block.content
          : (block.content as ContentBlock[])
              .filter((b) => b.type === "text")
              .map((b) => (b as { text: string }).text)
              .join("");
      toolResultMessages.push({
        role: "tool",
        tool_call_id: block.tool_use_id,
        content: resultContent,
      });
    } else {
      otherBlocks.push(block);
    }
  }

  const result: OpenAIMessage[] = [];
  if (otherBlocks.length > 0) {
    result.push({
      role: "user",
      content: contentBlocksToOpenAI(otherBlocks, ctx, `messages[${index}].content`),
    });
  }
  result.push(...toolResultMessages);
  return result;
}

export function anthropicToOpenAI(req: MessagesRequest, model: string): OpenAIChatRequest {
  return anthropicToOpenAIWithWarnings(req, model).request;
}

export function anthropicToOpenAIWithWarnings(
  req: MessagesRequest,
  model: string,
): { request: OpenAIChatRequest; warnings: ConversionWarning[] } {
  const messages: OpenAIMessage[] = [];
  const ctx: ConversionContext = { warnings: [] };

  if (req.system) {
    const systemText =
      typeof req.system === "string"
        ? req.system
        : req.system
            .map((b, index) => {
              warnForSystemBlockMetadata(b, ctx, `system[${index}]`);
              return b.text;
            })
            .join("\n");
    messages.push({ role: "system", content: systemText });
  }

  for (const [index, msg] of req.messages.entries()) {
    messages.push(...messageToOpenAI(msg, ctx, index));
  }

  const openaiReq: OpenAIChatRequest = {
    model,
    messages,
    max_tokens: req.max_tokens,
    stream: true,
  };

  if (req.temperature !== undefined) openaiReq.temperature = req.temperature;
  if (req.top_p !== undefined) openaiReq.top_p = req.top_p;
  if (req.stop_sequences?.length) openaiReq.stop = req.stop_sequences;
  if (req.top_k !== undefined) {
    warn(ctx, "top_k_dropped", "OpenAI Chat Completions has no top_k equivalent.", "top_k");
  }
  if (req.metadata !== undefined) {
    warn(
      ctx,
      "metadata_dropped",
      "Anthropic request metadata is not forwarded to OpenAI-compatible providers.",
      "metadata",
    );
  }
  if (req.thinking !== undefined) {
    warn(
      ctx,
      "thinking_request_dropped",
      "Anthropic request thinking configuration is not forwarded to OpenAI-compatible providers.",
      "thinking",
    );
  }

  if (req.tools?.length) {
    openaiReq.tools = req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));

    if (req.tool_choice) {
      if (req.tool_choice.type === "auto") openaiReq.tool_choice = "auto";
      else if (req.tool_choice.type === "any") {
        openaiReq.tool_choice = "required";
        warn(
          ctx,
          "tool_choice_any_translated",
          "Anthropic tool_choice any was translated to OpenAI required.",
          "tool_choice",
        );
      } else if (req.tool_choice.type === "tool" && req.tool_choice.name) {
        openaiReq.tool_choice = { type: "function", function: { name: req.tool_choice.name } };
      }
    }
  }

  return { request: openaiReq, warnings: dedupeWarnings(ctx.warnings) };
}

function warnForSystemBlockMetadata(
  block: { type: "text"; text: string },
  ctx: ConversionContext,
  path: string,
): void {
  if (hasCacheControlLikeMetadata(block)) {
    warn(
      ctx,
      "cache_control_metadata_dropped",
      "Anthropic cache_control-like system block metadata is not forwarded to OpenAI-compatible providers.",
      path,
    );
  }
}

function warnForBlockMetadata(block: ContentBlock, ctx: ConversionContext, path: string): void {
  if (hasCacheControlLikeMetadata(block)) {
    warn(
      ctx,
      "cache_control_metadata_dropped",
      "Anthropic cache_control-like content block metadata is not forwarded to OpenAI-compatible providers.",
      path,
    );
  }
}

function hasCacheControlLikeMetadata(value: unknown): boolean {
  return !!value && typeof value === "object" && "cache_control" in value;
}

function dedupeWarnings(warnings: ConversionWarning[]): ConversionWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.path ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
