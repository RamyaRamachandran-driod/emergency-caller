import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL("../../", import.meta.url)), "");
  return { server: { port: 5173, proxy: { "/api": process.env.ORCHESTRATOR_URL || env.ORCHESTRATOR_URL || "http://127.0.0.1:4100" } } };
});
