import dotenv from "dotenv";
import fs from "node:fs";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = resolve(root, ".env");
dotenv.config({ path: envFile, quiet: true });
function updateEnv(values) {
  let text = fs.readFileSync(envFile, "utf8");
  for (const [name, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, `${name}=${value}`) : `${text.trimEnd()}\n${name}=${value}\n`;
  }
  fs.writeFileSync(envFile, text, { mode: 0o600 });
}
try {
  const key = process.env.VONAGE_API_KEY, secret = process.env.VONAGE_API_SECRET;
  if (!key || !secret) throw Error("Add VONAGE_API_KEY and VONAGE_API_SECRET to root .env first. Setup creates a Voice application, not a phone number.");
  const keyPath = resolve(root, process.env.VONAGE_PRIVATE_KEY_PATH || ".secrets/vonage-private.key");
  if (process.env.VONAGE_APPLICATION_ID && !fs.existsSync(keyPath)) throw Error("An application ID is configured but its private key file is missing. Download the application's matching key or clear the ID to create a new application.");
  fs.mkdirSync(dirname(keyPath), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(keyPath)) {
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
    fs.writeFileSync(keyPath, pair.privateKey, { mode: 0o600, flag: "wx" });
  }
  const publicKey = createPublicKey(fs.readFileSync(keyPath)).export({ type: "spki", format: "pem" }).toString();
  const sameKey = value => String(value || "").replace(/\s/g, "") === publicKey.replace(/\s/g, "");
  async function request(path, method = "GET", body) {
    const response = await fetch(`https://api.nexmo.com/v2/applications${path}`, { method, headers: { authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error(`Vonage application setup failed with HTTP ${response.status}. Check API credentials and account access.`);
    return response.json();
  }
  let application;
  if (process.env.VONAGE_APPLICATION_ID) {
    application = await request(`/${encodeURIComponent(process.env.VONAGE_APPLICATION_ID)}`);
    if (!sameKey(application.keys?.public_key)) throw Error("The configured private key does not match the application's public key. Nothing was changed remotely.");
    if (!application.capabilities?.voice?.signed_callbacks) {
      application = await request(`/${application.id}`, "PUT", { name: application.name, keys: { public_key: publicKey }, capabilities: { ...application.capabilities, voice: { ...application.capabilities?.voice, signed_callbacks: true } } });
    }
  } else {
    // Recover an application created with this key if the previous setup request timed out.
    let path = "?page_size=100";
    while (path) {
      const page = await request(path);
      application = page._embedded?.applications?.find(app => sameKey(app.keys?.public_key));
      if (application) break;
      const next = page._links?.next?.href;
      path = next ? new URL(next, "https://api.nexmo.com").search : "";
    }
    if (!application) application = await request("", "POST", { name: "Savior local voice", keys: { public_key: publicKey }, capabilities: { voice: { signed_callbacks: true } } });
  }
  let from = process.env.VONAGE_FROM_NUMBER || "123456789";
  if (from === "123456789") {
    try {
      const url = new URL("https://rest.nexmo.com/account/numbers");
      url.searchParams.set("api_key", key); url.searchParams.set("api_secret", secret);
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (response.ok) {
        const account = await response.json();
        const owned = account.numbers?.find(number => number.features?.includes("VOICE"));
        if (owned?.msisdn) from = `+${owned.msisdn}`;
      }
    } catch { /* Keep the documented trial caller ID when number lookup is unavailable. */ }
  }
  updateEnv({ VONAGE_APPLICATION_ID: application.id, VONAGE_PRIVATE_KEY_PATH: keyPath, VOICE_PROVIDER: "vonage", VONAGE_FROM_NUMBER: from });
  console.log(`Vonage Voice application ready: ${application.id}`);
  console.log(`Caller ID: ${from}${from === "123456789" ? " (trial placeholder; carrier acceptance is not guaranteed)" : " (existing configured/owned number)"}`);
  console.log("Private key saved locally; no phone number purchased. Restart voice, then run npm run voice:call -- setup.");
} catch (error) { console.error(error.message); process.exitCode = 1; }
