import type { ContentBlock, MessagesRequest } from "../../core/anthropic/types.js";
import { getCodexInstructions, getReasoningEffort } from "./openai-account-catalog.js";

export interface ResponsesRequest {
  model: string;
  input: ResponsesInputItem[];
  instructions: string;
  stream: true;
  temperature?: number;
  top_p?: number;
  tools?: ResponsesTool[];
  tool_choice?: "auto" | "required" | { type: "function"; name: string };
  store: false;
  reasoning: { effort: "low" | "medium" | "high" | "xhigh"; summary: "auto" };
  text: { verbosity: "medium" };
  include: string[];
}

type ResponsesInputItem =
  | { type: "message"; role: "developer" | "user" | "assistant"; content: ResponsesContentPart[] }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };

type ResponsesContentPart =
  | { type: "input_text"; text: string }
  | { type: "output_text"; text: string }
  | { type: "input_image"; image_url: string };

interface ResponsesTool {
  type: "function";
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export async function buildOpenAIAccountResponsesRequest(
  req: MessagesRequest,
  model: string,
): Promise<ResponsesRequest> {
  const body: ResponsesRequest = {
    model,
    input: toResponsesInput(req),
    instructions: await getCodexInstructions(model),
    stream: true,
    store: false,
    reasoning: { effort: await getReasoningEffort(model), summary: "auto" },
    text: { verbosity: "medium" },
    include: ["reasoning.encrypted_content"],
  };

  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.top_p !== undefined) body.top_p = req.top_p;
  if (req.tools?.length) applyTools(req, body);

  return body;
}

function toResponsesInput(req: MessagesRequest): ResponsesInputItem[] {
  const input: ResponsesInputItem[] = [];
  const system =
    typeof req.system === "string" ? req.system : req.system?.map((part) => part.text).join("\n");

  if (system) {
    input.push({
      type: "message",
      role: "developer",
      content: [{ type: "input_text", text: system }],
    });
  }

  for (const message of req.messages) {
    if (typeof message.content === "string") {
      input.push({
        type: "message",
        role: message.role,
        content: [
          {
            type: message.role === "assistant" ? "output_text" : "input_text",
            text: message.content,
          },
        ],
      });
      continue;
    }

    if (message.role === "assistant") {
      pushAssistantContent(input, message.content);
      continue;
    }

    pushUserContent(input, message.content);
  }

  return input;
}

function pushAssistantContent(input: ResponsesInputItem[], content: ContentBlock[]): void {
  const text = content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (text)
    input.push({ type: "message", role: "assistant", content: [{ type: "output_text", text }] });

  for (const block of content) {
    if (block.type === "tool_use") {
      input.push({
        type: "function_call",
        call_id: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input),
      });
    }
  }
}

function pushUserContent(input: ResponsesInputItem[], content: ContentBlock[]): void {
  const contentParts = userContentToResponses(content);
  if (contentParts.length) input.push({ type: "message", role: "user", content: contentParts });

  for (const block of content) {
    if (block.type === "tool_result") {
      input.push({
        type: "function_call_output",
        call_id: block.tool_use_id,
        output: toolResultText(block.content),
      });
    }
  }
}

function userContentToResponses(content: ContentBlock[]): ResponsesContentPart[] {
  const parts: ResponsesContentPart[] = [];
  for (const block of content) {
    if (block.type === "text") parts.push({ type: "input_text", text: block.text });
    if (block.type === "image") {
      const imageUrl =
        block.source.type === "base64"
          ? `data:${block.source.media_type};base64,${block.source.data}`
          : block.source.url;
      parts.push({ type: "input_image", image_url: imageUrl });
    }
    if (block.type === "document" && block.source.type === "text") {
      parts.push({ type: "input_text", text: block.source.text });
    }
  }
  return parts;
}

function applyTools(req: MessagesRequest, body: ResponsesRequest): void {
  body.tools = req.tools!.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  }));

  if (req.tool_choice?.type === "auto") body.tool_choice = "auto";
  if (req.tool_choice?.type === "any") body.tool_choice = "required";
  if (req.tool_choice?.type === "tool" && req.tool_choice.name) {
    body.tool_choice = { type: "function", name: req.tool_choice.name };
  }
}

function toolResultText(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}
