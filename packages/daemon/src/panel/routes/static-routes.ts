import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = resolveStaticRoot();

export function registerStaticRoutes(app: Hono): void {
  app.get("/favicon.ico", (c) => c.body(null, 204));
  if (!existsSync(STATIC_ROOT)) return;

  app.get("/", serveStatic({ root: STATIC_ROOT, path: "index.html" }));
  app.use("/*", serveStatic({ root: STATIC_ROOT }));
  app.get("/*", serveStatic({ root: STATIC_ROOT, path: "index.html" }));
}

function resolveStaticRoot(): string {
  if (__dirname.includes("src/panel/routes")) return join(__dirname, "../../../dist/static");
  const bundled = join(__dirname, "static");
  if (existsSync(bundled)) return bundled;
  return join(dirname(process.execPath), "static");
}
