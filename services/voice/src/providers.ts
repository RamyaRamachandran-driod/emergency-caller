import twilio from "twilio";
import type { VoiceConfig, ProviderName } from "./config.js";
import { vonageRequest } from "./vonage.js";
export interface DialPlan {
  to: string; from: string; mediaUrl: string; eventUrl: string; token: string; callId: string;
  maxSeconds: number; probe: boolean;
}
export interface Provider {
  dial(plan: DialPlan): Promise<{ sid: string }>;
  hangup(sid: string): Promise<unknown>;
  status?(sid: string): Promise<{ status: string }>;
}
export function vonageCallBody(plan: DialPlan) {
  return {
    to: [{ type: "phone", number: plan.to.replace(/^\+/, "") }],
    from: { type: "phone", number: plan.from.replace(/^\+/, "") },
    ringing_timer: 30, length_timer: plan.maxSeconds,
    ...(plan.eventUrl ? { event_url: [plan.eventUrl], event_method: "POST" } : {}),
    ncco: plan.probe ? [{ action: "talk", text: "Hello Tanay. This is the Savior phone connection test. Your Vonage calling connection is working. Goodbye.", language: "en-US" }] : [
      { action: "connect", eventUrl: [plan.eventUrl], eventMethod: "POST", endpoint: [{ type: "websocket", uri: plan.mediaUrl,
        "content-type": "audio/l16;rate=16000", headers: { callId: plan.callId }, authorization: { type: "custom", value: `Bearer ${plan.token}` } }] },
    ],
  };
}
export function twilioCallBody(plan: DialPlan) {
  const xml = new twilio.twiml.VoiceResponse();
  if (plan.probe) xml.say("Hello. This is the Savior phone connection test. Goodbye.");
  else xml.connect().stream({ url: plan.mediaUrl });
  xml.hangup();
  return { to: plan.to, from: plan.from, twiml: xml.toString(), statusCallback: plan.eventUrl,
    statusCallbackMethod: "POST", statusCallbackEvent: ["initiated", "ringing", "answered", "completed"], timeout: 30, timeLimit: plan.maxSeconds };
}
export function makeProvider(c: VoiceConfig, name: ProviderName = c.provider): Provider {
  if (name === "vonage") return {
    dial: async plan => { const response = await vonageRequest(c, "", "POST", vonageCallBody(plan)); if (typeof response.uuid !== "string") throw Error("Vonage did not return a call UUID"); return { sid: response.uuid }; },
    hangup: sid => vonageRequest(c, `/${encodeURIComponent(sid)}`, "PUT", { action: "hangup" }),
    status: async sid => { const response = await vonageRequest(c, `/${encodeURIComponent(sid)}`, "GET"); return { status: response.status }; },
  };
  const client = twilio(c.accountSid, c.authToken, { timeout: 15000, autoRetry: false });
  return { dial: plan => client.calls.create(twilioCallBody(plan)), hangup: sid => client.calls(sid).update({ status: "completed" }) };
}
