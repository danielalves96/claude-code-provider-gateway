import { OAuthStubProvider } from "./oauth-stub.js";

export class IFlowProvider extends OAuthStubProvider {
  get id() {
    return "iflow";
  }
  get label() {
    return "iFlow AI";
  }
}
