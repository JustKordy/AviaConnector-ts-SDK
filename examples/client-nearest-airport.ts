/**
 * Example: Client requesting Nearest Airport Data
 * 
 * This example shows how a client application can connect to AviaConnector
 * and request nearest airport information.
 */

import { WebSocket } from "ws";

const WS_URL = "ws://localhost:8765";

console.log("🔌 Connecting to AviaConnector...");
const ws = new WebSocket(WS_URL);

let simulatorConnected = false;

ws.on("open", () => {
  console.log("✅ Connected to AviaConnector");
  console.log("Waiting for simulator connection...\n");
});

ws.on("message", (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    switch (message.type) {
      case "Status":
        handleStatus(message);
        break;
        
      case "NearestAirportData":
        handleNearestAirportData(message.data);
        break;
        
      case "AircraftData":
        handleAircraftData(message.data);
        break;
        
      case "error":
      case "Error":
        console.error("❌ Error:", message.data?.message || message);
        break;
        
      case "pong":
        // Heartbeat response
        break;
        
      default:
        console.log("📨 Received:", message.type);
    }
  } catch (e) {
    console.error("Failed to parse message:", e);
  }
});

ws.on("close", () => {
  console.log("🔌 Disconnected from AviaConnector");
});

ws.on("error", (err) => {
  console.error("❌ WebSocket error:", err.message);
});

function handleStatus(message: any) {
  const statusData = message.data?.data;
  
  if (statusData?.code === "600") {
    simulatorConnected = true;
    console.log(`✈️  ${statusData.message || "Simulator connected"}`);
    console.log("\n📋 You can now request nearest airport data!\n");
    
    // Automatically request aircraft data first
    setTimeout(() => {
      requestAircraftData();
    }, 1000);
    
    // Then request nearest airport after a short delay
    setTimeout(() => {
      requestNearestAirport();
    }, 2000);
    
  } else if (statusData?.code === "601") {
    simulatorConnected = false;
    console.log("❌ Simulator disconnected");
  }
}

function handleAircraftData(data: any) {
  if (data.Aircraft) {
    const ac = data.Aircraft;
    console.log("\n✈️  ========== AIRCRAFT DATA ==========");
    console.log(`Position: ${ac.PLANE_LATITUDE?.toFixed(4)}°, ${ac.PLANE_LONGITUDE?.toFixed(4)}°`);
    console.log(`Altitude: ${ac.PLANE_ALTITUDE?.toFixed(0)} ft MSL`);
    console.log(`AGL: ${ac.PLANE_ALT_ABOVE_GROUND?.toFixed(0)} ft`);
    console.log(`Speed: ${ac.AIRSPEED_INDICATED?.toFixed(0)} KIAS`);
    console.log(`Heading: ${ac.PLANE_HEADING_DEGREES_TRUE?.toFixed(0)}°`);
    console.log(`On Ground: ${ac.SIM_ON_GROUND ? "Yes" : "No"}`);
    console.log("=====================================\n");
  }
}

