import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const { version } = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf-8")) as {
  version: string;
};

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: "../../packages/daemon/dist/static",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // 127.0.0.1 explicitly: on Linux with default /etc/hosts, `localhost`
      // can resolve to ::1 (IPv6) while the daemon binds IPv4 only.
      "/api": "http://127.0.0.1:6767",
    },
  },
});
