import { TaskInput } from "@emergency/shared";
import { appFor, internal, errors, mode } from "@emergency/server-kit";
import { Orchestrator } from "./coordinator.js";
import { workflowReadiness } from "./service-clients.js";
import { TaskStore } from "./store.js";

const app = appFor("orchestrator");
const store = new TaskStore();
const orchestrator = new Orchestrator(store);

app.get("/api/setup", async (_req, res) => res.json(await workflowReadiness()));

app.post("/api/tasks", async (req, res) => {
  const input = TaskInput.parse(req.body);
  const key = req.header("Idempotency-Key")?.trim() || null;
  const prior = key ? orchestrator.getTaskByRequestId(key) : null;
  if (prior) { res.status(200).json(prior); return; }
  const setup = await workflowReadiness();
  if (!setup.ready) { res.status(503).json({ error: setup.issues.join(" ") }); return; }
  res.status(202).json(orchestrator.submit(input, key));
});

app.get("/api/tasks/:id", (req, res) => {
  const task = orchestrator.getTask(req.params.id);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

app.post("/api/tasks/:id/book", async (req, res) => {
  const existing = orchestrator.getTask(req.params.id);
  if (existing && !existing.simulated) { res.status(409).json({ error: "Live quotes are available. Booking requires customer dispatch contact details and is not enabled yet." }); return; }
  const key = req.header("Idempotency-Key")?.trim();
  if (!key) { res.status(400).json({ error: "Set an Idempotency-Key header to prevent duplicate booking calls." }); return; }
  const offerId = typeof req.body?.offerId === "string" ? req.body.offerId : "";
  const { result, task } = await orchestrator.requestBooking(req.params.id, offerId, key);
  if (result === "missing") { res.status(404).json({ error: "Task not found" }); return; }
  if (result === "invalid") { res.status(409).json({ error: "Task or offer is not eligible for booking." }); return; }
  if (result === "booking_exists") { res.status(409).json({ error: "This task already has a booking attempt; duplicate dispatch is blocked." }); return; }
  res.status(202).json(task);
});

app.post("/internal/events", internal, (req, res) => {
  const { result } = orchestrator.recordEvent(req.body);
  if (result === "missing") { res.status(404).json({ error: "Unknown task or call" }); return; }
  if (result === "invalid") { res.status(400).json({ error: "Call event does not match the call purpose or business." }); return; }
  res.json({ ok: true });
});

errors(app);
const server = app.listen(Number(process.env.ORCHESTRATOR_PORT ?? 4100), "127.0.0.1", () =>
  console.log(`Orchestrator ready (${mode} mode)`),
);
function shutdown() { server.close(() => { store.close(); process.exit(0); }); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