function handleNearestAirportData(data: any) {
  if (!data) return;
  
  console.log("\n🛬 ========== NEAREST AIRPORT ==========");
  console.log(`Airport: ${data.airport.icao} - ${data.airport.name}`);
  console.log(`Distance: ${data.distanceNM.toFixed(2)} NM`);
  console.log(`Bearing: ${data.bearing.toFixed(0)}°`);
  console.log(`Coordinates: ${data.airport.lat.toFixed(4)}°, ${data.airport.lon.toFixed(4)}°`);
  console.log(`Elevation: ${data.airport.alt.toFixed(0)} m MSL (${(data.airport.alt * 3.28084).toFixed(0)} ft)`);
  
  console.log(`\n✈️  Your Position:`);
  console.log(`   ${data.aircraftPosition.lat.toFixed(4)}°, ${data.aircraftPosition.lon.toFixed(4)}°`);
  console.log(`   ${data.aircraftPosition.alt.toFixed(0)} ft @ ${data.aircraftPosition.heading.toFixed(0)}°`);
  
  if (data.airport.runways && data.airport.runways.length > 0) {
    console.log(`\n🛫 Runways (${data.airport.runways.length}):`);
    
    data.airport.runways.forEach((runway: any, idx: number) => {
      const lengthFt = (runway.length * 3.28084).toFixed(0);
      const widthFt = (runway.width * 3.28084).toFixed(0);
      
      console.log(`\n   ${idx + 1}. Runway ${runway.number}`);
      console.log(`      Length: ${runway.length}m (${lengthFt}ft)`);
      console.log(`      Width: ${runway.width}m (${widthFt}ft)`);
      console.log(`      Heading: ${runway.heading.toFixed(0)}°`);
      console.log(`      Surface: ${getSurfaceName(runway.surface)}`);
      
      if (runway.end1 && runway.end2) {
        console.log(`      ${runway.end1.number}: ${runway.end1.heading.toFixed(0)}° ← → ${runway.end2.number}: ${runway.end2.heading.toFixed(0)}°`);
      }
    });
    
    // Find best runway for approach based on aircraft heading
    const bestRunway = findBestRunwayForApproach(
      data.airport.runways,
      data.aircraftPosition.heading
    );
    
    if (bestRunway) {
      console.log(`\n   🎯 Best runway for approach: ${bestRunway.number}`);
      console.log(`      (${bestRunway.deviation.toFixed(0)}° heading difference)`);
    }
  } else {
    console.log("\n   No runway data available");
  }
  
  console.log("\n======================================\n");
}

function getSurfaceName(code: number): string {
  const surfaces: Record<number, string> = {
    0: "Concrete", 1: "Grass", 2: "Water", 3: "Grass Bumpy",
    4: "Asphalt", 5: "Short Grass", 6: "Long Grass", 7: "Hard Turf",
    8: "Snow", 9: "Ice", 12: "Dirt", 13: "Coral", 14: "Gravel"
  };
  return surfaces[code] || `Type ${code}`;
}

function findBestRunwayForApproach(runways: any[], aircraftHeading: number) {
  if (!runways || runways.length === 0) return null;
  
  let bestRunway = null;
  let bestDeviation = Infinity;
  
  for (const runway of runways) {
    // Check both ends
    const end1Dev = Math.abs(normalizeAngle(runway.end1.heading - aircraftHeading));
    const end2Dev = Math.abs(normalizeAngle(runway.end2.heading - aircraftHeading));
    
    const minDev = Math.min(end1Dev, end2Dev);
    
    if (minDev < bestDeviation) {
      bestDeviation = minDev;
      bestRunway = { ...runway, deviation: minDev };
    }
  }
  
  return bestRunway;
}

function normalizeAngle(angle: number): number {
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

// API Functions

function requestAircraftData() {
  if (!simulatorConnected) {
    console.log("⚠️  Simulator not connected");
    return;
  }
  
  console.log("📡 Requesting aircraft data...");
  ws.send(JSON.stringify({
    type: "request",
    data: { type: "AircraftData" },
    ts: Date.now()
  }));
}

function requestNearestAirport() {
  if (!simulatorConnected) {
    console.log("⚠️  Simulator not connected");
    return;
  }
  
  console.log("📡 Requesting nearest airport...");
  ws.send(JSON.stringify({
    type: "request",
    data: { type: "NearestAirportData" },
    ts: Date.now()
  }));
}

// Interactive CLI
console.log("\n📋 AviaConnector Client - Nearest Airport");
console.log("========================================");
console.log("\nCommands:");
console.log("  a - Request Aircraft Data");
console.log("  n - Request Nearest Airport");
console.log("  q - Quit\n");

// Handle keyboard input for interactive commands
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdin.on("data", (key: string) => {
  switch (key.toLowerCase()) {
    case "a":
      requestAircraftData();
      break;
    case "n":
      requestNearestAirport();
      break;
    case "q":
    case "\u0003": // Ctrl+C
      console.log("\n👋 Goodbye!");
      ws.close();
      process.exit(0);
      break;
    default:
      console.log(`Unknown command: ${key}`);
  }
});

// Send periodic heartbeats
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
  }
}, 30000);
