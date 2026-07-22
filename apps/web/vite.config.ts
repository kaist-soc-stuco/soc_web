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
  const apiPort = Number.parseInt(env.API_PORT ?? "3000", 10);
  const apiTarget =
    process.env.DEV_API_PROXY_TARGET?.trim() ||
    env.DEV_API_PROXY_TARGET?.trim() ||
    `http://localhost:${Number.isNaN(apiPort) ? 3000 : apiPort}`;

  return {
    envDir: workspaceRoot,
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;

            if (
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/react-router/") ||
              id.includes("/node_modules/react-router-dom/") ||
              id.includes("/node_modules/scheduler/")
            ) {
              return "vendor-react";
            }

            if (id.includes("/@tanstack/")) {
              return "vendor-query";
            }

            if (
              id.includes("/react-hook-form/") ||
              id.includes("/@hookform/") ||
              id.includes("/zod/")
            ) {
              return "vendor-forms";
            }

            if (id.includes("/lucide-react/")) {
              return "vendor-icons";
            }

            if (id.includes("/dayjs/")) {
              return "vendor-time";
            }

            return "vendor-misc";
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@soc/contracts": path.resolve(
          workspaceRoot,
          "shared/contracts/src/index.ts",
        ),
        "@soc/shared": path.resolve(workspaceRoot, "shared/common/src/index.ts"),
        "zod": path.resolve(__dirname, "node_modules/zod"),
      },
    },
    server: {
      port: Number.isNaN(port) ? 5173 : port,
      allowedHosts: ["soc-student-council.kws.inet.sparcs.net"],
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api/, "/v1"),
        },
        "/health": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
