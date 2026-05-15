#!/usr/bin/env node

// Tauri's AppImage path runs linuxdeploy's GTK plugin. That plugin patches
// every ELF in the AppDir, including our Bun-compiled daemon sidecar; the
// patched sidecar can then make ldd segfault. Build normally first, then
// recover that known failure by restoring the sidecar and invoking the final
// AppImage plugin directly.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcTauriDir = resolve(__dirname, "..");
const desktopDir = resolve(srcTauriDir, "..");
const repoRoot = resolve(srcTauriDir, "../../..");
const configPath = join(srcTauriDir, "tauri.conf.json");
const config = await import(configPath, { with: { type: "json" } });
const { productName, version } = config.default;

const HOST_TARGETS = {
  "linux x64": {
    daemonOutput: "claude-code-provider-gateway-daemon-linux-x64",
    archName: "amd64",
  },
  "linux arm64": {
    daemonOutput: "claude-code-provider-gateway-daemon-linux-arm64",
    archName: "arm64",
  },
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? desktopDir,
    env: process.env,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (options.capture) {
    return result;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
}

function assertFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} not found: ${path}`);
  }
}

function main() {
  const normal = run("tauri", ["build", "--bundles", "appimage"], {
    capture: true,
  });

  if (normal.status === 0) {
    process.stdout.write(normal.stdout);
    process.stderr.write(normal.stderr);
    return;
  }

  const output = `${normal.stdout}\n${normal.stderr}`;
  if (!output.includes("failed to run") || !output.includes("linuxdeploy")) {
    process.stdout.write(normal.stdout);
    process.stderr.write(normal.stderr);
    process.exit(normal.status ?? 1);
  }

  process.stdout.write(normal.stdout);
  process.stderr.write(normal.stderr);
  console.warn("Recovering AppImage build after linuxdeploy sidecar patch failure...");

  const target = HOST_TARGETS[`${process.platform} ${process.arch}`];
  if (!target) {
    throw new Error(`Unsupported AppImage host: ${process.platform} ${process.arch}`);
  }

  const bundleDir = join(srcTauriDir, "target/release/bundle/appimage");
  const appDir = join(bundleDir, `${productName}.AppDir`);
  const sidecarSrc = join(repoRoot, "packages/daemon/dist-bin", target.daemonOutput);
  const sidecarDest = join(appDir, "usr/bin/claude-code-provider-gateway-daemon");
  const productIcon = join(appDir, `${productName}.png`);
  const desktopIcon = join(appDir, "claude-code-provider-gateway-desktop.png");
  const expectedOutput = join(bundleDir, `${productName}_${version}_${target.archName}.AppImage`);
  const pluginArchSuffix = target.archName === "arm64" ? "aarch64" : "x86_64";
  const pluginOutput = join(
    bundleDir,
    `${productName.replaceAll(" ", "_")}-${pluginArchSuffix}.AppImage`,
  );
  const appImagePlugin = join(
    process.env.HOME ?? "",
    ".cache/tauri/linuxdeploy-plugin-appimage.AppImage",
  );

  assertFile(sidecarSrc, "original Bun sidecar");
  assertFile(productIcon, "AppDir product icon");
  assertFile(appImagePlugin, "linuxdeploy AppImage plugin");

  copyFileSync(sidecarSrc, sidecarDest);
  copyFileSync(productIcon, desktopIcon);
  rmSync(expectedOutput, { force: true });
  rmSync(pluginOutput, { force: true });

  run(appImagePlugin, ["--appimage-extract-and-run", "--appdir", appDir], {
    cwd: bundleDir,
  });

  if (pluginOutput !== expectedOutput && existsSync(pluginOutput)) {
    rmSync(expectedOutput, { force: true });
    copyFileSync(pluginOutput, expectedOutput);
    rmSync(pluginOutput, { force: true });
  }

  assertFile(expectedOutput, "AppImage output");
  console.log(`Finished AppImage at:\n  ${expectedOutput}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
