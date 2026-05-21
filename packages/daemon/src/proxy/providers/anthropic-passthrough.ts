// Native Claude model passthrough — when the user picks an "official" Claude
// model (claude-opus-*, claude-sonnet-*, claude-haiku-*), the gateway shouldn't
// try to route it to a third-party provider. Instead it forwards the request
// directly to api.anthropic.com using whatever Claude.ai credentials Claude Code
// has stored locally at ~/.claude/.credentials.json — the same auth the user
// would use if they were running plain `claude` without the gateway.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MessagesRequest, ModelInfo } from "../../core/anthropic/types.js";
import { postProviderStream } from "./api-client.js";
import { redactHeaders, type StreamResult } from "./base.js";

interface ClaudeCredentials {
  claudeAiOauth?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    subscriptionType?: string;
  };
}

const ANTHROPIC_API_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
// Claude.ai OAuth tokens require this beta header to be accepted.
const ANTHROPIC_OAUTH_BETA = "oauth-2025-04-20";

function credentialsPath(): string {
  return join(homedir(), ".claude", ".credentials.json");
}

function readCredentials(): ClaudeCredentials | null {
  const path = credentialsPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as ClaudeCredentials;
  } catch {
    return null;
  }
}

export interface AnthropicCredentialsStatus {
  available: boolean;
  expiresAt: number | null;
  subscriptionType: string | null;
}

export function getAnthropicCredentialsStatus(): AnthropicCredentialsStatus {
  const oauth = readCredentials()?.claudeAiOauth;
  return {
    available: !!oauth?.accessToken,
    expiresAt: oauth?.expiresAt ?? null,
    subscriptionType: oauth?.subscriptionType ?? null,
  };
}

const NATIVE_CLAUDE_PATTERN = /^claude-(?:3-(?:5-)?)?(?:opus|sonnet|haiku)-/i;

export function isNativeClaudeModel(model: string): boolean {
  // Reject anything with a slash (provider-prefixed routing reference).
  if (model.includes("/")) return false;
  return NATIVE_CLAUDE_PATTERN.test(model);
}

// Hardcoded list of "official" Claude tiers shown at the top of /v1/models so
// the /model picker stays faithful to the native Claude Code experience.
// Concrete dated IDs let Claude Code resolve the latest variant per tier.
export const NATIVE_CLAUDE_MODELS: ModelInfo[] = [
  {
    type: "model",
    id: "claude-opus-4-5",
    display_name: "Claude Opus 4.5",
    created_at: "2025-11-01T00:00:00Z",
  },
  {
    type: "model",
    id: "claude-sonnet-4-6",
    display_name: "Claude Sonnet 4.6",
    created_at: "2025-11-01T00:00:00Z",
  },
  {
    type: "model",
    id: "claude-haiku-4-5",
    display_name: "Claude Haiku 4.5",
    created_at: "2025-10-01T00:00:00Z",
  },
];

export async function streamAnthropicNative(
  req: MessagesRequest,
  providerModel: string,
  timeoutMs: number | undefined,
  streamIdleTimeoutMs?: number,
  streamTotalTimeoutMs?: number,
): Promise<StreamResult> {
  const oauth = readCredentials()?.claudeAiOauth;
  const token = oauth?.accessToken;
  if (!token) {
    return {
      error: {
        status: 401,
        message: "Native Claude models require Claude.ai login. Run `claude login` to enable them.",
      },
    };
  }
  if (typeof oauth?.expiresAt === "number" && Date.now() >= oauth.expiresAt) {
    return {
      error: {
        status: 401,
        message:
          "Claude.ai OAuth token expired. Open Claude Code (or run `claude login`) to refresh.",
      },
    };
  }

  // Same defensive body construction as copilot's native path: only forward
  // fields we know upstream accepts; drop unknown ones (output_config etc.)
  // that newer Claude Code versions may emit.
  const body: Record<string, unknown> = {
    model: providerModel,
    messages: req.messages,
    max_tokens: req.max_tokens,
    stream: true,
  };
  if (req.system !== undefined) body.system = req.system;
  if (req.tools !== undefined) body.tools = req.tools;
  if (req.tool_choice !== undefined) body.tool_choice = req.tool_choice;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.top_p !== undefined) body.top_p = req.top_p;
  if (req.top_k !== undefined) body.top_k = req.top_k;
  if (req.thinking !== undefined) body.thinking = req.thinking;
  if (req.metadata !== undefined) body.metadata = req.metadata;
  if (req.stop_sequences !== undefined) body.stop_sequences = req.stop_sequences;

  const url = `${ANTHROPIC_API_URL}/v1/messages`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    Authorization: `Bearer ${token}`,
    "anthropic-version": ANTHROPIC_VERSION,
    "anthropic-beta": ANTHROPIC_OAUTH_BETA,
  };
  const result = await postProviderStream({
    url,
    headers,
    body,
    timeoutMs,
    streamIdleTimeoutMs,
    streamTotalTimeoutMs,
  });

  if ("error" in result) {
    return {
      error: result.error,
      requestPreview: {
        transport: "anthropic_native",
        method: "POST",
        url,
        headers: redactHeaders(headers),
        body,
      },
    };
  }

  // Anthropic's SSE format is already what Claude Code expects — pipe through.
  const decoder = new TextDecoder();
  const stream = new ReadableStream<string>({
    async start(controller) {
      const reader = result.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(decoder.decode(value, { stream: true }));
        }
      } finally {
        controller.close();
      }
    },
  });

  return {
    stream,
    requestPreview: {
      transport: "anthropic_native",
      method: "POST",
      url,
      headers: redactHeaders(headers),
      body,
    },
  };
}
