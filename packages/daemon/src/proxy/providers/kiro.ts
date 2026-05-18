import { OAuthStubProvider } from "./oauth-stub.js";

export class KiroProvider extends OAuthStubProvider {
  get id() {
    return "kiro";
  }
  get label() {
    return "Kiro AI";
  }
}
