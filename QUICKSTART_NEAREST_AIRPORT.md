# Nearest Airport - Quick Start Guide

Get up and running with the nearest airport feature in under 5 minutes!

## 🎯 What You'll Build

A simple application that:
1. Connects to Microsoft Flight Simulator via AviaConnector
2. Requests the nearest airport with all runway information
3. Displays distance, bearing, and runway details
4. Finds the best runway for landing based on aircraft heading

## 📋 Prerequisites

- Microsoft Flight Simulator 2020/2024 installed
- AviaConnector running (the C++ WebSocket bridge)
- Node.js 18+ installed
- Basic TypeScript knowledge

## ⚡ 60-Second Setup

### 1. Install the SDK

```bash
npm install @justkordy/avia-connector-sdk ws
npm install --save-dev @types/ws typescript
```

### 2. Create a Simple Server

Create `nearest-airport-demo.ts`:

```typescript
import { AviaConnectorServer } from "@justkordy/avia-connector-sdk";

// Start the WebSocket server
const server = new AviaConnectorServer({
  port: 8080,
  host: "0.0.0.0",
  autoPong: true
});

console.log("🚀 Server starting on ws://localhost:8080");

// Monitor simulator connection
server.on("Status", (status) => {
  if (status.code === "600") {
    console.log(`✅ Simulator connected: ${status.message}`);
    
    // Request nearest airport data once connected
    setTimeout(() => {
      server.broadcast({
        type: "request",
        data: { type: "NearestAirportData" }
      });
      console.log("📡 Requesting nearest airport data...");
    }, 2000);
  } else if (status.code === "601") {
    console.log(`❌ Simulator disconnected: ${status.message}`);
  }
});

// Handle nearest airport data
server.on("NearestAirportData", (data) => {
  console.log("\n" + "=".repeat(60));
  console.log(`🛬 NEAREST AIRPORT: ${data.airport.icao}`);
  console.log("=".repeat(60));
  console.log(`Name: ${data.airport.name}`);
  console.log(`Distance: ${data.distanceNM.toFixed(2)} NM`);
  console.log(`Bearing: ${data.bearing.toFixed(0)}°`);
  console.log(`Coordinates: ${data.airport.lat.toFixed(4)}, ${data.airport.lon.toFixed(4)}`);
  console.log(`Elevation: ${(data.airport.alt * 3.28084).toFixed(0)} ft MSL`);
  console.log(`\n✈️ Aircraft Position:`);
  console.log(`  Position: ${data.aircraftPosition.lat.toFixed(4)}, ${data.aircraftPosition.lon.toFixed(4)}`);
  console.log(`  Altitude: ${data.aircraftPosition.alt.toFixed(0)} ft`);
  console.log(`  Heading: ${data.aircraftPosition.heading.toFixed(0)}°`);
  
  console.log(`\n🛫 RUNWAYS (${data.airport.runways.length} total):`);
  data.airport.runways.forEach((runway, i) => {
    const lengthFt = (runway.length * 3.28084).toFixed(0);
    const widthFt = (runway.width * 3.28084).toFixed(0);
    console.log(`\n  ${i + 1}. Runway ${runway.number}`);
    console.log(`     Size: ${lengthFt} ft x ${widthFt} ft`);
    console.log(`     Heading: ${runway.heading.toFixed(0)}°`);
    console.log(`     Surface: ${getSurfaceName(runway.surface)}`);
    console.log(`     Lighting: ${runway.lighting > 0 ? "Yes" : "No"}`);
  });
  
  // Find best runway
  const bestRunway = findBestRunway(data.airport.runways, data.aircraftPosition.heading);
  if (bestRunway) {
    console.log(`\n⭐ RECOMMENDED RUNWAY: ${bestRunway.number}`);
    console.log(`   Heading difference: ${bestRunway.headingDiff.toFixed(0)}°`);
  }
  
  console.log("\n" + "=".repeat(60) + "\n");
});

// Helper: Get surface name
function getSurfaceName(code: number): string {
  const surfaces: { [key: number]: string } = {
    0: "Concrete", 1: "Grass", 2: "Water", 3: "Grass (Bumpy)",
    4: "Asphalt", 5: "Short Grass", 6: "Long Grass", 7: "Hard Turf",
    8: "Snow", 9: "Ice", 10: "Urban", 11: "Forest",
    12: "Dirt", 13: "Coral", 14: "Gravel"
  };
  return surfaces[code] || `Unknown (${code})`;
}

// Helper: Find best runway based on heading
function findBestRunway(runways: any[], aircraftHeading: number) {
  if (runways.length === 0) return null;
  
  let bestRunway = null;
  let smallestDiff = 360;
  
  for (const runway of runways) {
    // Check both runway ends
    const diff1 = Math.abs(normalizeHeading(runway.end1.heading - aircraftHeading));
    const diff2 = Math.abs(normalizeHeading(runway.end2.heading - aircraftHeading));
    
    const minDiff = Math.min(diff1, diff2);
    
    if (minDiff < smallestDiff) {
      smallestDiff = minDiff;
      bestRunway = {
        number: runway.number,
        heading: diff1 < diff2 ? runway.end1.heading : runway.end2.heading,
        headingDiff: minDiff
      };
    }
  }
  
  return bestRunway;
}

function normalizeHeading(heading: number): number {
  heading = heading % 360;
  if (heading > 180) heading -= 360;
  if (heading < -180) heading += 360;
  return heading;
}
```

