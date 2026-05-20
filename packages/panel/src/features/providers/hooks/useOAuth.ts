import { useCallback, useEffect, useRef, useState } from "react";
import { openExternal } from "../../../shared/openExternal.js";
import { DEVICE_FLOW_PROVIDERS } from "../domain/constants.js";
import type { CopilotFlow } from "../domain/types.js";
import { providersService } from "../services/providersService.js";

const BROWSER_FLOW_TIMEOUT_MS = 5 * 60 * 1000;
const BROWSER_FLOW_POLL_MS = 1200;
const DEVICE_FLOW_POLL_MS = 2000;

interface UseOAuthOptions {
  onSuccess: () => void;
}

export function useOAuth({ onSuccess }: UseOAuthOptions) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copilotFlow, setCopilotFlow] = useState<CopilotFlow | null>(null);
  const pollRef = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => clearPoll, [clearPoll]);

  const reset = useCallback(() => {
    clearPoll();
    setBusy(null);
    setCopilotFlow(null);
  }, [clearPoll]);

  const pollUntilDone = useCallback(
    (id: string, key: string, deadline: number, intervalMs: number, onResolved: () => void) => {
      clearPoll();
      pollRef.current = window.setInterval(async () => {
        try {
          const result = await providersService.oauthStatus(id, key);
          if (result.status === "success") {
            clearPoll();
            onResolved();
            onSuccess();
            return;
          }
          const expired = Date.now() > deadline;
          if (result.status === "error" || result.status === "unknown" || expired) {
            clearPoll();
            onResolved();
            setError(
              result.error ?? (expired ? "Device code expired" : "Login failed or timed out"),
            );
          }
        } catch {
          clearPoll();
          onResolved();
          setError("Could not check login status");
        }
      }, intervalMs);
    },
    [clearPoll, onSuccess],
  );

  const startDeviceFlow = useCallback(
    async (id: string) => {
      setBusy(id);
      setError(null);
      try {
        const flow = await providersService.oauthStartDeviceFlow(id);
        setCopilotFlow(flow);
        openExternal(flow.verificationUri);
        pollUntilDone(id, flow.flowId, flow.expiresAt, DEVICE_FLOW_POLL_MS, () => {
          setBusy(null);
          setCopilotFlow(null);
        });
      } catch (err) {
        setBusy(null);
        setCopilotFlow(null);
        setError(err instanceof Error ? err.message : "GitHub login failed");
      }
    },
    [pollUntilDone],
  );

  const startBrowserFlow = useCallback(
    async (id: string) => {
      setBusy(id);
      setError(null);
      try {
        const flow = await providersService.oauthStart(id);
        openExternal(flow.url);
        const deadline = Date.now() + BROWSER_FLOW_TIMEOUT_MS;
        pollUntilDone(id, flow.state, deadline, BROWSER_FLOW_POLL_MS, () => {
          setBusy(null);
        });
      } catch (err) {
        setBusy(null);
        setError(err instanceof Error ? err.message : "Login failed");
      }
    },
    [pollUntilDone],
  );

  const start = useCallback(
    (id: string) => (DEVICE_FLOW_PROVIDERS.has(id) ? startDeviceFlow(id) : startBrowserFlow(id)),
    [startDeviceFlow, startBrowserFlow],
  );

  const logout = useCallback(
    async (id: string) => {
      await providersService.oauthLogout(id);
      onSuccess();
    },
    [onSuccess],
  );

  return {
    busy,
    error,
    copilotFlow,
    start,
    cancel: reset,
    logout,
  };
}
