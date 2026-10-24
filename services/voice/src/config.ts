import { readFileSync } from "node:fs";
import { createPrivateKey } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
import { z } from "zod";
export const Phone = z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an international phone number such as +14155550123");
export type ProviderName = "twilio" | "vonage";
export interface VoiceConfig {
  provider: ProviderName; vonageApplicationId: string; vonagePrivateKeyPath: string; vonageApiKey: string; vonageSignatureSecret: string;
  testNumber: string | null; live: boolean; port: number; providerPort: number; publicUrl: string;
  accountSid: string; authToken: string; from: string; apiKey: string;
  quoteModel: string; model: string; voice: string; transcriptionModel: string; allowedNumbers: string[]; destinationPolicy: "allowlist" | "sourced";
  maxSeconds: number; maxConcurrent: number; dataDir: string;
}
export function configFromEnv(env: NodeJS.ProcessEnv): VoiceConfig {
  const integer = (key: string, fallback: number, max: number) => z.coerce.number().int().positive().max(max).parse(env[key] || fallback);
  const provider = z.enum(["twilio", "vonage"]).parse(env.VOICE_PROVIDER || "twilio");
  return {
    testNumber: env.VOICE_TEST_NUMBER ? Phone.parse(env.VOICE_TEST_NUMBER) : null,
    provider, vonageApplicationId: env.VONAGE_APPLICATION_ID || "", vonagePrivateKeyPath: resolve(root, env.VONAGE_PRIVATE_KEY_PATH || ".secrets/vonage-private.key"),
    vonageApiKey: env.VONAGE_API_KEY || "", vonageSignatureSecret: env.VONAGE_SIGNATURE_SECRET || "",
    live: z.enum(["test", "live"]).parse(env.VOICE_MODE || env.APP_MODE || "test") === "live",
    port: integer("VOICE_PORT", 4102, 65535), providerPort: integer("VOICE_PROVIDER_PORT", 4103, 65535),
    publicUrl: (env.PUBLIC_VOICE_URL ?? "").replace(/\/$/, ""),
    accountSid: env.TWILIO_ACCOUNT_SID ?? "", authToken: env.TWILIO_AUTH_TOKEN ?? "",
    from: provider === "vonage" ? (env.VONAGE_FROM_NUMBER || "123456789") : (env.TWILIO_PHONE_NUMBER || ""), apiKey: env.OPENAI_API_KEY ?? "",
    quoteModel: env.OPENAI_TEXT_MODEL || "",
    model: env.OPENAI_REALTIME_MODEL || "gpt-realtime",
    voice: env.OPENAI_VOICE || "marin", transcriptionModel: env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
    destinationPolicy: z.enum(["allowlist", "sourced"]).parse(env.VOICE_DESTINATION_POLICY || "allowlist"),
    allowedNumbers: (env.VOICE_ALLOWED_NUMBERS ?? "").split(",").map(s => s.trim()).filter(Boolean),
    maxSeconds: integer("VOICE_MAX_SECONDS", 180, 600), maxConcurrent: integer("VOICE_MAX_CONCURRENT", 3, 10),
    dataDir: resolve(root, env.VOICE_DATA_DIR || "data/voice"),
  };
}
export function missingConfig(c: VoiceConfig, options: { probe?: boolean } = {}): string[] {
  const missing: string[] = [];
  if (c.provider === "twilio") {
    if (!/^AC[a-f\d]{32}$/i.test(c.accountSid)) missing.push("TWILIO_ACCOUNT_SID");
    if (!c.authToken) missing.push("TWILIO_AUTH_TOKEN");
    if (!Phone.safeParse(c.from).success) missing.push("TWILIO_PHONE_NUMBER");
  } else {
    if (!z.string().uuid().safeParse(c.vonageApplicationId).success) missing.push("VONAGE_APPLICATION_ID");
    try { const key = createPrivateKey(readFileSync(c.vonagePrivateKeyPath)); if (key.asymmetricKeyType !== "rsa") throw Error(); }
    catch { missing.push("VONAGE_PRIVATE_KEY_PATH (readable RSA private key)"); }
    if (!/^(?:123456789|\+?[1-9]\d{7,14})$/.test(c.from)) missing.push("VONAGE_FROM_NUMBER");
    if (!options.probe) {
      if (!c.vonageApiKey) missing.push("VONAGE_API_KEY");
      if (!c.vonageSignatureSecret) missing.push("VONAGE_SIGNATURE_SECRET");
    }
  }
  if (!options.probe) {
    if (!c.apiKey) missing.push("OPENAI_API_KEY");
    try { const u = new URL(c.publicUrl); if (u.protocol !== "https:" || u.pathname !== "/" || u.search || u.hash || u.username || u.password) throw Error(); }
    catch { missing.push("PUBLIC_VOICE_URL (HTTPS tunnel origin)"); }
  }
  if ((c.destinationPolicy === "allowlist" && !c.allowedNumbers.length) || c.allowedNumbers.some(p => !Phone.safeParse(p).success)) missing.push("VOICE_ALLOWED_NUMBERS");
  return missing;
}
