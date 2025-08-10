export interface TransportOptions {
  url: string;
  protocols?: string | string[];
  wsImpl?: typeof WebSocket;
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  reconnectBackoffFactor?: number;
  idleTimeoutMs?: number;
}

type Listener = (...args: any[]) => void;

export class WebSocketTransport {
  private opts: Required<Omit<TransportOptions, "wsImpl" | "protocols">> & Pick<TransportOptions, "wsImpl" | "protocols">;
  private ws?: WebSocket;
  private closedByUser = false;
  private reconnectDelay: number;
  private lastMessageAt = 0;
  private idleTimer?: ReturnType<typeof setInterval>;
  private listeners: Record<string, Set<Listener>> = {};

  constructor(options: TransportOptions) {
    this.opts = {
      url: options.url,
      protocols: options.protocols,
      wsImpl: options.wsImpl,
      autoReconnect: options.autoReconnect ?? true,
      reconnectDelayMs: options.reconnectDelayMs ?? 1000,
      maxReconnectDelayMs: options.maxReconnectDelayMs ?? 15000,
      reconnectBackoffFactor: options.reconnectBackoffFactor ?? 1.8,
      idleTimeoutMs: options.idleTimeoutMs ?? 30000
    };
    this.reconnectDelay = this.opts.reconnectDelayMs;
  }

  on(event: "open" | "close" | "error" | "message" | "reconnect_attempt" | "reconnected" | "reconnect_failed", cb: Listener) {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event].add(cb);
    return () => this.off(event, cb);
  }

  off(event: string, cb: Listener) {
    this.listeners[event]?.delete(cb);
  }

  private emit(event: string, ...args: any[]) {
    this.listeners[event]?.forEach((cb) => {
      try {
        cb(...args);
      } catch (e) {
        console.error("[AviaConnector SDK] listener error", e);
      }
    });
  }

  connect() {
    this.closedByUser = false;
    this.open();
  }

  private getWebSocketCtor(): typeof WebSocket {
    if (this.opts.wsImpl) return this.opts.wsImpl as unknown as typeof WebSocket;
    // @ts-ignore
    if (typeof WebSocket !== "undefined") return WebSocket;
    throw new Error("No WebSocket implementation available. Provide wsImpl in options when using Node.js.");
  }

  private open() {
    const WS = this.getWebSocketCtor();
    this.ws = new WS(this.opts.url, this.opts.protocols as any);
    this.installHandlers(this.ws);
  }

  private installHandlers(ws: WebSocket) {
    ws.addEventListener?.("open", this.handleOpen);
    // @ts-ignore node ws uses 'on'
    if (!ws.addEventListener && (ws as any).on) {
      (ws as any).on("open", this.handleOpen);
    }
    const msgH = this.handleMessage as any;
    const errH = this.handleError as any;
    const closeH = this.handleClose as any;

    ws.addEventListener?.("message", msgH);
    (ws as any).on?.("message", msgH);

    ws.addEventListener?.("error", errH);
    (ws as any).on?.("error", errH);

    ws.addEventListener?.("close", closeH);
    (ws as any).on?.("close", closeH);
  }

  private handleOpen = () => {
    this.lastMessageAt = Date.now();
    this.scheduleIdleCheck();
    this.reconnectDelay = this.opts.reconnectDelayMs;
    this.emit("open");
  };

  private handleMessage = (ev: MessageEvent | any) => {
    this.lastMessageAt = Date.now();
    const data = (ev && ("data" in ev ? ev.data : ev)) ?? undefined;
    this.emit("message", data);
  };

  private handleError = (err: any) => {
    this.emit("error", err);
  };

  private handleClose = () => {
    this.clearIdleCheck();
    this.emit("close");
    if (!this.closedByUser && this.opts.autoReconnect) {
      this.emit("reconnect_attempt", this.reconnectDelay);
      setTimeout(() => {
        try {
          this.open();
          this.emit("reconnected");
          this.reconnectDelay = Math.min(
            this.opts.maxReconnectDelayMs,
            Math.floor(this.reconnectDelay * this.opts.reconnectBackoffFactor)
          );
        } catch (e) {
          this.emit("reconnect_failed", e);
        }
      }, this.reconnectDelay);
    }
  };

  private scheduleIdleCheck() {
    this.clearIdleCheck();
    this.idleTimer = setInterval(() => {
      if (!this.ws) return;
      if (Date.now() - this.lastMessageAt > this.opts.idleTimeoutMs) {
        try {
          this.ws.close();
        } catch {
          // ignore
        }
      }
    }, Math.min(5000, this.opts.idleTimeoutMs));
  }

  private clearIdleCheck() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = undefined;
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (!this.ws || (this as any).ws?.readyState !== 1) {
      throw new Error("WebSocket is not open");
    }
    (this.ws as any).send(data);
  }

  close(code?: number, reason?: string) {
    this.closedByUser = true;
    try {
      this.ws?.close(code, reason);
    } finally {
      this.ws = undefined;
      this.clearIdleCheck();
    }
  }
}