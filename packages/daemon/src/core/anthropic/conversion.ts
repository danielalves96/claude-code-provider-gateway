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

function contentBlocksToOpenAI(content: string | ContentBlock[]): string | OpenAIContentPart[] {
  if (typeof content === "string") return content;

  const parts: OpenAIContentPart[] = [];
  for (const block of content) {
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
      // Thinking blocks are not forwarded to OpenAI-compat providers
    }
  }
  return parts.length === 1 && parts[0]?.type === "text" ? (parts[0].text ?? "") : parts;
}

function messageToOpenAI(msg: Message): OpenAIMessage[] {
  const content = msg.content;

  if (typeof content === "string") {
    return [{ role: msg.role, content }];
  }

  // Assistant messages with tool_use blocks need special handling
  if (msg.role === "assistant") {
    const toolCalls: OpenAIToolCall[] = [];
    const textParts: string[] = [];

    for (const block of content) {
      if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input) },
        });
      } else if (block.type === "text") {
        textParts.push(block.text);
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

  for (const block of content) {
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
    result.push({ role: "user", content: contentBlocksToOpenAI(otherBlocks) });
  }
  result.push(...toolResultMessages);
  return result;
}

export function anthropicToOpenAI(req: MessagesRequest, model: string): OpenAIChatRequest {
  const messages: OpenAIMessage[] = [];

  if (req.system) {
    const systemText =
      typeof req.system === "string" ? req.system : req.system.map((b) => b.text).join("\n");
    messages.push({ role: "system", content: systemText });
  }

  for (const msg of req.messages) {
    messages.push(...messageToOpenAI(msg));
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

  if (req.tools?.length) {
    openaiReq.tools = req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));

    if (req.tool_choice) {
      if (req.tool_choice.type === "auto") openaiReq.tool_choice = "auto";
      else if (req.tool_choice.type === "any") openaiReq.tool_choice = "required";
      else if (req.tool_choice.type === "tool" && req.tool_choice.name) {
        openaiReq.tool_choice = { type: "function", function: { name: req.tool_choice.name } };
      }
    }
  }

  return openaiReq;
}
