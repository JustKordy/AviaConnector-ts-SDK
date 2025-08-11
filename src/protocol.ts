import type { MessageEnvelope } from "./types";

// Convert ws RawData (Buffer | ArrayBuffer | Buffer[] | string) to string
function rawToString(raw: any): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return Buffer.concat(raw.map((b) => Buffer.isBuffer(b) ? b : Buffer.from(b))).toString("utf8");
  }
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString("utf8");
  return String(raw);
}

export function defaultParseMessage(raw: any): MessageEnvelope {
  const text = rawToString(raw);
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj.type === "string") {
      return obj as MessageEnvelope;
    }
    return { type: "raw", data: obj };
  } catch {
    return { type: "raw", data: text };
  }
}