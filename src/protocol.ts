import type { MessageEnvelope, EventMap, EventName } from "./types";

/**
 * Default JSON parser: expects { type: string, data?: unknown, ts?, seq? }.
 * Replace by passing a custom parseMessage in client options to match the exact server protocol.
 */
export function defaultParseMessage(raw: string | ArrayBuffer | Buffer): MessageEnvelope {
  let text: string;
  if (typeof raw === "string") {
    text = raw;
  } else if (raw instanceof ArrayBuffer) {
    text = new TextDecoder().decode(new Uint8Array(raw));
  } else {
    // Node Buffer
    text = raw.toString("utf8");
  }

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

/**
 * Narrow an envelope to a typed event payload if type matches.
 */
export function narrowEvent<K extends EventName>(
  env: MessageEnvelope,
  type: K
): env is MessageEnvelope<EventMap[K]> & { type: K } {
  return env?.type === type;
}

/**
 * Narrow an envelope to a typed event AND guarantees data is present (non-null/undefined).
 */
export function narrowEventWithData<K extends EventName>(
  env: MessageEnvelope,
  type: K
): env is MessageEnvelope<NonNullable<EventMap[K]>> & { type: K; data: NonNullable<EventMap[K]> } {
  return env?.type === type && env?.data != null;
}