import type { MessagesRequest, ModelInfo } from "../../core/anthropic/types.js";
import type { StreamResult } from "./base.js";
import { BaseProvider } from "./base.js";

// Placeholder for OAuth providers whose flow has not been ported yet.
// Shows up in the UI under "OAuth Providers" but rejects requests with a
// clear "not implemented" message instead of crashing.
export abstract class OAuthStubProvider extends BaseProvider {
  protected override requiresApiKey(): boolean {
    return false;
  }

  async streamResponse(_req: MessagesRequest, _inputTokens: number): Promise<StreamResult> {
    return {
      error: {
        status: 501,
        message: `${this.label} OAuth flow is not yet implemented. Use a different provider for now.`,
      },
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [];
  }
}
