import { createVoiceService } from "./service.js";
const service = createVoiceService();
await service.listen();
console.log(`Voice ready on 127.0.0.1:${service.config.port} (${service.config.live ? "live quotes" : "simulated"})`);
console.log(`Provider-only tunnel target: http://127.0.0.1:${service.config.providerPort}`);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  void service.close().then(() => process.exit(0));
  setTimeout(() => process.exit(1), 20000).unref();
});
