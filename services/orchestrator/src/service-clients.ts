import { API_CONTRACT_VERSION, CallAccepted, CallRequest, DiscoveryRequest, DiscoveryResult } from "@emergency/shared";
import { token } from "@emergency/server-kit";

const discoveryTimeout = Number(process.env.DISCOVERY_TIMEOUT_MS ?? 180_000);
const voiceTimeout = Number(process.env.VOICE_REQUEST_TIMEOUT_MS ?? 15_000);
if (!Number.isFinite(discoveryTimeout) || discoveryTimeout <= 0) throw new Error("DISCOVERY_TIMEOUT_MS must be a positive number.");
if (!Number.isFinite(voiceTimeout) || voiceTimeout <= 0) throw new Error("VOICE_REQUEST_TIMEOUT_MS must be a positive number.");

async function postJson(url: string, body: unknown, timeoutMs: number): Promise<unknown> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-emergency-contract-version": API_CONTRACT_VERSION,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(`HTTP ${response.status}${body?.error ? `: ${body.error}` : ""}`);
    }
    return await response.json();
  } catch (error) {
    const detail = error instanceof Error && error.name === "TimeoutError"
      ? `timed out after ${timeoutMs} ms`
      : error instanceof Error ? error.message : String(error);
    throw new Error(`Request to ${new URL(url).hostname} ${detail}.`);
  }
}

export class DiscoveryClient {
  constructor(private readonly baseUrl = process.env.DISCOVERY_URL ?? "http://localhost:4101") {}
  async find(request: unknown) {
    const validatedRequest = DiscoveryRequest.parse(request);
    const response = await postJson(`${this.baseUrl}/discover`, validatedRequest, discoveryTimeout);
    return DiscoveryResult.parse(response);
  }
}

export class VoiceClient {
  constructor(private readonly baseUrl = process.env.VOICE_URL ?? "http://localhost:4102") {}
  async start(request: unknown) {
    const validatedRequest = CallRequest.parse(request);
    const response = await postJson(`${this.baseUrl}/calls`, validatedRequest, voiceTimeout);
    return CallAccepted.parse(response);
  }
}
