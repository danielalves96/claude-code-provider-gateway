import { serve } from "@hono/node-server";
import type { Hono } from "hono";
import type { Config } from "../config/schema.js";
import { logger } from "../observability/log.js";
import { createPanelApp } from "../panel/app.js";
import { createProxyApp } from "../proxy/app.js";
import { removePid, writePid } from "./process.js";
import { endAllSessions } from "./sessions.js";

type ManagedServer = ReturnType<typeof serve> & {
  closeAllConnections: () => void;
};

type ServiceName = "proxy" | "panel";

interface ServerBinding {
  name: ServiceName;
  port: number;
  app: Hono;
  onReady?: () => void;
}

export function startDaemon(config: Config): void {
  const runtime = new DaemonRuntime(config);
  runtime.start();
}

class DaemonRuntime {
  private readonly ready = new Set<ServiceName>();
  private servers: ManagedServer[] = [];

  constructor(private readonly config: Config) {}

  start(): void {
    this.servers = [
      this.bind({
        name: "proxy",
        port: this.config.server.proxyPort,
        app: createProxyApp(this.config),
      }),
      this.bind({
        name: "panel",
        port: this.config.server.panelPort,
        app: createPanelApp(this.config),
        onReady: () => {
          const panelPort =
            process.env.NODE_ENV !== "production" ? 5173 : this.config.server.panelPort;
          logger.info("panel", `http://localhost:${panelPort}`);
        },
      }),
    ];

    process.on("SIGINT", () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());
  }

  private bind(binding: ServerBinding): ManagedServer {
    // Local-first: loopback only. The Tauri webview and dev tooling both
    // live on the host machine; nothing legitimate connects from outside.
    const server = serve(
      { fetch: binding.app.fetch, port: binding.port, hostname: "127.0.0.1" },
      () => {
        logger.info(binding.name, `listening on 127.0.0.1:${binding.port}`);
        binding.onReady?.();
        this.markReady(binding.name);
      },
    ) as ManagedServer;

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        logger.error(binding.name, `port ${binding.port} already in use`);
        process.exit(1);
      }
      logger.error(binding.name, err.message);
    });

    return server;
  }

  private markReady(name: ServiceName): void {
    this.ready.add(name);
    if (this.ready.size !== 2) return;
    writePid(process.pid);
  }

  private shutdown(): void {
    endAllSessions();
    removePid();

    for (const server of this.servers) {
      server.closeAllConnections();
      server.close();
    }

    process.exit(0);
  }
}
