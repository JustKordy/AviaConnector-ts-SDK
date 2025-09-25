import { WebSocketServer, WebSocket } from "ws";
import { defaultParseMessage } from "../protocol";
import {
  SimulatorStatusCodes,
  type ClientContext,
  type EventHandler,
  type EventMap,
  type EventName,
  type MessageEnvelope,
  type StatusData
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
  lastActivityTime?: number;
}

export class AviaConnectorServer {
  private wss: WebSocketServer;
  private parseMessage: Required<AviaConnectorServerOptions>["parseMessage"];
  private validateAuth?: AviaConnectorServerOptions["validateAuth"];
  private autoPong: boolean;
  private nextId = 1;
  private simulatorConnected: boolean = false;
  private simulatorType: string | null = null;

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
        
        // Block requests for simulator data when simulator is not connected
        if (env.type === "request" && env.data && typeof env.data === "object") {
          const requestData = env.data as any;
          if (requestData.type && 
              (requestData.type === "AircraftData" || 
               requestData.type === "Weather" || 
               requestData.type === "Landing" || 
               requestData.type === "Airport")) {
            
            if (!this.simulatorConnected) {
              ctx.send({ 
                type: "error", 
                data: { message: "Simulator isnt connected" }, 
                ts: Date.now() 
              });
              return;
            }
          }
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

  on<K extends keyof EventMap>(
  event: K,
  handler: EventMap[K]
): () => void {
  (this.listeners[event] ??= new Set()).add(handler as any);
  return () => this.off(event, handler as any);
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
    const data = env.data;
    const t = env.type as EventName;
    
    // Track simulator connection status - handle special Status messages
    if (t === "Status") {
      // Handle both formats that AviaConnector might send:
      // Format 1: { "type": "Status", "data": { "code": "600", "message": "MSFS" } }
      // Format 2: { "type": "Status", "data": { "code": "600" }, "message": "MSFS Connected" }
      
      // Extract status code and message from wherever they might be
      let statusCode: string | undefined;
      let statusMessage: string | undefined;
      
      if (data && typeof data === "object") {
        const statusData = data as any;
        statusCode = statusData.data.code;
        statusMessage = statusData.data.message;
        
        // If the message is not in the expected location, check if it's directly in the envelope
        if (!statusMessage && typeof (env as any).message === "string") {
          statusMessage = (env as any).message;
        }
      }
      
      // Process based on status code
      if (statusCode === SimulatorStatusCodes.MSFS_CONNECTED) {
        // Simulator connected
        this.simulatorConnected = true;
        this.simulatorType = statusMessage?.includes("MSFS") ? "MSFS" : statusMessage || "unknown";
        console.log(`[AviaConnectorServer] Simulator connected: ${this.simulatorType}`);
      } else if (statusCode === SimulatorStatusCodes.MSFS_DISCONNECTED) {
        // Simulator disconnected - code 601 indicates simulator exit
        this.simulatorConnected = false;
        console.log(`[AviaConnectorServer] Simulator disconnected: ${this.simulatorType || statusMessage || "unknown"}`);
        this.simulatorType = null;
      }
    }
    
    
    if (this.listeners[t]?.size) {
      // Pass only the payload data to handlers
      this.emit(t, data as any);
      
      // To support (payload, ctx) signature, call handlers manually:
      this.listeners[t]?.forEach((h) => {
        try {
          (h as EventHandler as any)(data, ctx);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[AviaConnectorServer] handler error", e);
        }
      });
    } else {
      this.emit("error", { message: "unhandled message", type: env.type, data: data, clientId: ctx.id });
    }
  }
  
  /**
   * Returns whether a simulator is currently connected
   */
  public isSimulatorConnected(): boolean {
    return this.simulatorConnected;
  }
  
  /**
   * Returns the type of simulator connected (e.g., "MSFS")
   */
  public getSimulatorType(): string | null {
    return this.simulatorType;
  }

  private safeSend(ws: WebSocket, payload: unknown, assumeString = false) {
    try {
      // Convert payload to string if it's not already
      const text = assumeString && typeof payload === "string" ? payload : JSON.stringify(payload);
      
      // Send the message
      ws.send(text);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[AviaConnectorServer] send error", e);
    }
  }
}