// KiloCode OAuth — custom device-auth flow.
// POST /api/device-auth/codes → returns { code, verificationUrl, expiresIn }
// Poll GET  /api/device-auth/codes/{code} → 202 pending, 200 { status, token, userEmail }
// On success, fetch /api/profile to obtain orgId (sent later as X-Kilocode-OrganizationID).

import type { ProviderOAuthConfig } from "../../config/schema.js";

export const KILOCODE_API_BASE = "https://api.kilo.ai";
export const KILOCODE_INITIATE_URL = `${KILOCODE_API_BASE}/api/device-auth/codes`;
export const KILOCODE_POLL_URL_BASE = `${KILOCODE_API_BASE}/api/device-auth/codes`;
export const KILOCODE_PROFILE_URL = `${KILOCODE_API_BASE}/api/profile`;

export interface KiloCodeDeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export type KiloCodePollResult =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "denied" }
  | { status: "error"; error: string }
  | { status: "success"; token: string; userEmail?: string };

export async function startKiloCodeDeviceFlow(): Promise<KiloCodeDeviceCode> {
  const response = await fetch(KILOCODE_INITIATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Too many pending authorization requests. Please try again later.");
    }
    const text = await response.text().catch(() => "");
    throw new Error(
      `KiloCode device auth initiation failed: HTTP ${response.status} ${text.slice(0, 200)}`,
    );
  }
  const data = (await response.json()) as {
    code?: string;
    verificationUrl?: string;
    expiresIn?: number;
  };
  if (!data.code || !data.verificationUrl) {
    throw new Error("KiloCode device code response missing required fields");
  }
  return {
    device_code: data.code,
    user_code: data.code,
    verification_uri: data.verificationUrl,
    expires_in: data.expiresIn ?? 300,
    interval: 3,
  };
}

export async function pollKiloCodeDeviceFlow(deviceCode: string): Promise<KiloCodePollResult> {
  const response = await fetch(`${KILOCODE_POLL_URL_BASE}/${deviceCode}`);
  if (response.status === 202) return { status: "pending" };
  if (response.status === 403) return { status: "denied" };
  if (response.status === 410) return { status: "expired" };
  if (!response.ok) {
    return { status: "error", error: `Poll failed: HTTP ${response.status}` };
  }
  const data = (await response.json()) as {
    status?: string;
    token?: string;
    userEmail?: string;
  };
  if (data.status === "approved" && data.token) {
    return { status: "success", token: data.token, userEmail: data.userEmail };
  }
  if (data.status === "denied") return { status: "denied" };
  if (data.status === "expired") return { status: "expired" };
  return { status: "pending" };
}

export async function fetchKiloCodeOrgId(token: string): Promise<string | undefined> {
  try {
    const response = await fetch(KILOCODE_PROFILE_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as {
      organizations?: Array<{ id?: string }>;
    };
    return data.organizations?.[0]?.id ?? undefined;
  } catch {
    return undefined;
  }
}

export function isKiloCodeLoggedIn(oauth: ProviderOAuthConfig | undefined): boolean {
  return !!oauth?.accessToken;
}
