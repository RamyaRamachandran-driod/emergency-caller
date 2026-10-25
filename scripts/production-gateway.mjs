import express from "express";
import { createServer, request as httpRequest } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";

export function createGateway({ username, password, orchestratorUrl, providerUrl, staticDir, ready = async () => true }) {
  if (!username || !password || password.length < 16) throw Error("Set DASHBOARD_USER and a DASHBOARD_PASSWORD of at least 16 characters");
  const digest = value => createHash("sha256").update(value).digest();
  const expected = digest(`Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`);
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => { res.setHeader("x-content-type-options", "nosniff"); res.setHeader("referrer-policy", "no-referrer"); res.setHeader("cache-control", "no-store"); next(); });
  app.get("/health", async (_req, res) => {
    const healthy = await ready().catch(() => false);
    res.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "starting" });
  });
  function proxy(req, res, target) {
    const url = new URL(target);
    const upstream = httpRequest({ hostname: url.hostname, port: url.port, method: req.method, path: req.url, headers: { ...req.headers, host: url.host } }, response => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    });
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end("Service temporarily unavailable"); });
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
  }
  app.use((req, res, next) => {
    if (/^\/(?:vonage|twilio)\//.test(req.url)) { proxy(req, res, providerUrl); return; }
    if (!timingSafeEqual(digest(req.headers.authorization ?? ""), expected)) {
      res.setHeader("www-authenticate", 'Basic realm="Savior", charset="UTF-8"');
      res.status(401).send("Sign in to Savior"); return;
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) { res.sendStatus(403); return; } }
      catch { res.sendStatus(403); return; }
    }
    if (req.url === "/api" || req.url.startsWith("/api/")) { proxy(req, res, orchestratorUrl); return; }
    if (/^\/(?:internal|dev|calls|discover|setup)(?:\/|$)/.test(req.url)) { res.sendStatus(404); return; }
    next();
  });
  app.use(express.static(resolve(staticDir), { index: false, dotfiles: "deny" }));
  app.use((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") { res.sendStatus(404); return; }
    res.sendFile(resolve(staticDir, "index.html"));
  });
  const server = createServer(app);
  server.on("upgrade", (req, socket, head) => {
    if (!/^\/(?:vonage|twilio)\/media\//.test(req.url ?? "")) { socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n"); return; }
    const url = new URL(providerUrl);
    const upstream = httpRequest({ hostname: url.hostname, port: url.port, method: "GET", path: req.url, headers: { ...req.headers, host: url.host } });
    upstream.on("upgrade", (response, peer, upstreamHead) => {
      socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n` + Object.entries(response.headers).map(([key, value]) => `${key}: ${value}\r\n`).join("") + "\r\n");
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) peer.write(head);
      socket.on("error", () => peer.destroy()); peer.on("error", () => socket.destroy());
      socket.on("close", () => peer.destroy()); peer.on("close", () => socket.destroy());
      socket.pipe(peer); peer.pipe(socket);
    });
    upstream.on("response", response => { socket.end(`HTTP/1.1 ${response.statusCode} Rejected\r\nConnection: close\r\n\r\n`); response.resume(); });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
    upstream.end();
  });
  return server;
}
