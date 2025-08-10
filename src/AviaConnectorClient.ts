import { WebSocketTransport, type TransportOptions } from "./transport";
import { defaultParseMessage, narrowEvent, narrowEventWithData } from "./protocol";
import type {
  MessageEnvelope,
  EventMap,
  EventName,
  EventHandler
} from "./types";

export interface AviaConnectorClientOptions extends Omit<TransportOptions, "url"> {
  url: string;
  /**
   * Optional bearer token or any string used by your deployment.
   * If provided, the client will send an auth message after open using composeAuthMessage.
   */
  token?: string;
  /**
   * Customize how incoming raw frames are parsed to an envelope.
   * Default expects JSON: {type, data, ts?, seq?}
   */
  parseMessage?: (raw: string | ArrayBuffer | Buffer) => MessageEnvelope;
  /**
   * Customize the initial auth message sent on open.
   */
  composeAuthMessage?: (token: string) => unknown;
  /**
   * Application-level heartbeat: send every n ms to keep the connection warm (if your server expects it).
   * If not provided, no heartbeat is sent.
   */
  heartbeatIntervalMs?: number;
  /**
   * Customize heartbeat payload.
   */
  composeHeartbeat?: () => unknown;
}

export class AviaConnectorClient {
  private transport: WebSocketTransport;

  // Store as uniform Set<EventHandler<any>> to avoid mapped-type assignment issues,
  // and cast at the usage sites for type safety at the API boundary.
  private listeners: Partial<{ [K in EventName]: Set<EventHandler<any>> }> = {};

  private parseMessage: Required<AviaConnectorClientOptions>["parseMessage"];
  private composeAuthMessage: Required<AviaConnectorClientOptions>["composeAuthMessage"];
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private opts: AviaConnectorClientOptions;

  constructor(options: AviaConnectorClientOptions) {
    this.opts = options;
    this.transport = new WebSocketTransport({
      url: options.url,
      protocols: options.protocols,
      wsImpl: options.wsImpl,
      autoReconnect: options.autoReconnect,
      reconnectDelayMs: options.reconnectDelayMs,
      maxReconnectDelayMs: options.maxReconnectDelayMs,
      reconnectBackoffFactor: options.reconnectBackoffFactor,
      idleTimeoutMs: options.idleTimeoutMs
    });

    this.parseMessage = options.parseMessage ?? defaultParseMessage;
    this.composeAuthMessage = options.composeAuthMessage ?? ((token: string) => ({ type: "auth", token }));

    this.transport.on("open", () => {
      if (this.opts.token) {
        this.safeSend(this.composeAuthMessage(this.opts.token));
      }
      if (this.opts.heartbeatIntervalMs) {
        this.startHeartbeat();
      }
      this.emit("status", { message: "connected" });
    });

    this.transport.on("message", (raw) => {
      const env = this.parseMessage(raw);
      this.route(env);
    });

    this.transport.on("error", (err) => {
      this.emit("error", { message: "transport error", details: err });
    });

    this.transport.on("close", () => {
      this.stopHeartbeat();
      this.emit("status", { message: "disconnected" });
    });

    this.transport.on("reconnect_attempt", (delay: number) => {
      this.emit("status", { message: `reconnecting in ${delay}ms` });
    });

    this.transport.on("reconnected", () => {
      this.emit("status", { message: "reconnected" });
      if (this.opts.token) {
        this.safeSend(this.composeAuthMessage(this.opts.token));
      }
      if (this.opts.heartbeatIntervalMs && !this.heartbeatInterval) {
        this.startHeartbeat();
      }
    });
  }

  connect() {
    this.transport.connect();
  }

  disconnect(code?: number, reason?: string) {
    this.stopHeartbeat();
    this.transport.close(code, reason);
  }

  /**
   * Send a request/command to the server.
   * For example: client.send({ type: "subscribe", data: { stream: "flightData" } })
   */
  send(payload: unknown) {
    this.safeSend(payload);
  }

  /**
   * Subscribe to strongly-typed events like flightData, landing, airport, weather.
   */
  on<K extends EventName>(event: K, handler: EventHandler<K>) {
    const set = (this.listeners[event] ??= new Set()) as Set<EventHandler<K>>;
    set.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends EventName>(event: K, handler: EventHandler<K>) {
    const set = this.listeners[event] as Set<EventHandler<K>> | undefined;
    set?.delete(handler);
  }

  once<K extends EventName>(event: K, handler: EventHandler<K>) {
    const off = this.on(event, ((data: any) => {
      off();
      (handler as any)(data);
    }) as EventHandler<K>);
    return off;
  }

  /**
   * Convenience helpers for common patterns (optional).
   */
  subscribe(stream: "flightData" | "landing" | "airport" | "weather") {
    this.send({ type: "subscribe", data: { stream } });
  }

  unsubscribe(stream: "flightData" | "landing" | "airport" | "weather") {
    this.send({ type: "unsubscribe", data: { stream } });
  }

  private startHeartbeat() {
    if (!this.opts.heartbeatIntervalMs) return;
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      const payload = this.opts.composeHeartbeat?.() ?? { type: "ping", ts: Date.now() };
      this.safeSend(payload);
      // Let applications listen for local heartbeat tick if desired
      this.emit("heartbeat", { ts: Date.now() });
    }, this.opts.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = undefined;
  }

  private safeSend(payload: unknown) {
    try {
      const text = typeof payload === "string" ? payload : JSON.stringify(payload);
      this.transport.send(text);
    } catch (e) {
      this.emit("error", { message: "send failed", details: e });
    }
  }

  private route(env: MessageEnvelope) {
    // If server replies with pong/heartbeat, surface as events
    if (env.type === "pong") {
      this.emit("pong", { ts: typeof env.ts === "number" ? env.ts : Date.now() });
      return;
    }

    // Route known/typed events; ensure data is present
    if (narrowEventWithData(env, "flightData")) {
      this.emit("flightData", env.data);
      return;
    }
    if (narrowEventWithData(env, "landing")) {
      this.emit("landing", env.data);
      return;
    }
    if (narrowEventWithData(env, "airport")) {
      this.emit("airport", env.data);
      return;
    }
    if (narrowEventWithData(env, "weather")) {
      this.emit("weather", env.data);
      return;
    }
    if (narrowEventWithData(env, "status")) {
      this.emit("status", env.data);
      return;
    }
    if (narrowEventWithData(env, "error")) {
      this.emit("error", env.data);
      return;
    }

    // Fallback: emit raw envelope when type is unknown or data is missing
    this.emit("raw", env);
  }

  private emit<K extends EventName>(event: K, payload: EventMap[K]) {
    const set = this.listeners[event] as Set<EventHandler<K>> | undefined;
    set?.forEach((handler) => {
      try {
        (handler as any)(payload);
      } catch (e) {
        // swallow
        console.error("[AviaConnector SDK] user listener error", e);
      }
    });
  }
}