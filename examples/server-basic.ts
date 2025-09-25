// Run a local server your AviaConnector can connect to.
// Usage:
//   npm i ws
//   npx tsx examples/server-basic.ts
// Then point AviaConnector to ws://127.0.0.1:8765 (or your host/port).

import { AviaConnectorServer } from "../src/server/AviaConnectorServer";
import path from "path";
import fs from "fs";
import type { StatusData } from "../src/types";

// Use localhost (127.0.0.1) for compatibility with AviaConnector
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8765);

console.log(`Starting AviaConnector server on ${HOST}:${PORT}`);

// Create the server
const server = new AviaConnectorServer({
  host: HOST,
  port: PORT,
  
  // Enable automatic pong responses
  autoPong: true
});

// Track the active client ID
let activeID = 0;
// Track the data request intervals
const dataIntervals: Record<number, NodeJS.Timeout> = {};

// Connection handler
server.on("connection", (info: any) => {
  console.log("[server] connection:", info);
  
  // Set this as the active client
  activeID = info.id;
  
  // Start requesting data at regular intervals, but only send when simulator is connected
  dataIntervals[info.id] = setInterval(() => {
    if (activeID === info.id) {
      if (server.isSimulatorConnected()) {
        server.sendTo(info.id, { type: "request", data: { type: "AircraftData" } });
        console.log(`[server] Requesting data from ${server.getSimulatorType()} simulator (client ${info.id})`);
      } else {
        console.log(`[server] Simulator not connected, skipping data request`);
      }
    } else {
      // Clean up if this is no longer the active client
      clearInterval(dataIntervals[info.id]);
      delete dataIntervals[info.id];
    }
  }, 1000);
});

// Status handler for simulator connection/disconnection
server.on("Status", (info: StatusData) => {
  console.log("[server] status raw:", info);
  
  // Extract status code and message from where they might be
  const statusCode = info?.data?.code;
  const statusMessage = info?.data?.message;
  
  console.log(`[server] Parsed status: code=${statusCode}, message=${statusMessage}`);
  
  // Check if this is a simulator connection status message
  if (statusCode === "600") {
    console.log(`[server] Simulator connected: ${statusMessage || 'unknown'}`);
  }
  // Check if this is a simulator disconnection message (code 601)
  else if (statusCode === "601") {
    console.log(`[server] Simulator disconnected: ${statusMessage || 'unknown'}`);
  }
});

// The simulator disconnection is now handled by the Status handler with code 601

// Disconnect handler
server.on("disconnect", (info: any) => {
  console.log("[server] disconnect:", info);
  
  // Clean up interval if client disconnects
  if (dataIntervals[info.id]) {
    clearInterval(dataIntervals[info.id]);
    delete dataIntervals[info.id];
  }
  
  // Reset active ID if this was the active client
  if (activeID === info.id) {
    activeID = 0;
  }
});

// Error handler
server.on("error", (e: any) => {
  console.error("[server] error:", e);
});

// Error response handler
server.on("Error", (errorData: any) => {
  console.error("[server] Error response:", errorData.message);
  
  // Check if this is the "Simulator isn't connected" error
  if (errorData.message === "Simulator isnt connected") {
    console.log("[server] Cannot request data - simulator is not connected");
  }
});

// Aircraft data handler
server.on("AircraftData", (m) => {
  console.log("[airdata]", m.Aircraft?.PLANE_LATITUDE);
  console.log("[airdata]", m.Aircraft?.PLANE_LONGITUDE);
  console.log("[airdata]", m.Aircraft?.PLANE_ALTITUDE);
  console.log("[airdata]", m.Aircraft?.AIRSPEED_INDICATED);
  console.log("----");
  console.log("[airdata]", m.Aircraft?.AIRSPEED_TRUE);
  console.log("[airdata]", m.Aircraft?.VERTICAL_SPEED);
  console.log("[airdata]", m.Aircraft?.PLANE_HEADING_DEGREES_TRUE);
  console.log("[airdata]", m.Aircraft?.PLANE_PITCH_DEGREES);
  console.log("[airdata]", m.Aircraft?.PLANE_BANK_DEGREES);
  console.log("[airdata]", m.Aircraft?.SIM_ON_GROUND);
});

// Airport information handler
server.on("NearestAirport", (a: any) => {
  console.log("[airport]", a.icao, a.iata, a.name);
  if (a.runway) {
    console.log("[airport]", "Runway:", a.runway.id, a.runway.headingDeg, "deg", a.runway.lengthM, "m", a.runway.surface);
  }
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  
  // Clean up all intervals
  Object.values(dataIntervals).forEach(interval => clearInterval(interval));
  
  server.close();
  setTimeout(() => process.exit(0), 200);
});