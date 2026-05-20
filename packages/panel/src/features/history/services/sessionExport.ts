import type { Session } from "../domain/types.js";

interface SaveSessionJsonResult {
  path: string;
  bytes: number;
}

export type ExportSessionResult =
  | { target: "desktop"; path: string; bytes: number }
  | { target: "browser"; fileName: string; bytes: number };

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export async function exportSessionJson(session: Session): Promise<ExportSessionResult> {
  const fileName = `session-${session.id}.json`;
  const contents = `${JSON.stringify(session, null, 2)}\n`;
  const bytes = new TextEncoder().encode(contents).length;

  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__ != null) {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<SaveSessionJsonResult>("save_session_json", {
      fileName,
      contents,
    });
    return { target: "desktop", ...result };
  }

  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { target: "browser", fileName, bytes };
}
