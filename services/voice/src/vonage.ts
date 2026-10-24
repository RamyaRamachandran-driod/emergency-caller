import { createHash, createPrivateKey, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { SignJWT, jwtVerify } from "jose";
import type { VoiceConfig } from "./config.js";
export function equalSecret(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function applicationJwt(c: VoiceConfig) {
  return new SignJWT({ application_id: c.vonageApplicationId })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuedAt().setJti(randomUUID()).setExpirationTime("5m")
    .sign(createPrivateKey(readFileSync(c.vonagePrivateKeyPath)));
}
export async function verifyVonageWebhook(c: VoiceConfig, authorization: string, body: Buffer) {
  if (!authorization.startsWith("Bearer ") || !c.vonageSignatureSecret) return false;
  try {
    const { payload } = await jwtVerify(authorization.slice(7), new TextEncoder().encode(c.vonageSignatureSecret), {
      algorithms: ["HS256"], issuer: "Vonage", maxTokenAge: "5m", clockTolerance: 30,
      requiredClaims: ["iat", "jti", "api_key", "payload_hash"],
    });
    return payload.api_key === c.vonageApiKey && (!payload.application_id || payload.application_id === c.vonageApplicationId) &&
      typeof payload.payload_hash === "string" && equalSecret(payload.payload_hash, createHash("sha256").update(body).digest("hex"));
  } catch { return false; }
}
export class ProviderError extends Error {
  constructor(public provider: string, public status: number, public code: string) { super(`${provider} API rejected the request (HTTP ${status}, ${code}). Check account access, credentials, balance and verified trial destination.`); }
}
export async function vonageRequest(c: VoiceConfig, path: string, method: string, body?: object, fetcher = fetch) {
  const response = await fetcher(`https://api.nexmo.com/v1/calls${path}`, {
    method, headers: { authorization: `Bearer ${await applicationJwt(c)}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Avoid logging provider response bodies which may contain customer details or credentials.
    let code = "unknown";
    try { const error = await response.json(); code = String(error.type || error.error_title || error.code || "unknown").split("/").at(-1)!.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100); } catch {}
    throw new ProviderError("Vonage", response.status, code);
  }
  if (response.status === 204) return {};
  return response.json();
}
