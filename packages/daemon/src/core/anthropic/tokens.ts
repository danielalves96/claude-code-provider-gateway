import { getEncoding } from "js-tiktoken";
import type { ContentBlock, Message, MessagesRequest } from "./types.js";

// cl100k_base covers GPT-4 / Claude-compatible token counting
const enc = getEncoding("cl100k_base");

function countText(text: string): number {
  return enc.encode(text).length;
}

function countContent(content: string | ContentBlock[]): number {
  if (typeof content === "string") return countText(content);
  let total = 0;
  for (const block of content) {
    if (block.type === "text") total += countText(block.text);
    else if (block.type === "thinking") total += countText(block.thinking);
    else if (block.type === "tool_use") total += countText(JSON.stringify(block.input));
    else if (block.type === "tool_result") {
      if (typeof block.content === "string") total += countText(block.content);
      else total += countContent(block.content);
    }
  }
  return total;
}

function countMessage(msg: Message): number {
  return 4 + countContent(msg.content); // 4 tokens overhead per message
}

export function countRequestTokens(req: MessagesRequest): number {
  let total = 0;

  if (req.system) {
    const text =
      typeof req.system === "string" ? req.system : req.system.map((b) => b.text).join("");
    total += countText(text) + 4;
  }

  for (const msg of req.messages) {
    total += countMessage(msg);
  }

  if (req.tools?.length) {
    total += countText(JSON.stringify(req.tools)) + 4;
  }

  return total;
}
