import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, "");
  const port = Number.parseInt(env.WEB_PORT ?? "5173", 10);
  const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim();

  return {
    envDir: workspaceRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: Number.isNaN(port) ? 5173 : port,
      allowedHosts: ["soc-student-council.kws.inet.sparcs.net"],
      ...(apiProxyTarget
        ? {
            proxy: {
              "/api": {
                target: apiProxyTarget,
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
  };
});
