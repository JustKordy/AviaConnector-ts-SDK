import { WebSocketServer, WebSocket } from "ws";
import { defaultParseMessage } from "../protocol";
import type {
  ClientContext,
  EventHandler,
  EventMap,
  EventName,
  MessageEnvelope
} from "../types";

export interface AviaConnectorServerOptions {
  port: number;
  host?: string; // default 0.0.0.0
  path?: string; // optional ws path
  // If provided, require an auth message: { type: "auth", token }
  validateAuth?: (token: string | undefined, ctx: Omit<ClientContext, "send" | "subscribe" | "unsubscribe" | "close">) => boolean;
  parseMessage?: (raw: any) => MessageEnvelope;
  // When true, server responds to {type:"ping"} with {type:"pong"}
  autoPong?: boolean;
}

type ServerEvent = "connection" | "disconnect" | "error" | "listening";

type AnyHandler = (...args: any[]) => void;

interface ClientRec {
  ws: WebSocket;
  authed: boolean;
  subs: Set<string>;
  remote?: string | null;
}

export class AviaConnectorServer {
  private wss: WebSocketServer;
  private parseMessage: Required<AviaConnectorServerOptions>["parseMessage"];
  private validateAuth?: AviaConnectorServerOptions["validateAuth"];
  private autoPong: boolean;
  private nextId = 1;

  private clients = new Map<number, ClientRec>();

  private listeners: {
    [K in EventName | ServerEvent]?: Set<AnyHandler>;
  } = {};

  constructor(opts: AviaConnectorServerOptions) {
    this.parseMessage = opts.parseMessage ?? defaultParseMessage;
    this.validateAuth = opts.validateAuth;
    this.autoPong = opts.autoPong ?? true;

    this.wss = new WebSocketServer({
      host: opts.host ?? "0.0.0.0",
      port: opts.port,
      path: opts.path
    });

    this.wss.on("listening", () => {
      this.emit("listening", { url: `ws://${opts.host ?? "0.0.0.0"}:${opts.port}${opts.path ?? ""}` });
    });

    this.wss.on("connection", (ws, req) => {
      const id = this.nextId++;
      const remote = req.socket.remoteAddress;
      const rec: ClientRec = {
        ws,
        authed: this.validateAuth ? false : true,
        subs: new Set(),
        remote
      };
      this.clients.set(id, rec);

      this.emit("connection", { id, remote });

      const ctx = this.makeCtx(id, rec);

      ws.on("message", (raw) => {
        const env = this.parseMessage(raw);
        if (!rec.authed) {
          if (env.type === "auth") {
            const token = (typeof env.data === "object" && env.data) ? (env as any).data?.token ?? (env as any).token : undefined;
            const ok = this.validateAuth?.(token, { id, remoteAddress: rec.remote ?? null, subs: rec.subs }) ?? false;
            if (ok) {
              rec.authed = true;
              ctx.send({ type: "status", data: { message: "auth ok" }, ts: Date.now() });
            } else {
              ctx.send({ type: "error", data: { message: "auth failed" }, ts: Date.now() });
              ws.close(1008, "auth failed");
            }
            return;
          }
          ctx.send({ type: "error", data: { message: "unauthenticated" }, ts: Date.now() });
          return;
        }

        // Built-ins
        if (env.type === "subscribe") {
          const stream = (env as any)?.data?.stream;
          if (typeof stream === "string") rec.subs.add(stream);
          ctx.send({ type: "status", data: { message: `subscribed ${stream}` }, ts: Date.now() });
          return;
        }
        if (env.type === "unsubscribe") {
          const stream = (env as any)?.data?.stream;
          if (typeof stream === "string") rec.subs.delete(stream);
          ctx.send({ type: "status", data: { message: `unsubscribed ${stream}` }, ts: Date.now() });
          return;
        }
        if (env.type === "ping" && this.autoPong) {
          ctx.send({ type: "pong", ts: (env as any).ts ?? Date.now() });
          return;
        }

        // Route typed events to user handlers
        this.route(env, ctx);
      });

      ws.on("close", (code, reason) => {
        this.clients.delete(id);
        this.emit("disconnect", { id, code, reason: reason?.toString() });
      });

      ws.on("error", (err) => {
        this.emit("error", { id, error: err });
      });
    });

    this.wss.on("error", (err) => {
      this.emit("error", { error: err });
    });
  }

  // Public API

  on<K extends EventName | ServerEvent>(event: K, handler: AnyHandler): () => void {
    (this.listeners[event] ??= new Set()).add(handler);
    return () => this.off(event, handler);
  }

  off<K extends EventName | ServerEvent>(event: K, handler: AnyHandler) {
    this.listeners[event]?.delete(handler);
  }

  /**
   * Broadcast any payload to all connected clients (no subscription check).
   */
  broadcast(payload: unknown) {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    for (const { ws } of this.clients.values()) {
      this.safeSend(ws, text, true);
    }
  }

  /**
   * Emit a typed event to subscribed clients.
   * Example: server.push("weather", { wind: { dirDeg: 180, speedKts: 12 } })
   */
  push<K extends EventName>(event: K, data: EventMap[K]) {
    const payload = JSON.stringify({ type: event, ts: Date.now(), data });
    for (const { ws, subs } of this.clients.values()) {
      if (subs.has(event)) this.safeSend(ws, payload, true);
    }
  }

  /**
   * Send a payload to a specific client id (ignores subscriptions).
   */
  sendTo(clientId: number, payload: unknown) {
    const client = this.clients.get(clientId);
    if (!client) return;
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    this.safeSend(client.ws, text, true);
  }

  /**
   * Close the server.
   */
  close() {
    this.wss.close();
  }

  // Internals

  private emit(event: EventName | ServerEvent, payload: any) {
    this.listeners[event]?.forEach((h) => {
      try {
        (h as any)(payload);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[AviaConnectorServer] listener error", e);
      }
    });
  }

  private makeCtx(id: number, rec: ClientRec): ClientContext {
    return {
      id,
      remoteAddress: rec.remote ?? null,
      subs: rec.subs,
      send: (payload: unknown) => {
        const text = typeof payload === "string" ? payload : JSON.stringify(payload);
        this.safeSend(rec.ws, text, true);
      },
      subscribe: (stream: string) => rec.subs.add(stream),
      unsubscribe: (stream: string) => rec.subs.delete(stream),
      close: (code?: number, reason?: string) => rec.ws.close(code, reason)
    };
  }

  private route(env: MessageEnvelope, ctx: ClientContext) {
    const t = env.type as EventName;
    if (this.listeners[t]?.size) {
      // Pass only the payload data to handlers
      this.emit(t, env.data as any, /* ctx is passed via emit call below when binding */);
      // To support (payload, ctx) signature, call handlers manually:
      this.listeners[t]?.forEach((h) => {
        try {
          (h as EventHandler as any)(env.data, ctx);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[AviaConnectorServer] handler error", e);
        }
      });
    } else {
      this.emit("error", { message: "unhandled message", type: env.type, data: env.data, clientId: ctx.id });
    }
  }

  private safeSend(ws: WebSocket, payload: unknown, assumeString = false) {
    try {
      const text = assumeString && typeof payload === "string" ? payload : JSON.stringify(payload);
      ws.send(text);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[AviaConnectorServer] send error", e);
    }
  }
}