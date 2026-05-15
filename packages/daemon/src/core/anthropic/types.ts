// Anthropic Messages API — request/response types

export type Role = "user" | "assistant";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  source: { type: "base64"; media_type: string; data: string } | { type: "url"; url: string };
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

export interface ThinkingContent {
  type: "thinking";
  thinking: string;
}

export interface DocumentContent {
  type: "document";
  source: { type: "base64"; media_type: string; data: string } | { type: "text"; text: string };
  title?: string;
}

export type ContentBlock =
  | TextContent
  | ImageContent
  | ToolUseContent
  | ToolResultContent
  | ThinkingContent
  | DocumentContent;

export interface Message {
  role: Role;
  content: string | ContentBlock[];
}

export interface Tool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface ThinkingConfig {
  type: "enabled";
  budget_tokens: number;
}

export interface MessagesRequest {
  model: string;
  messages: Message[];
  max_tokens: number;
  system?: string | Array<{ type: "text"; text: string }>;
  tools?: Tool[];
  tool_choice?: { type: "auto" | "any" | "tool"; name?: string };
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  thinking?: ThinkingConfig;
  metadata?: { user_id?: string };
  stop_sequences?: string[];
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface MessagesResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
  stop_sequence: string | null;
  usage: Usage;
}

export interface CountTokensRequest {
  model: string;
  messages: Message[];
  system?: string | Array<{ type: "text"; text: string }>;
  tools?: Tool[];
  thinking?: ThinkingConfig;
}

export interface CountTokensResponse {
  input_tokens: number;
}

export interface ModelInfo {
  type: "model";
  id: string;
  display_name: string;
  created_at: string;
}

export interface ModelsListResponse {
  data: ModelInfo[];
  has_more: boolean;
  first_id: string | null;
  last_id: string | null;
}
