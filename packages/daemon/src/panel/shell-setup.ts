// Shell-setup feature: detect installed shells, ship a snippet the user
// pastes into their rc file, expose a "prepare launch" endpoint the snippet
// calls at runtime.

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import type { Config } from "../config/schema.js";

const SNIPPET_SENTINEL = "# >>> claude-code-provider-gateway setup >>>";
const SNIPPET_END = "# <<< claude-code-provider-gateway setup <<<";
const SHELL_COMMAND = "ccpg";

export type ShellName = "zsh" | "bash" | "fish" | "powershell";

export interface ShellInfo {
  name: ShellName;
  rcPath: string;
  rcExists: boolean;
  installed: boolean;
}

export interface ShellSetupResponse {
  shells: ShellInfo[];
  currentShell: ShellName | null;
  snippets: Record<"posix" | "fish" | "powershell", string>;
  usage: string;
}

const SHELL_RC_PATHS: Record<ShellName, () => string> = {
  zsh: () => join(homedir(), ".zshrc"),
  bash: () => join(homedir(), ".bashrc"),
  fish: () => join(homedir(), ".config", "fish", "config.fish"),
  powershell: getPowerShellProfilePath,
};

function isShellInstalled(shell: ShellName): boolean {
  if (shell === "powershell") {
    if (platform() === "win32") return true;
    return whichSync("pwsh") !== null;
  }
  return whichSync(shell) !== null;
}

