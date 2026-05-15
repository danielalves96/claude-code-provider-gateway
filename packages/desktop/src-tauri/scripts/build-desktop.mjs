#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.platform === "linux") {
  run("tauri", ["build", "--bundles", "deb,rpm"]);
  run("npm", ["run", "build:appimage"]);
} else {
  run("tauri", ["build"]);
}
