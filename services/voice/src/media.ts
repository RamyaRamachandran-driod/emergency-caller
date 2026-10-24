import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type { VoiceConfig } from "./config.js";
import type { Record } from "./store.js";
// Streaming interpolation retains sample/phase state across arbitrary packet boundaries.
export class PcmResampler {
  private samples: number[] = [];
  private position = 0;
  constructor(private inputRate: number, private outputRate: number) {}
  push(bytes: Buffer): Buffer {
    if (bytes.length % 2) throw Error("PCM audio must contain complete 16-bit samples");
    for (let n = 0; n < bytes.length; n += 2) this.samples.push(bytes.readInt16LE(n));
    const output: number[] = [], step = this.inputRate / this.outputRate;
    while (this.position + 1 < this.samples.length) {
      const i = Math.floor(this.position), f = this.position - i;
      output.push(Math.round(this.samples[i] * (1 - f) + this.samples[i + 1] * f)); this.position += step;
    }
    const consumed = Math.floor(this.position);
    this.samples = this.samples.slice(consumed); this.position -= consumed;
    const result = Buffer.alloc(output.length * 2);
    output.forEach((sample, i) => result.writeInt16LE(sample, i * 2));
    return result;
  }
}
export class PhoneMedia extends EventEmitter {
  readonly format: { type: "audio/pcm"; rate: number } | { type: "audio/pcmu" };
  readonly bytesPerMs: number;
  private streamSid = "";
  private started = false;
  private inbound = new PcmResampler(16000, 24000);
  private outbound = new PcmResampler(24000, 16000);
  private remainder: Buffer = Buffer.alloc(0);
  private tailMark: string | undefined;
  constructor(readonly socket: WebSocket, readonly r: Record, readonly config: VoiceConfig) {
    super();
    const vonage = config.provider === "vonage";
    this.format = vonage ? { type: "audio/pcm", rate: 24000 } : { type: "audio/pcmu" };
    this.bytesPerMs = vonage ? 48 : 8;
    socket.on("message", (raw, binary) => {
      try {
        if (vonage && binary) {
          if (!this.started) throw Error("Audio received before media connection");
          const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
          const audio = this.inbound.push(bytes);
          if (audio.length) this.emit("audio", audio.toString("base64"));
          return;
        }
        const m = JSON.parse(raw.toString());
        if (vonage) {
          if (m.event === "websocket:connected") {
            if (this.started || m["content-type"] !== "audio/l16;rate=16000" || m.callId !== r.request.callId) throw Error("Invalid Vonage media metadata or format");
            this.started = true; this.emit("start");
          } else if (m.event === "websocket:notify" && typeof m.payload?.mark === "string") this.emit("played", m.payload.mark);
        } else {
          if (m.event === "start") {
            if (this.started || !/^CA[a-f\d]{32}$/i.test(m.start?.callSid ?? "") || (r.sid && m.start.callSid !== r.sid) || m.start?.accountSid !== config.accountSid || m.start?.mediaFormat?.encoding !== "audio/x-mulaw" || m.start?.mediaFormat?.sampleRate !== 8000) throw Error("Invalid Twilio media identity or format");
            r.sid = m.start.callSid; this.streamSid = m.start.streamSid; this.started = true; this.emit("start");
          } else if (m.event === "media") {
            if (!this.started || m.streamSid !== this.streamSid || typeof m.media?.payload !== "string") throw Error("Invalid Twilio audio frame");
            this.emit("audio", m.media.payload);
          } else if (m.event === "mark") this.emit("played", m.mark?.name);
          else if (m.event === "stop") this.emit("stop");
        }
      } catch (error) { this.emit("fault", error instanceof Error ? error.message : "Malformed media event"); }
    });
    socket.on("error", () => this.emit("fault", "Telephone audio connection error"));
    socket.on("close", () => this.emit("stop"));
  }
  private send(data: object | Buffer) {
    if (this.socket.readyState !== WebSocket.OPEN) return;
    if (this.socket.bufferedAmount > 1024 * 1024) { this.emit("fault", "Telephone audio connection backpressure"); return; }
    this.socket.send(Buffer.isBuffer(data) ? data : JSON.stringify(data));
  }
  play(audio: string, mark: string) {
    if (this.config.provider === "twilio") {
      this.send({ event: "media", streamSid: this.streamSid, media: { payload: audio } });
      this.send({ event: "mark", streamSid: this.streamSid, mark: { name: mark } });
    } else {
      this.remainder = Buffer.concat([this.remainder, this.outbound.push(Buffer.from(audio, "base64"))]);
      while (this.remainder.length >= 640) {
        this.send(this.remainder.subarray(0, 640)); this.remainder = this.remainder.subarray(640);
      }
      // The acknowledgement covers the complete 20ms frames sent so far.
      this.tailMark = mark;
      this.send({ action: "notify", payload: { mark } });
    }
  }
  flush() {
    if (this.config.provider !== "vonage" || !this.remainder.length) return;
    const frame = Buffer.alloc(640); this.remainder.copy(frame); this.send(frame); this.remainder = Buffer.alloc(0);
    // The final acknowledgement must cover the final padded frame too.
    if (this.tailMark) this.send({ action: "notify", payload: { mark: `${this.tailMark}:tail` } });
    return this.tailMark ? `${this.tailMark}:tail` : undefined;
  }
  clear() {
    this.remainder = Buffer.alloc(0); this.tailMark = undefined; this.outbound = new PcmResampler(24000, 16000);
    this.send(this.config.provider === "vonage" ? { action: "clear" } : { event: "clear", streamSid: this.streamSid });
  }
  close() { this.socket.close(); }
}
