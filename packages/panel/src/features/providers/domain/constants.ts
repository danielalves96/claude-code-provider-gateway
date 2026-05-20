export const LOCAL_PROVIDERS = new Set(["ollama", "lmstudio", "llamacpp"]);
export const OAUTH_PROVIDERS = new Set([
  "openai_account",
  "copilot",
  "kiro",
  "iflow",
  "kilocode",
  "cline",
]);
export const DEVICE_FLOW_PROVIDERS = new Set(["copilot", "kilocode"]);

// Providers whose OAuth flow hasn't been implemented yet — render disabled with
// a "Coming soon" badge in the UI.
export const COMING_SOON_PROVIDERS = new Set(["kiro", "iflow"]);
