import type { Server } from "node:http";
import type { OAuthFlow, PanelRuntime } from "../../runtime.js";

export function cleanupOAuthFlows(runtime: PanelRuntime): void {
  for (const [state, flow] of runtime.oauthFlows) {
    if (flow.status === "pending") continue;
    if (flow.timer) clearTimeout(flow.timer);
    flow.server?.close();
    runtime.oauthFlows.delete(state);
  }
}

export async function listenOnLocalhost(
  server: Server,
  port: number,
  providerLabel: string,
): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        server.off("listening", onListening);
        reject(err);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    });
  } catch (err) {
    throw describeCallbackServerListenError(err, providerLabel, port);
  }
}

export function timeoutBrowserOAuthFlow(
  runtime: PanelRuntime,
  state: string,
  providerLabel: string,
): void {
  const current = runtime.oauthFlows.get(state);
  if (current?.status === "pending") {
    current.status = "error";
    current.error = `${providerLabel} login timed out`;
  }
  current?.server?.close();
}

function describeCallbackServerListenError(
  err: unknown,
  providerLabel: string,
  port: number,
): Error {
  if (isNodeError(err) && err.code === "EADDRINUSE") {
    return new Error(
      `${providerLabel} OAuth callback port ${port} is already in use. Close the other process using 127.0.0.1:${port} and try logging in again.`,
    );
  }

  return err instanceof Error ? err : new Error(String(err));
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

export type { OAuthFlow };
