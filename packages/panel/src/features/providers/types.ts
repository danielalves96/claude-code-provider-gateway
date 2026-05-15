import type {
  CopilotOAuthStartResponse,
  ModelInfo,
  OAuthInfo,
  OAuthStatusResponse,
  OpenAIAccountOAuthStartResponse,
  ProviderInfo,
  ProviderTestResult,
} from "../../../../daemon/src/panel/contracts.js";

export type { ModelInfo, OAuthInfo, OAuthStatusResponse, ProviderInfo };

export type TestResult = ProviderTestResult;

export type ConfirmAction =
  | { kind: "replace-key"; providerId: string; newValue: string }
  | { kind: "remove-key"; providerId: string }
  | { kind: "change-url"; providerId: string; newValue: string };

export type CopilotFlow = CopilotOAuthStartResponse;
export type OAuthStartResponse = OpenAIAccountOAuthStartResponse;
