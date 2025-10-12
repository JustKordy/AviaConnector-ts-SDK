import { AviaConnectorServer } from "../src/server/AviaConnectorServer";

// Create a simple server that listens for aircraft data
const server = new AviaConnectorServer({
  port: 8765,
  host: "0.0.0.0",
  
  onListening: (url) => {
    console.log(`✈️  AviaConnector Server listening on ${url}`);
    console.log(`Waiting for AviaConnector to connect...`);
  },
  
  onConnection: () => {
    console.log(`✅ AviaConnector connected!`);
    
    // Request aircraft data every second
    setInterval(() => {
      if (server.isSimulatorConnected()) {
        server.requestAircraftData();
      }
    }, 1000);
  },
  
  onDisconnect: () => {
    console.log(`❌ AviaConnector disconnected`);
  },
  
  onSimulatorStatus: (status) => {
    if (status.connected) {
      console.log(`🎮 Simulator connected: ${status.simulator}`);
    } else {
      console.log(`🎮 Simulator disconnected`);
    }
  },
  
  onAircraftData: (data) => {
    console.log(`\n📊 Aircraft Data:`);
    console.log(`  TITLE: ${data.AIRCRAFT_MODEL}`);
    console.log(`  ICAO: ${data.AIRCRAFT_TYPE}`);
    console.log(`  Altitude: ${data.PLANE_ALTITUDE?.toFixed(0)} ft`);
    console.log(`  Position: ${data.PLANE_LATITUDE?.toFixed(6)}°, ${data.PLANE_LONGITUDE?.toFixed(6)}°`);
    console.log(`  Airspeed indicated: ${data.AIRSPEED_INDICATED?.toFixed(0)} kts`);
    console.log(`  Heading true: ${data.PLANE_HEADING_DEGREES_TRUE?.toFixed(0)}°`);
    console.log(`  Vertical Speed: ${data.VERTICAL_SPEED?.toFixed(0)} fpm`);
    console.log(`  G Force: ${data.G_FORCE?.toFixed(2)} G`);
    console.log(`  On Ground: ${data.SIM_ON_GROUND ? 'Yes' : 'No'}`);
  },
  
  onError: (error) => {
    console.error(`❌ Error: ${error.message}`);
  }
});

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\n\nShutting down server...');
  await server.close();
  process.exit(0);
});
