import type { ProviderOAuthConfig } from "../../config/schema.js";

export const CLINE_API_BASE = "https://api.cline.bot";
export const CLINE_AUTHORIZE_URL = `${CLINE_API_BASE}/api/v1/auth/authorize`;
export const CLINE_TOKEN_URL = `${CLINE_API_BASE}/api/v1/auth/token`;
export const CLINE_REFRESH_URL = `${CLINE_API_BASE}/api/v1/auth/refresh`;
export const CLINE_REDIRECT_URI = "http://localhost:1456/auth/callback";

const CLINE_CLIENT_VERSION = "0.1.3";

export interface ClineTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId?: string;
  firstName?: string;
  lastName?: string;
}

export function createClineAuthorizationUrl(state: string): string {
  const url = new URL(CLINE_AUTHORIZE_URL);
  url.searchParams.set("client_type", "extension");
  url.searchParams.set("callback_url", CLINE_REDIRECT_URI);
  url.searchParams.set("redirect_uri", CLINE_REDIRECT_URI);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeClineAuthorizationCode(code: string): Promise<ClineTokenResult> {
  const response = await fetch(CLINE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_type: "extension",
      redirect_uri: CLINE_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    throw new Error(`Cline token exchange failed: HTTP ${response.status} ${error.slice(0, 300)}`);
  }

  return mapClineTokenPayload(await response.json());
}

export async function refreshClineAccessToken(refreshToken: string): Promise<ClineTokenResult> {
  const response = await fetch(CLINE_REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      refreshToken,
      grantType: "refresh_token",
      clientType: "extension",
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    throw new Error(`Cline token refresh failed: HTTP ${response.status} ${error.slice(0, 300)}`);
  }

  return mapClineTokenPayload(await response.json(), refreshToken);
}

export function isClineLoggedIn(oauth: ProviderOAuthConfig | undefined): boolean {
  return !!oauth?.accessToken;
}

export function shouldRefreshClineToken(oauth: ProviderOAuthConfig | undefined): boolean {
  if (!oauth?.accessToken || !oauth.refreshToken) return false;
  if (!oauth.expiresAt) return false;
  return oauth.expiresAt - Date.now() < 5 * 60 * 1000;
}

export function buildClineHeaders(token: string | undefined): Record<string, string> {
  const authorization = getClineAuthorizationHeader(token);
  return {
    "HTTP-Referer": "https://cline.bot",
    "X-Title": "Cline",
    "User-Agent": `CCProviderGateway/${CLINE_CLIENT_VERSION}`,
    "X-PLATFORM": process.platform || "unknown",
    "X-PLATFORM-VERSION": process.version || "unknown",
    "X-CLIENT-TYPE": "cc-provider-gtw",
    "X-CLIENT-VERSION": CLINE_CLIENT_VERSION,
    "X-CORE-VERSION": CLINE_CLIENT_VERSION,
    "X-IS-MULTIROOT": "false",
    ...(authorization ? { Authorization: authorization } : {}),
  };
}

function getClineAuthorizationHeader(token: string | undefined): string {
  const accessToken = getClineAccessToken(token);
  return accessToken ? `Bearer ${accessToken}` : "";
}

function getClineAccessToken(token: string | undefined): string {
  const trimmed = token?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.startsWith("workos:") ? trimmed : `workos:${trimmed}`;
}

function mapClineTokenPayload(raw: unknown, fallbackRefreshToken?: string): ClineTokenResult {
  const root = asRecord(raw) ?? {};
  const data = asRecord(root.data) ?? root;
  const userInfo = asRecord(data.userInfo);
  const accessToken = stringValue(data.accessToken) ?? stringValue(data.access_token);
  if (!accessToken) throw new Error("Cline token response did not include accessToken");

  const refreshToken =
    stringValue(data.refreshToken) ?? stringValue(data.refresh_token) ?? fallbackRefreshToken;
  const email = stringValue(data.email) ?? stringValue(userInfo?.email);
  const expiresAtIso = stringValue(data.expiresAt) ?? stringValue(data.expires_at);

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAtIso ? new Date(expiresAtIso).getTime() : undefined,
    accountId: email,
    firstName: stringValue(data.firstName) ?? stringValue(userInfo?.firstName),
    lastName: stringValue(data.lastName) ?? stringValue(userInfo?.lastName),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
