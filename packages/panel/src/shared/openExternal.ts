import { invoke } from "@tauri-apps/api/core";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const ALLOWED_SCHEMES = ["http:", "https:"];

export function openExternal(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) return;

  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__ == null) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  void invoke("open_url", { url });
}
