declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const DEFAULT_DAEMON_PANEL_ORIGIN = "http://127.0.0.1:6767";

const externalDevDaemon = import.meta.env.VITE_CC_GATEWAY_EXTERNAL_DAEMON === "1";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && window.__TAURI_INTERNALS__ != null;
}

export function apiUrl(path: string): string {
  const apiPath = path.startsWith("/api") ? path : `/api${path}`;

  if (isTauriRuntime() && !externalDevDaemon) {
    return `${DEFAULT_DAEMON_PANEL_ORIGIN}${apiPath}`;
  }

  return apiPath;
}