### 3. Run It!

```bash
# Start the server
npx tsx nearest-airport-demo.ts

# Or with ts-node
npx ts-node nearest-airport-demo.ts
```

### 4. Connect AviaConnector

1. Open Microsoft Flight Simulator
2. Start a flight (any aircraft, any location)
3. Launch AviaConnector desktop app
4. Configure connection to `ws://localhost:8080`
5. Click "Connect"

### 5. See the Magic! ✨

You should see output like:

```
🚀 Server starting on ws://localhost:8080
✅ Simulator connected: MSFS
📡 Requesting nearest airport data...

============================================================
🛬 NEAREST AIRPORT: KJFK
============================================================
Name: John F Kennedy International Airport
Distance: 5.23 NM
Bearing: 287°
Coordinates: 40.6398, -73.7789
Elevation: 13 ft MSL

✈️ Aircraft Position:
  Position: 40.6500, -73.8000
  Altitude: 1500 ft
  Heading: 270°

🛫 RUNWAYS (4 total):

  1. Runway 04L/22R
     Size: 11351 ft x 197 ft
     Heading: 40°
     Surface: Asphalt
     Lighting: Yes

  2. Runway 04R/22L
     Size: 8400 ft x 150 ft
     Heading: 40°
     Surface: Asphalt
     Lighting: Yes

  3. Runway 13L/31R
     Size: 10000 ft x 150 ft
     Heading: 130°
     Surface: Concrete
     Lighting: Yes

  4. Runway 13R/31L
     Size: 14511 ft x 200 ft
     Heading: 130°
     Surface: Asphalt
     Lighting: Yes

⭐ RECOMMENDED RUNWAY: 04L/22R
   Heading difference: 10°

============================================================
```

## 🎮 Try These Scenarios

### Request on Interval

Add periodic requests:

```typescript
// Request nearest airport every 30 seconds
setInterval(() => {
  if (server.isSimulatorConnected()) {
    server.broadcast({
      type: "request",
      data: { type: "NearestAirportData" }
    });
  }
}, 30000);
```

### Filter by Runway Length

Only show runways suitable for your aircraft:

```typescript
const minRunwayLength = 5000; // feet

server.on("NearestAirportData", (data) => {
  const suitableRunways = data.airport.runways.filter(runway => {
    const lengthFt = runway.length * 3.28084;
    return lengthFt >= minRunwayLength;
  });
  
  console.log(`Found ${suitableRunways.length} suitable runways`);
});
```

### Find Airports with Specific Surface

```typescript
const CONCRETE = 0;
const ASPHALT = 4;

server.on("NearestAirportData", (data) => {
  const pavedRunways = data.airport.runways.filter(runway =>
    runway.surface === CONCRETE || runway.surface === ASPHALT
  );
  
  console.log(`${pavedRunways.length} paved runways available`);
});
```

## 📚 Next Steps

**Learn More:**
- Read [`NEAREST_AIRPORT.md`](./NEAREST_AIRPORT.md) for complete API documentation
- Check out the examples:
  - [`examples/server-nearest-airport.ts`](./examples/server-nearest-airport.ts) - Comprehensive server
  - [`examples/client-nearest-airport.ts`](./examples/client-nearest-airport.ts) - Interactive client

**Build Something Cool:**
- 🗺️ Create a moving map with nearest airports
- 📊 Build a runway analysis tool
- 🎯 Make an emergency landing advisor
- 📱 Develop a mobile companion app
- 🎮 Create a landing challenge game

**Enhance Your App:**
- Combine with weather data for runway recommendations
- Calculate crosswind components for each runway
- Show ILS/approach information (if available)
- Display fuel range circles with airports
- Alert when approaching destination airport

## 🐛 Troubleshooting

**No airport data received?**
- Ensure MSFS is running and you're loaded into a flight
- Check that you're not over ocean >200km from land
- Verify AviaConnector is connected to both MSFS and your server

**"Simulator not connected" error?**
- Make sure AviaConnector is running
- Check WebSocket connection settings
- Verify MSFS is fully loaded (not in menu)

**Wrong coordinates?**
- All coordinates are in decimal degrees
- Altitudes are in meters (multiply by 3.28084 for feet)
- Ensure aircraft position data is updating

**Empty runway list?**
- Some small airports may not have detailed runway data
- Try flying near a major airport (KJFK, EGLL, LFPG, etc.)

## 💡 Tips & Tricks

1. **Reality Bubble**: Nearest airport uses MSFS's ~200km radius cache
2. **Performance**: Don't request more than once every 10-30 seconds
3. **Accuracy**: Distance uses Haversine formula (great-circle)
4. **Units**: All distances in nautical miles, altitudes in feet for display
5. **Timing**: Allow 1-2 seconds for data to return from MSFS

## 🚀 Production Ready?

Before deploying:
- [ ] Add error handling for disconnections
- [ ] Implement reconnection logic
- [ ] Add logging for debugging
- [ ] Handle edge cases (no runways, no airports nearby)
- [ ] Add rate limiting for requests
- [ ] Implement data caching
- [ ] Add authentication if needed
- [ ] Monitor performance metrics

## 📞 Need Help?

- 📖 Full docs: [`NEAREST_AIRPORT.md`](./NEAREST_AIRPORT.md)
- 💻 Examples: [`examples/`](./examples/)
- 🐛 Issues: [GitHub Issues](https://github.com/JustKordy/AviaConnector/issues)

---

**Happy Flying! ✈️**
