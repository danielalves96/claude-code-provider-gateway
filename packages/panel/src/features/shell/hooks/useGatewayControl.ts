import type { MessageInstance } from "antd/es/message/interface.js";
import { useRef, useState } from "react";
import { daemonControl } from "../services/daemonControl.js";
import { type DaemonState, useDaemonStatus } from "./useDaemonStatus.js";

export const STATE_LABEL: Record<DaemonState, string> = {
  running: "Gateway running",
  offline: "Gateway stopped",
  unknown: "Checking...",
};

export const STATE_BADGE: Record<DaemonState, "success" | "error" | "processing"> = {
  running: "success",
  offline: "error",
  unknown: "processing",
};

interface UseGatewayControlOptions {
  message: MessageInstance;
}

export function useGatewayControl({ message }: UseGatewayControlOptions) {
  const { state, refresh, pause, resume } = useDaemonStatus();
  const [busy, setBusy] = useState(false);
  const lifecycleLocked = useRef(false);

  async function stop(): Promise<void> {
    if (lifecycleLocked.current) {
      return;
    }
    lifecycleLocked.current = true;
    setBusy(true);
    pause();
    try {
      await daemonControl.stop();
      message.success("Stop signal sent");
      setTimeout(() => {
        void refresh();
        resume();
      }, 500);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to stop gateway");
      resume();
    } finally {
      lifecycleLocked.current = false;
      setBusy(false);
    }
  }

  async function start(): Promise<void> {
    if (lifecycleLocked.current) {
      return;
    }
    lifecycleLocked.current = true;
    setBusy(true);
    try {
      await daemonControl.start();
      message.success("Gateway started");
      setTimeout(() => void refresh(), 500);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to start gateway");
    } finally {
      lifecycleLocked.current = false;
      setBusy(false);
    }
  }

  return {
    state,
    busy,
    isRunning: state === "running",
    canStartFromPanel: daemonControl.canStartFromPanel(),
    start,
    stop,
  };
}
