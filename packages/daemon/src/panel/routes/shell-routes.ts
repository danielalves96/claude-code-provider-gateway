import type { Hono } from "hono";
import type { ProviderId } from "../../config/schema.js";
import { CLI_FLAGS, PROVIDER_LABELS } from "../../config/schema.js";
import type {
  InstallShellSetupResponse,
  LaunchCommandsResponse,
  QuickLaunchResponse,
} from "../contracts.js";
import { prepareLaunch } from "../launch-prepare.js";
import type { PanelRuntime } from "../runtime.js";
import {
  getShellSetup,
  getSnippetForShell,
  installSnippet,
  type ShellName,
} from "../shell-setup.js";

export function registerShellRoutes(app: Hono, runtime: PanelRuntime): void {
  app.get("/api/launch-commands", (c) => {
    const config = runtime.currentConfig();
    const env = `ANTHROPIC_AUTH_TOKEN=${config.server.authToken} ANTHROPIC_BASE_URL=http://localhost:${config.server.proxyPort} CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1 claude`;
    const response = {
      manual: env,
      all: "ccpg --all",
      perProvider: buildQuickLaunchProviders(config),
    } satisfies LaunchCommandsResponse;
    return c.json(response);
  });

  app.get("/api/quick-launch", (c) => {
    const response = {
      all: "ccpg --all",
      perProvider: buildQuickLaunchProviders(runtime.currentConfig()),
    } satisfies QuickLaunchResponse;
    return c.json(response);
  });

  app.get("/api/shell-setup", (c) => c.json(getShellSetup(runtime.currentConfig())));

  app.get("/api/shell-setup/snippet/:shell", (c) => {
    const config = runtime.currentConfig();
    const shell = c.req.param("shell") as ShellName;
    if (!isShellName(shell)) {
      return c.json({ error: `Unknown shell: ${shell}` }, 400);
    }
    return c.text(`\n${getSnippetForShell(config, shell)}\n`, 200, {
      "Content-Type": "text/x-shellscript; charset=utf-8",
    });
  });

  app.post("/api/shell-setup/install", async (c) => {
    const config = runtime.currentConfig();
    const body = await c.req.json<{ shells?: unknown }>().catch(() => ({}) as { shells?: unknown });
    const requested = parseRequestedShells(body.shells);
    if (!requested.ok) return c.json({ error: requested.error }, 400);
    if (!requested.length) return c.json({ error: "shells: [] required" }, 400);
    const results = requested.shells.map((shell) => installSnippet(config, shell));
    const response = { results, setup: getShellSetup(config) } satisfies InstallShellSetupResponse;
    return c.json(response);
  });

  app.post("/api/launch/prepare", async (c) => {
    const config = runtime.currentConfig();
    const body = await c.req
      .json<{ flag?: string; format?: "shell" | "json" }>()
      .catch(() => ({}) as { flag?: string; format?: "shell" | "json" });
    const flag = body.flag ?? "";
    const format = body.format ?? "shell";
    const result = prepareLaunch(config, flag);

    if (format === "json") {
      if (result.ok) return c.json({ ok: true, ...result.envVars });
      return c.json({ ok: false, error: result.error });
    }

    const script = result.ok ? result.shellScript : `echo "ccpg: ${result.error}" >&2\nreturn 1`;
    return c.text(script, 200, { "Content-Type": "text/x-shellscript; charset=utf-8" });
  });

  app.get("/api/launch-command", (c) => {
    const config = runtime.currentConfig();
    const cmd = [
      `ANTHROPIC_AUTH_TOKEN=${config.server.authToken}`,
      `ANTHROPIC_BASE_URL=http://localhost:${config.server.proxyPort}`,
      "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1",
      "claude",
    ].join(" ");
    return c.json({ command: cmd });
  });
}

function buildQuickLaunchProviders(config: ReturnType<PanelRuntime["currentConfig"]>) {
  return (Object.entries(config.providers) as [ProviderId, (typeof config.providers)[ProviderId]][])
    .filter(([, pc]) => pc.enabled)
    .map(([id]) => ({
      id,
      label: PROVIDER_LABELS[id] ?? id,
      cli: `ccpg ${flagFor(id) ?? `--${id}`}`,
    }));
}

function flagFor(id: ProviderId): string | null {
  for (const [flag, providerId] of Object.entries(CLI_FLAGS)) {
    if (providerId === id) return flag;
  }
  return null;
}

function isShellName(value: string): value is ShellName {
  return value === "zsh" || value === "bash" || value === "fish" || value === "powershell";
}

function parseRequestedShells(
  value: unknown,
): { ok: true; shells: ShellName[]; length: number } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: "shells: [] required" };
  const shells: ShellName[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isShellName(item)) {
      return { ok: false, error: `Unknown shell: ${String(item)}` };
    }
    shells.push(item);
  }
  return { ok: true, shells, length: shells.length };
}
