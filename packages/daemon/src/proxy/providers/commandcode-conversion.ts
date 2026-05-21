import { randomUUID } from "node:crypto";
import type { ContentBlock, Message, MessagesRequest } from "../../core/anthropic/types.js";
import { stripCommandCodeModelPrefix } from "./commandcode-models.js";

export type CommandCodeContentBlock =
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

export interface CommandCodeMessage {
  role: "user" | "assistant" | "tool";
  content: string | CommandCodeContentBlock[];
}

export interface CommandCodeRequest {
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
      workingDir: "<workspace>",
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

async function convertMessages(messages: Message[]): Promise<CommandCodeMessage[]> {
  const out: CommandCodeMessage[] = [];
  const toolNames = buildToolNameMap(messages);

  for (const message of messages) {
    if (typeof message.content === "string") {
      out.push({ role: message.role, content: message.content });
      continue;
    }

    if (message.role === "user") {
      let nonToolBlocks: CommandCodeContentBlock[] = [];
      let hasAny = false;

      for (const block of message.content) {
        if (block.type === "tool_result") {
          if (nonToolBlocks.length) {
            out.push({ role: "user", content: collapseTextContent(nonToolBlocks) });
            nonToolBlocks = [];
          }
          const toolResult = await convertToolResultBlock(block, toolNames);
          out.push({ role: "tool", content: [toolResult] });
          hasAny = true;
        } else {
          const converted = await convertContentBlock(block);
          nonToolBlocks.push(...converted);
          hasAny = true;
        }
      }

      if (nonToolBlocks.length) {
        out.push({ role: "user", content: collapseTextContent(nonToolBlocks) });
      } else if (!hasAny) {
        out.push({ role: "user", content: "" });
      }
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
