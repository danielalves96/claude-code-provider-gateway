import { OpenAIChatTransport } from "./transport-openai.js";

export class GroqProvider extends OpenAIChatTransport {
  get id() {
    return "groq";
  }
  get label() {
    return "Groq";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "groq") return parts.slice(1).join("/");
    return requestedModel;
  }
}