function whichSync(cmd: string): string | null {
  const isWin = platform() === "win32";
  const result = spawnSync(isWin ? "where" : "which", [cmd], { stdio: "pipe", encoding: "utf-8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function getShellSetup(config: Config): ShellSetupResponse {
  const shells: ShellInfo[] = (["zsh", "bash", "fish", "powershell"] as ShellName[])
    .filter(isShellInstalled)
    .map((name) => {
      const rcPath = SHELL_RC_PATHS[name]();
      const rcExists = existsSync(rcPath);
      const desired = getSnippetForShell(config, name);
      return {
        name,
        rcPath,
        rcExists,
        installed: rcExists && rcContainsCurrentSnippet(rcPath, desired),
      };
    });

  return {
    shells,
    currentShell: detectCurrentShell(),
    snippets: {
      posix: buildPosixSnippet(config.server.panelPort),
      fish: buildFishSnippet(config.server.panelPort),
      powershell: buildPowerShellSnippet(config.server.panelPort),
    },
    usage: `${SHELL_COMMAND} --deepseek    # any provider flag, case-insensitive`,
  };
}

function rcContainsCurrentSnippet(rcPath: string, desired: string): boolean {
  try {
    return extractSnippetBlock(readFileSync(rcPath, "utf-8")) === desired;
  } catch {
    return false;
  }
}

function getPowerShellProfilePath(): string {
  const home = homedir();
  if (platform() === "win32") {
    const ps7 = join(home, "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1");
    const ps5dir = join(home, "Documents", "WindowsPowerShell");
    if (existsSync(ps5dir) && !existsSync(join(home, "Documents", "PowerShell"))) {
      return join(ps5dir, "Microsoft.PowerShell_profile.ps1");
    }
    return ps7;
  }
  return join(home, ".config", "powershell", "Microsoft.PowerShell_profile.ps1");
}

function detectCurrentShell(): ShellName | null {
  if (platform() === "win32") {
    return process.env.PSModulePath ? "powershell" : null;
  }
  const shellPath = process.env.SHELL ?? "";
  if (shellPath.endsWith("/zsh")) return "zsh";
  if (shellPath.endsWith("/bash")) return "bash";
  if (shellPath.endsWith("/fish")) return "fish";
  if (process.env.PSModulePath) return "powershell";
  return null;
}

function buildPosixSnippet(panelPort: number): string {
  const endpoint = `http://127.0.0.1:${panelPort}/api/launch/prepare`;
  const endEndpoint = `http://127.0.0.1:${panelPort}/api/launch/end`;
  const heartbeatEndpoint = `http://127.0.0.1:${panelPort}/api/launch/heartbeat`;
  const attachEndpoint = `http://127.0.0.1:${panelPort}/api/launch/attach`;
  return [
    SNIPPET_SENTINEL,
    `${SHELL_COMMAND}() {`,
    '  if [ -z "$1" ]; then',
    `    echo "usage: ${SHELL_COMMAND} --<provider> [claude args...]" >&2`,
    "    return 1",
    "  fi",
    '  local flag="$1"; shift',
    "  local env_script",
    `  if ! env_script=$(curl -fsS -X POST '${endpoint}' \\`,
    "        -H 'Content-Type: application/json' \\",
    '        -d "{\\"flag\\":\\"$flag\\"}" 2>/dev/null); then',
    '    echo "Claude Code Gateway is not running. Open the app first." >&2',
    "    return 1",
    "  fi",
    "  # Subshell keeps ANTHROPIC_* env vars scoped to this invocation.",
    "  (",
    '    eval "$env_script"',
    "    __ccpg_heartbeat() {",
    "      while true; do",
    `        curl -fsS -X POST '${heartbeatEndpoint}' \\`,
    "          -H 'Content-Type: application/json' \\",
    '          -d "{\\"sessionId\\":\\"$CC_GATEWAY_SESSION_ID\\"}" >/dev/null 2>&1 || true',
    "        sleep 2",
    "      done",
    "    }",
    "    __ccpg_end_session() {",
    '      if [ -n "$__ccpg_heartbeat_pid" ]; then kill "$__ccpg_heartbeat_pid" >/dev/null 2>&1 || true; fi',
    `      curl -fsS -X POST '${endEndpoint}' \\`,
    "        -H 'Content-Type: application/json' \\",
    '        -d "{\\"sessionId\\":\\"$CC_GATEWAY_SESSION_ID\\"}" >/dev/null 2>&1 || true',
    "    }",
    "    trap __ccpg_end_session EXIT HUP INT TERM",
    "    __ccpg_heartbeat &",
    "    __ccpg_heartbeat_pid=$!",
    '    command claude "$@" &',
    "    __ccpg_claude_pid=$!",
    `    curl -fsS -X POST '${attachEndpoint}' \\`,
    "      -H 'Content-Type: application/json' \\",
    '      -d "{\\"sessionId\\":\\"$CC_GATEWAY_SESSION_ID\\",\\"pid\\":$__ccpg_claude_pid}" >/dev/null 2>&1 || true',
    '    wait "$__ccpg_claude_pid"',
    "  )",
    "}",
    SNIPPET_END,
  ].join("\n");
}

export function getSnippetForShell(config: Config, shell: ShellName): string {
  const panelPort = config.server.panelPort;
  if (shell === "fish") return buildFishSnippet(panelPort);
  if (shell === "powershell") return buildPowerShellSnippet(panelPort);
  return buildPosixSnippet(panelPort);
}

export type InstallStatus = "installed" | "updated" | "already-installed" | "error";

export interface InstallResult {
  shell: ShellName;
  status: InstallStatus;
  rcPath: string;
  error?: string;
}

// Install (or refresh) the snippet in the rc file. Always idempotent w.r.t.
// the latest snippet: if an older sentinel block is present we strip it and
// write the current version, so users get bugfixes by clicking "Add" again.
// Creates the file (and parent dir for fish) if missing.
export function installSnippet(config: Config, shell: ShellName): InstallResult {
  const rcPath = SHELL_RC_PATHS[shell]();
  const desired = getSnippetForShell(config, shell);

  try {
    mkdirSync(dirname(rcPath), { recursive: true });

    if (!existsSync(rcPath)) {
      writeFileSync(rcPath, `${desired}\n`, { encoding: "utf-8" });
      return { shell, status: "installed", rcPath };
    }

    const current = readFileSync(rcPath, "utf-8");
    const existing = extractSnippetBlock(current);

    if (existing === desired) {
      return { shell, status: "already-installed", rcPath };
    }

    if (existing !== null) {
      const replaced = current.replace(existing, desired);
      writeFileSync(rcPath, replaced, { encoding: "utf-8" });
      return { shell, status: "updated", rcPath };
    }

    const block = `\n${desired}\n`;
    appendFileSync(rcPath, block, { encoding: "utf-8" });
    return { shell, status: "installed", rcPath };
  } catch (err) {
    return {
      shell,
      status: "error",
      rcPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Returns the exact substring of `content` that is our managed block (sentinel
// to end-sentinel inclusive), or null if no block is present.
function extractSnippetBlock(content: string): string | null {
  const start = content.indexOf(SNIPPET_SENTINEL);
  if (start === -1) return null;
  const endMarker = content.indexOf(SNIPPET_END, start);
  if (endMarker === -1) return null;
  return content.slice(start, endMarker + SNIPPET_END.length);
}

function buildPowerShellSnippet(panelPort: number): string {
  const prepareUrl = `http://127.0.0.1:${panelPort}/api/launch/prepare`;
  const heartbeatUrl = `http://127.0.0.1:${panelPort}/api/launch/heartbeat`;
  const endUrl = `http://127.0.0.1:${panelPort}/api/launch/end`;
  const attachUrl = `http://127.0.0.1:${panelPort}/api/launch/attach`;
  return [
    SNIPPET_SENTINEL,
    `function ${SHELL_COMMAND} {`,
    "  if ($args.Count -eq 0) {",
    `    Write-Error "usage: ${SHELL_COMMAND} --<provider> [claude args...]"`,
    "    return",
    "  }",
    "  $flag = $args[0]",
    "  $claudeArgs = if ($args.Count -gt 1) { @($args[1..($args.Count - 1)]) } else { @() }",
    "  try {",
    `    $r = Invoke-RestMethod -Method Post -Uri '${prepareUrl}' \``,
    "      -ContentType 'application/json' `",
    "      -Body (ConvertTo-Json @{ flag = $flag; format = 'json' })",
    "  } catch {",
    "    Write-Error 'Claude Code Gateway is not running. Open the app first.'",
    "    return",
    "  }",
    '  if (-not $r.ok) { Write-Error "ccpg: $($r.error)"; return }',
    "  $sid = $r.sessionId",
    "  $saved = @{",
    "    ANTHROPIC_AUTH_TOKEN = $env:ANTHROPIC_AUTH_TOKEN",
    "    ANTHROPIC_BASE_URL = $env:ANTHROPIC_BASE_URL",
    "    CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = $env:CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY",
    "    CC_GATEWAY_SESSION_ID = $env:CC_GATEWAY_SESSION_ID",
    "  }",
    "  $env:ANTHROPIC_AUTH_TOKEN = $r.authToken",
    "  $env:ANTHROPIC_BASE_URL = $r.baseUrl",
    "  $env:CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = '1'",
    "  $env:CC_GATEWAY_SESSION_ID = $sid",
    "  $hbJob = Start-Job -ScriptBlock {",
    "    param($url, $sid)",
    "    while ($true) {",
    "      try { Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json' `",
    '        -Body "{`"sessionId`":`"$sid`"}" | Out-Null } catch {}',
    "      Start-Sleep 2",
    "    }",
    `  } -ArgumentList '${heartbeatUrl}', $sid`,
    "  try {",
    "    $proc = Start-Process claude -ArgumentList $claudeArgs -NoNewWindow -PassThru",
    `    try { Invoke-RestMethod -Method Post -Uri '${attachUrl}' -ContentType 'application/json' \``,
    '      -Body "{`"sessionId`":`"$sid`",`"pid`":$($proc.Id)}" | Out-Null } catch {}',
    "    $proc.WaitForExit()",
    "  } finally {",
    "    Stop-Job $hbJob -ErrorAction SilentlyContinue",
    "    Remove-Job $hbJob -Force -ErrorAction SilentlyContinue",
    `    try { Invoke-RestMethod -Method Post -Uri '${endUrl}' -ContentType 'application/json' \``,
    '      -Body "{`"sessionId`":`"$sid`"}" | Out-Null } catch {}',
    "    $saved.GetEnumerator() | ForEach-Object {",
    '      if ($null -eq $_.Value) { Remove-Item "env:$($_.Key)" -ErrorAction SilentlyContinue }',
    '      else { Set-Item "env:$($_.Key)" $_.Value }',
    "    }",
    "  }",
    "}",
    SNIPPET_END,
  ].join("\n");
}

function buildFishSnippet(panelPort: number): string {
  const endpoint = `http://127.0.0.1:${panelPort}/api/launch/prepare`;
  const endEndpoint = `http://127.0.0.1:${panelPort}/api/launch/end`;
  const heartbeatEndpoint = `http://127.0.0.1:${panelPort}/api/launch/heartbeat`;
  const attachEndpoint = `http://127.0.0.1:${panelPort}/api/launch/attach`;
  return [
    SNIPPET_SENTINEL,
    `function ${SHELL_COMMAND}`,
    "  if test (count $argv) -eq 0",
    `    echo "usage: ${SHELL_COMMAND} --<provider> [claude args...]" >&2`,
    "    return 1",
    "  end",
    "  set flag $argv[1]",
    "  set rest $argv[2..-1]",
    `  set env_script (curl -fsS -X POST '${endpoint}' \\`,
    "        -H 'Content-Type: application/json' \\",
    `        -d "{\\"flag\\":\\"$flag\\"}" 2>/dev/null; or echo __CC_GATEWAY_DOWN__)`,
    '  if string match -q "__CC_GATEWAY_DOWN__" -- "$env_script"',
    '    echo "Claude Code Gateway is not running. Open the app first." >&2',
    "    return 1",
    "  end",
    "  # Nested fish process keeps ANTHROPIC_* env vars scoped to this call.",
    `  fish -c "$env_script; while true; curl -fsS -X POST '${heartbeatEndpoint}' -H 'Content-Type: application/json' -d '{\\"sessionId\\":\\"'$CC_GATEWAY_SESSION_ID'\\"}' >/dev/null 2>&1; sleep 2; end &; set __ccpg_heartbeat_pid \\$last_pid; function __ccpg_end_session --on-event fish_exit; kill \\$__ccpg_heartbeat_pid >/dev/null 2>&1; curl -fsS -X POST '${endEndpoint}' -H 'Content-Type: application/json' -d '{\\"sessionId\\":\\"'$CC_GATEWAY_SESSION_ID'\\"}' >/dev/null 2>&1; end; command claude $rest &; set __ccpg_claude_pid \\$last_pid; curl -fsS -X POST '${attachEndpoint}' -H 'Content-Type: application/json' -d '{\\"sessionId\\":\\"'$CC_GATEWAY_SESSION_ID'\\",\\"pid\\":'\\$__ccpg_claude_pid'}' >/dev/null 2>&1; wait \\$__ccpg_claude_pid"`,
    "end",
    SNIPPET_END,
  ].join("\n");
}
