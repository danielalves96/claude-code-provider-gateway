import type { ContentBlock, MessagesRequest } from "../../core/anthropic/types.js";

const PROMPT_SYSTEM_MAX_FIRST = 80000;
const PROMPT_SYSTEM_MAX_REPEAT = 4000;
const PROMPT_TOTAL_MAX = 300000;

export function serializePrompt(req: MessagesRequest, first: boolean): string {
  const systemMax = first ? PROMPT_SYSTEM_MAX_FIRST : PROMPT_SYSTEM_MAX_REPEAT;
  const parts: string[] = [];

  const system = serializeSystemPrompt(req, systemMax);
  if (system) parts.push(`[System]\n${system}`);

  for (const msg of req.messages) {
    const content = serializeMessageContent(msg.content);
    if (content) parts.push(`[${msg.role}]\n${content}`);
  }

  return parts.join("\n\n").slice(0, PROMPT_TOTAL_MAX);
}

function serializeSystemPrompt(req: MessagesRequest, maxLength: number): string {
  if (!req.system) return "";
  const text =
    typeof req.system === "string"
      ? req.system
      : req.system
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n");

  return truncate(text, maxLength);
}

function serializeMessageContent(content: MessagesRequest["messages"][number]["content"]): string {
  if (typeof content === "string") return content;
  return (content as ContentBlock[])
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("\n");
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}
