import { invoke } from "@tauri-apps/api/core";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function openExternal(url: string): void {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__ == null) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  void invoke("open_url", { url });
}
