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
    
    // Send a ping to detect simulator type
    setInterval(() => {
      server.ping();
    }, 3000);
    
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
  
  onPong: (response) => {
    console.log(`🏓 Pong received! Simulator type: ${JSON.stringify(response)}`);
  },
  
  onAircraftData: (data) => {
    console.log(`\n📊 Aircraft Data:`);
    console.log(`  TITLE: ${data.TITLE}`);
    console.log(`  ICAO: ${data.ATC_MODEL}`);
    console.log(`  Altitude: ${data.PLANE_ALTITUDE?.toFixed(0)} ft`);
    console.log(`  Position: ${data.PLANE_LATITUDE?.toFixed(6)}°, ${data.PLANE_LONGITUDE?.toFixed(6)}°`);
    console.log(`  Airspeed indicated: ${data.AIRSPEED_INDICATED?.toFixed(0)} kts`);
    console.log(`  Heading true: ${data.PLANE_HEADING_DEGREES_TRUE?.toFixed(0)}°`);
    console.log(`  Vertical Speed: ${data.VERTICAL_SPEED?.toFixed(0)} fpm`);
    console.log(`  G Force: ${data.G_FORCE?.toFixed(2)} G`);
    console.log(`  On Ground: ${data.SIM_ON_GROUND ? 'Yes' : 'No'}`);
    console.log(`  Flaps Angle: ${data.TRAILING_EDGE_FLAPS_LEFT_ANGLE?.toFixed(1)}°`);
    console.log(`  Gear Position: ${data.GEAR_HANDLE_POSITION === 0 ? 'Down' : data.GEAR_HANDLE_POSITION === 1 ? 'Up' : 'Transitioning'}`);
    console.log(`  Lights: Nav ${data.LIGHT_NAV_ON ? 'On' : 'Off'}, Beacon ${data.LIGHT_BEACON_ON ? 'On' : 'Off'}, Strobe ${data.LIGHT_STROBE_ON ? 'On' : 'Off'}, Taxi ${data.LIGHT_TAXI_ON ? 'On' : 'Off'}, Landing ${data.LIGHT_LANDING_ON ? 'On' : 'Off'}`);
    console.log(`  FLAPS_HANDLE_INDEX: ${data.FLAPS_HANDLE_INDEX}`);
    console.log(`  TRAILING_EDGE_FLAPS_LEFT_ANGLE: ${data.TRAILING_EDGE_FLAPS_LEFT_ANGLE}`);
    console.log(`  TRAILING_EDGE_FLAPS_RIGHT_ANGLE: ${data.TRAILING_EDGE_FLAPS_RIGHT_ANGLE}`);
    console.log(`  GEAR_HANDLE_POSITION: ${data.GEAR_HANDLE_POSITION}`);
    console.log(`  GEAR_CENTER_POSITION: ${data.GEAR_CENTER_POSITION}`);
    console.log(`  GEAR_LEFT_POSITION: ${data.GEAR_LEFT_POSITION}`);
    console.log(`  GEAR_RIGHT_POSITION: ${data.GEAR_RIGHT_POSITION}`);
    console.log(`  SPOILERS_HANDLE_POSITION: ${data.SPOILERS_HANDLE_POSITION}`);
    
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
