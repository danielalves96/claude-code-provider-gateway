import { http } from "../../../shared/api/http.js";

// Two-runtime control surface:
//   - dev/standalone:  shutdown via HTTP. start is impossible from the panel
//                      (daemon is the one serving us) → user re-runs CLI.
//   - Tauri shell:     both directions delegate to Rust commands that
//                      supervise the sidecar process.

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const externalDevDaemon = import.meta.env.VITE_CC_GATEWAY_EXTERNAL_DAEMON === "1";

export const runtime = {
  isTauri: (): boolean => typeof window !== "undefined" && window.__TAURI_INTERNALS__ != null,
  usesExternalDevDaemon: (): boolean => externalDevDaemon,
};

async function tauriInvoke<T>(cmd: string): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd);
}

export interface NativeDaemonStatus {
  running: boolean;
  pid: number | null;
  lastError: string | null;
}

export const daemonControl = {
  async stop(): Promise<void> {
    if (runtime.isTauri() && !runtime.usesExternalDevDaemon()) {
      await tauriInvoke<void>("stop_daemon");
      return;
    }
    await http.post("/control/shutdown");
  },

  async start(): Promise<void> {
    if (runtime.isTauri() && !runtime.usesExternalDevDaemon()) {
      await tauriInvoke<number>("start_daemon");
      return;
    }
    throw new Error("Daemon offline. In dev mode, restart via `bun dev:desk`.");
  },

  // What the supervisor knows about the sidecar. Asked only when HTTP is
  // unreachable: the webview reports that as a bare "Load failed", which says
  // nothing about *why* the daemon isn't answering.
  async nativeStatus(): Promise<NativeDaemonStatus | null> {
    if (!runtime.isTauri() || runtime.usesExternalDevDaemon()) return null;
    try {
      return await tauriInvoke<NativeDaemonStatus>("daemon_status");
    } catch {
      return null;
    }
  },

  canStartFromPanel(): boolean {
    return runtime.isTauri() && !runtime.usesExternalDevDaemon();
  },
};
