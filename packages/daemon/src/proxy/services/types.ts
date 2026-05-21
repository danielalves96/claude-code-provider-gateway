import type { AnthropicErrorResponse, ErrorStatus } from "../errors.js";

export type MessageServiceResult =
  | {
      kind: "stream";
      status: 200;
      stream: ReadableStream<string>;
      headers: HeadersInit;
    }
  | {
      kind: "error";
      status: ErrorStatus;
      body: AnthropicErrorResponse;
    };
