import { OpenAIChatTransport } from "./transport-openai.js";

export class KiloCodeProvider extends OpenAIChatTransport {
  get id() {
    return "kilocode";
  }
  get label() {
    return "Kilo Code";
  }

  // OAuth-only: treat the access token as the credential so the transport's
  // standard "missing credential" path fires when the user isn't logged in.
  protected override hasApiKey(): boolean {
    return !!this.config.oauth?.accessToken;
  }

  protected override missingApiKeyMessage(): string {
    return `${this.label} is not logged in. Sign in via the Providers page before using ${this.id}.`;
  }

  protected override authHeader(): string {
    return `Bearer ${this.config.oauth?.accessToken ?? ""}`;
  }

  protected override extraHeaders(): Record<string, string> {
    const orgId = this.config.oauth?.orgId;
    return orgId ? { "X-Kilocode-OrganizationID": orgId } : {};
  }

  protected override baseUrl(): string {
    return (this.config.baseUrl ?? "https://api.kilo.ai/api/openrouter").replace(/\/$/, "");
  }
}
