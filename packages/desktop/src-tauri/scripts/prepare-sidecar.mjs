#!/usr/bin/env node

// Compiles the daemon for the host platform and drops it into Tauri's
// expected sidecar location (src-tauri/binaries/<basename>-<target-triple>).
//
// Single entry-point used by both `tauri dev` and `tauri build` via
// beforeBuildCommand, plus directly from CI matrices.

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const daemonBinDir = join(repoRoot, "packages/daemon/dist-bin");
const tauriBinDir = join(__dirname, "..", "binaries");

const HOST_TARGETS = {
  "linux x64": {
    script: "compile:linux-x64",
    output: "claude-code-provider-gateway-daemon-linux-x64",
    triple: "x86_64-unknown-linux-gnu",
    suffix: "",
  },
  "linux arm64": {
    script: "compile:linux-arm64",
    output: "claude-code-provider-gateway-daemon-linux-arm64",
    triple: "aarch64-unknown-linux-gnu",
    suffix: "",
  },
  "darwin x64": {
    script: "compile:darwin-x64",
    output: "claude-code-provider-gateway-daemon-darwin-x64",
    triple: "x86_64-apple-darwin",
    suffix: "",
  },
  "darwin arm64": {
    script: "compile:darwin-arm64",
    output: "claude-code-provider-gateway-daemon-darwin-arm64",
    triple: "aarch64-apple-darwin",
    suffix: "",
  },
  "win32 x64": {
    script: "compile:win-x64",
    output: "claude-code-provider-gateway-daemon-win-x64.exe",
    triple: "x86_64-pc-windows-msvc",
    suffix: ".exe",
  },
};

const TARGETS_BY_TRIPLE = Object.fromEntries(
  Object.values(HOST_TARGETS).map((entry) => [entry.triple, entry]),
);

function findEntry() {
  const requestedTarget = process.env.CC_GATEWAY_TAURI_TARGET || process.env.CARGO_BUILD_TARGET;
  if (requestedTarget) {
    const entry = TARGETS_BY_TRIPLE[requestedTarget];
    if (!entry) {
      throw new Error(
        `Unsupported target: ${requestedTarget}. Supported: ${Object.keys(TARGETS_BY_TRIPLE).join(", ")}`,
      );
    }
    return entry;
  }

  const key = `${process.platform} ${process.arch}`;
  const entry = HOST_TARGETS[key];
  if (!entry) {
    throw new Error(`Unsupported host: ${key}. Supported: ${Object.keys(HOST_TARGETS).join(", ")}`);
  }
  return entry;
}

function compileDaemon(scriptName) {
  console.log(`▶ compiling daemon (${scriptName})`);
  execSync(`npm run ${scriptName} -w @claude-code-provider-gateway/daemon`, {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

function main() {
  const entry = findEntry();
  const src = join(daemonBinDir, entry.output);

  compileDaemon(entry.script);

  if (!existsSync(src)) {
    console.error(`✗ compile finished but binary still missing: ${src}`);
    process.exit(1);
  }

  mkdirSync(tauriBinDir, { recursive: true });
  const dest = join(
    tauriBinDir,
    `claude-code-provider-gateway-daemon-${entry.triple}${entry.suffix}`,
  );
  copyFileSync(src, dest);

  if (process.platform !== "win32") {
    execSync(`chmod +x "${dest}"`);
  }

  console.log(`✓ sidecar ready: ${dest}`);
}

main();
