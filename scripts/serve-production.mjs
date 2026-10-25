import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGateway } from "./production-gateway.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = { ...process.env, NODE_ENV: "production" };
env.APP_MODE ||= "live";
env.VOICE_MODE ||= env.APP_MODE;
const data = resolve(env.DATA_DIR || join(root, "data/production"));
mkdirSync(data, { recursive: true, mode: 0o700 });
env.DATABASE_PATH = join(data, "orchestrator.sqlite");
env.VOICE_DATA_DIR = join(data, "voice");
env.ORCHESTRATOR_PORT ||= "4100";
env.DISCOVERY_PORT ||= "4101";
env.VOICE_PORT ||= "4102";
env.VOICE_PROVIDER_PORT ||= "4103";
env.ORCHESTRATOR_URL = `http://127.0.0.1:${env.ORCHESTRATOR_PORT}`;
env.DISCOVERY_URL = `http://127.0.0.1:${env.DISCOVERY_PORT}`;
env.VOICE_URL = `http://127.0.0.1:${env.VOICE_PORT}`;
env.PUBLIC_VOICE_URL ||= env.RENDER_EXTERNAL_URL;
if (!env.INTERNAL_SERVICE_TOKEN) throw Error("INTERNAL_SERVICE_TOKEN is required");
if (env.APP_MODE === "live" || env.VOICE_MODE === "live") {
  if (!/^\+[1-9]\d{7,14}$/.test(env.VOICE_TEST_NUMBER || "")) throw Error("First live deployment requires VOICE_TEST_NUMBER: calls remain restricted to your phone");
  env.VOICE_DESTINATION_POLICY = "allowlist";
  env.VOICE_ALLOWED_NUMBERS = env.VOICE_TEST_NUMBER;
}
if (env.VONAGE_PRIVATE_KEY_B64) {
  const secretDir = join(data, "secrets");
  mkdirSync(secretDir, { recursive: true, mode: 0o700 });
  env.VONAGE_PRIVATE_KEY_PATH = join(secretDir, "vonage-private.key");
  writeFileSync(env.VONAGE_PRIVATE_KEY_PATH, Buffer.from(env.VONAGE_PRIVATE_KEY_B64, "base64"), { mode: 0o600 });
  delete env.VONAGE_PRIVATE_KEY_B64;
}
const serviceUrls = [env.ORCHESTRATOR_URL, env.DISCOVERY_URL, env.VOICE_URL];
const server = createGateway({ username: env.DASHBOARD_USER, password: env.DASHBOARD_PASSWORD,
  orchestratorUrl: env.ORCHESTRATOR_URL, providerUrl: `http://127.0.0.1:${env.VOICE_PROVIDER_PORT}`,
  staticDir: join(root, "apps/dashboard/dist"),
  ready: async () => (await Promise.all(serviceUrls.map(url => fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) }).then(r => r.ok).catch(() => false)))).every(Boolean),
});
let stopping = false;
const children = ["orchestrator", "discovery", "voice"].map(name => {
  const child = spawn(process.execPath, ["--import", "tsx", `services/${name}/src/index.ts`], { cwd: root, env, stdio: "inherit" });
  child.on("error", () => stop(1));
  child.on("exit", code => { if (!stopping) { console.error(`${name} exited; stopping deployment`); stop(code || 1); } });
  return child;
});
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  server.close();
  children.forEach(child => child.kill("SIGTERM"));
  const timeout = setTimeout(() => { children.forEach(child => child.kill("SIGKILL")); process.exit(code); }, 10000);
  Promise.all(children.map(child => child.exitCode !== null ? Promise.resolve() : new Promise(resolve => child.once("exit", resolve)))).then(() => { clearTimeout(timeout); process.exit(code); });
}
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
server.on("error", () => stop(1));
server.listen(Number(env.PORT || 10000), "0.0.0.0", () => console.log("Savior production gateway listening"));
