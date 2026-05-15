export interface SecretStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
  keys(): string[];
}

// Dotted paths used as keys, scoped by domain so collisions are impossible.
// Examples:
//   server.authToken
//   provider.openrouter.apiKey
//   provider.openai_account.oauth.accessToken
export const SECRET_KEYS = {
  serverAuthToken: "server.authToken",
  providerApiKey: (id: string) => `provider.${id}.apiKey`,
  providerOAuthAccessToken: (id: string) => `provider.${id}.oauth.accessToken`,
  providerOAuthRefreshToken: (id: string) => `provider.${id}.oauth.refreshToken`,
  providerOAuthCopilotToken: (id: string) => `provider.${id}.oauth.copilotToken`,
} as const;
