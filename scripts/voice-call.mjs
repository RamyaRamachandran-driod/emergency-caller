import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const base = `http://127.0.0.1:${process.env.VOICE_PORT || 4102}`;
const headers = { "content-type": "application/json", authorization: `Bearer ${process.env.INTERNAL_SERVICE_TOKEN || ""}` };
const [command = "setup", ...args] = process.argv.slice(2);
async function api(path, method = "GET", body) {
  const r = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  const data = await r.json();
  if (!r.ok) throw Error(JSON.stringify(data));
  return data;
}
try {
  if (!process.env.INTERNAL_SERVICE_TOKEN) throw Error("Set INTERNAL_SERVICE_TOKEN in root .env first");
  if (command === "setup") console.log(JSON.stringify(await api("/setup"), null, 2));
  else if (command === "stop") {
    if (!args[0]) throw Error("Usage: npm run voice:call -- stop CALL_ID");
    const state = await api(`/calls/${encodeURIComponent(args[0])}/stop`, "POST");
    console.log(JSON.stringify({ callId: state.callId, status: state.status, reason: state.reason }, null, 2));
  } else if (command === "status") {
    if (!args[0]) throw Error("Usage: npm run voice:call -- status CALL_ID");
    console.log(JSON.stringify(await api(`/calls/${encodeURIComponent(args[0])}`), null, 2));
  } else if (["quote", "probe"].includes(command)) {
    const [to, location = "Team phone test", problem = "Phone connectivity test"] = args;
    if (!to || (command === "quote" && args.length < 3)) throw Error('Usage: npm run voice:call -- quote +14155550123 "Street address, city" "Car will not start"');
    const callId = randomUUID();
    const result = await api(command === "probe" ? "/dev/probe" : "/dev/calls", "POST", { callId, taskId: randomUUID(), purpose: "quote", selectedOffer: null,
      business: { id: "team-phone", name: "Team phone rehearsal", phone: to, sourceUrl: null, openingStatus: "unknown", checkedAt: new Date().toISOString() },
      input: { request: problem, location, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, maxArrivalMinutes: 30 } });
    console.log(`${result.simulated ? "SIMULATED" : "LIVE TELEPHONE"} ${command} call via ${result.provider}: ${callId}`);
    console.log(`Stop: npm run voice:call -- stop ${callId}`);
    let seen = 0, stopping = false;
    process.on("SIGINT", () => { if (!stopping) { stopping = true; void api(`/calls/${callId}/stop`, "POST").then(() => process.exit(0)).catch(() => process.exit(1)); } });
    while (!stopping) {
      const state = await api(`/calls/${callId}`);
      for (const e of state.events.slice(seen)) {
        if (e.type === "transcript") console.log(`${e.speaker}: ${e.text}`);
        else if (e.type === "offer") console.log("QUOTE:", JSON.stringify(e.offer, null, 2));
        else if (e.type === "status") console.log(`Status: ${e.status}`);
      }
      seen = state.events.length;
      if (["completed", "failed"].includes(state.status)) { console.log(state.reason || "Call ended"); if (!state.simulated && !state.connectionConfirmed) console.log("Call attempt ended without a confirmed audio connection."); if (!state.probe && !state.events.some(e => e.type === "offer")) console.log("No supported quote was collected."); break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } else throw Error("Commands: setup | probe PHONE | quote PHONE LOCATION PROBLEM | status CALL_ID | stop CALL_ID");
} catch (error) { console.error(error.message); process.exitCode = 1; }
