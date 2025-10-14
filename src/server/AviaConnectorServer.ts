import { WebSocketServer, WebSocket } from "ws";
import type { AircraftData, MessageEnvelope, SimulatorStatus, PongResponse } from "../types";

export interface AviaConnectorServerOptions {
  port: number;
  host?: string;
  path?: string;
  
  /**
   * Callback when server starts listening
   */
  onListening?: (url: string) => void;
  
  /**
   * Callback when client connects
   */
  onConnection?: () => void;
  
  /**
   * Callback when client disconnects
   */
  onDisconnect?: () => void;
  
  /**
   * Callback when aircraft data is received
   */
  onAircraftData?: (data: AircraftData) => void;
  
  /**
   * Callback when simulator connection status changes
   */
  onSimulatorStatus?: (status: SimulatorStatus) => void;
  
  /**
   * Callback when pong response is received
   */
  onPong?: (response: PongResponse) => void;
  
  /**
   * Callback for errors
   */
  onError?: (error: Error) => void;
}

/**
 * Simplified AviaConnector WebSocket Server
 * - Single client only
 * - Only handles aircraft data
 * - Simple callback-based API
 */
export class AviaConnectorServer {
  private wss: WebSocketServer;
  private client?: WebSocket;
  private simulatorStatus: SimulatorStatus = { connected: false };
  
  // Callbacks
  private readonly onListening?: (url: string) => void;
  private readonly onConnection?: () => void;
  private readonly onDisconnect?: () => void;
  private readonly onAircraftData?: (data: AircraftData) => void;
  private readonly onSimulatorStatus?: (status: SimulatorStatus) => void;
  private readonly onPong?: (response: PongResponse) => void;
  private readonly onError?: (error: Error) => void;

  constructor(opts: AviaConnectorServerOptions) {
    this.onListening = opts.onListening;
    this.onConnection = opts.onConnection;
    this.onDisconnect = opts.onDisconnect;
    this.onAircraftData = opts.onAircraftData;
    this.onSimulatorStatus = opts.onSimulatorStatus;
    this.onPong = opts.onPong;
    this.onError = opts.onError;

    const host = opts.host ?? "0.0.0.0";
    const port = opts.port;
    const path = opts.path;

    this.wss = new WebSocketServer({ host, port, path });

    this.wss.on("listening", () => {
      const url = `ws://${host}:${port}${path ?? ""}`;
      this.onListening?.(url);
    });

    this.wss.on("connection", (ws) => {
      // Only support single client - close existing if new one connects
      if (this.client) {
        this.client.close(1000, "New client connected");
      }
      
      this.client = ws;
      this.onConnection?.();

      ws.on("message", (raw) => {
        try {
          const message = this.parseMessage(raw);
          this.handleMessage(message);
        } catch (err) {
          this.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      });

      ws.on("close", () => {
        if (this.client === ws) {
          this.client = undefined;
          this.onDisconnect?.();
        }
      });

      ws.on("error", (err) => {
        this.onError?.(err);
      });
    });

    this.wss.on("error", (err) => {
      this.onError?.(err);
    });
  }

  /**
   * Parse raw WebSocket message to JSON
   */
  private parseMessage(raw: any): MessageEnvelope {
    // Convert Buffer/ArrayBuffer to string
    let text: string;
    
    if (typeof raw === "string") {
      text = raw;
    } else if (Buffer.isBuffer(raw)) {
      text = raw.toString("utf8");
    } else if (raw instanceof ArrayBuffer) {
      text = Buffer.from(raw).toString("utf8");
    } else if (Array.isArray(raw)) {
      const buffers = raw.map(item => Buffer.isBuffer(item) ? item : Buffer.from(item));
      text = Buffer.concat(buffers).toString("utf8");
    } else {
      text = String(raw);
    }
    
    // Parse JSON
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj.type === "string") {
        return obj as MessageEnvelope;
      }
      return { type: "unknown", data: obj };
    } catch {
      return { type: "unknown", data: text };
    }
  }

  /**
   * Handle incoming messages from AviaConnector
   */
  private handleMessage(message: MessageEnvelope) {
    const { type, data } = message;
    
    // Handle aircraft data
    if (type === "AircraftData") {
      if (!data) return;
      
      // Extract aircraft data (handle both nested and flat formats)
      const aircraftData: AircraftData = (data as any).Aircraft ?? data;
      this.onAircraftData?.(aircraftData);
    }
    
    // Handle simulator status
    else if (type === "Status") {
      if (!data) return;
      
      // Extract status code and message (handle nested format)
      const statusData = (data as any).data ?? data;
      const code = statusData.code;
      const message = statusData.message;
      
      // Update simulator status
      if (code === "600") {
        // Simulator connected
        this.simulatorStatus = {
          connected: true,
          simulator: this.detectSimulator(message)
        };
        this.onSimulatorStatus?.(this.simulatorStatus);
      } else if (code === "601") {
        // Simulator disconnected
        this.simulatorStatus = { connected: false };
        this.onSimulatorStatus?.(this.simulatorStatus);
      }
    }
    
    // Handle pong response
    else if (type === "pong") {
      if (!data) return;
      const pongData = data as PongResponse;
      this.onPong?.(pongData);
    }
    
    // Handle errors
    else if (type === "Error" || type === "error") {
      const errorMsg = typeof data === "string" ? data : (data as any)?.message ?? "Unknown error";
      this.onError?.(new Error(errorMsg));
    }
  }

  /**
   * Detect simulator type from status message
   */
  private detectSimulator(message?: string): "MSFS" | "P3D" | "X-Plane" | "Unknown" {
    if (!message) return "Unknown";
    
    const msg = message.toLowerCase();
    if (msg.includes("msfs")) return "MSFS";
    if (msg.includes("p3d") || msg.includes("prepar3d")) return "P3D";
    if (msg.includes("x-plane") || msg.includes("xplane")) return "X-Plane";
    
    return "Unknown";
  }

  /**
   * Send data to the connected client
   */
  send(data: any): boolean {
    if (!this.client || this.client.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    try {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      this.client.send(message);
      return true;
    } catch (err) {
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }

  /**
   * Request aircraft data from AviaConnector
   */
  requestAircraftData(): boolean {
    return this.send({
      type: "request",
      data: { type: "AircraftData" },
      ts: Date.now()
    });
  }

  /**
   * Send a ping request to AviaConnector
   * Response will be received via onPong callback
   */
  ping(): boolean {
    return this.send({
      type: "ping"
    });
  }

  /**
   * Get current simulator connection status
   */
  getSimulatorStatus(): SimulatorStatus {
    return { ...this.simulatorStatus };
  }

  /**
   * Check if simulator is connected
   */
  isSimulatorConnected(): boolean {
    return this.simulatorStatus.connected;
  }

  /**
   * Check if client is connected
   */
  isClientConnected(): boolean {
    return this.client !== undefined && this.client.readyState === WebSocket.OPEN;
  }

  /**
   * Close the server and disconnect all clients
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.close(1000, "Server closing");
        this.client = undefined;
      }
      
      this.wss.close(() => {
        resolve();
      });
    });
  }
}