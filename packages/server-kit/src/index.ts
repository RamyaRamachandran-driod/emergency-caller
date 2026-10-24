import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z, ZodError } from "zod";
import { API_CONTRACT_VERSION } from "@emergency/shared";
dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});
export const mode = process.env.APP_MODE ?? "test";
if (!["test", "live"].includes(mode))
  throw new Error("APP_MODE must be test or live");
export const testCallNumber = process.env.VOICE_TEST_NUMBER ? z.string().regex(/^\+[1-9]\d{7,14}$/).parse(process.env.VOICE_TEST_NUMBER) : null;
export const token = process.env.INTERNAL_SERVICE_TOKEN;
if (!token) throw new Error("Set INTERNAL_SERVICE_TOKEN in root .env");
export function appFor(name: string, health: () => Record<string, unknown> = () => ({})) {
  const app = express();
  app.use(cors({ origin: "http://localhost:5173" }));
  app.use(express.json({ limit: "64kb" }));
  app.get("/health", (_q, s) =>
    s.json({ service: name, mode, status: "ok", liveReady: false, ...health() }),
  );
  return app;
}
export function internal(req: Request, res: Response, next: NextFunction) {
  if (req.headers.authorization !== `Bearer ${token}`) {
    res.status(401).json({ error: "Unauthorized service request" });
    return;
  }
  if (req.headers["x-emergency-contract-version"] !== API_CONTRACT_VERSION) {
    res.status(426).json({ error: "Unsupported internal contract version. Update shared contracts and service adapters together." });
    return;
  }
  next();
}
export async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-emergency-contract-version": API_CONTRACT_VERSION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`Service request failed: ${response.status}`);
  return response.json();
}
export function errors(app: express.Express) {
  app.use((e: unknown, _q: Request, s: Response, _n: NextFunction) => {
    const invalid = e instanceof ZodError;
    s.status(invalid ? 400 : 500).json({
      error: invalid ? e.issues : "Service error; inspect server logs",
    });
    if (!invalid) console.error(e);
  });
}
