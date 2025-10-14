/**
 * Message envelope for WebSocket communication
 */
export interface MessageEnvelope<T = unknown> {
  type: string;
  ts?: number;
  data?: T;
}

/**
 * Aircraft data from flight simulator
 * All properties are optional and can be extended as needed
 */
export interface AircraftData {
  // Core flight parameters
  PLANE_ALTITUDE?: number; // feet MSL
  PLANE_LATITUDE?: number; // degrees
  PLANE_LONGITUDE?: number; // degrees
  PLANE_ALT_ABOVE_GROUND?: number; // feet AGL
  AIRSPEED_INDICATED?: number; // knots IAS
  AIRSPEED_TRUE?: number; // knots TAS
  GROUND_VELOCITY?: number; // knots
  VERTICAL_SPEED?: number; // feet per minute
  PLANE_HEADING_DEGREES_TRUE?: number; // degrees (0-360)
  PLANE_HEADING_DEGREES_MAGNETIC?: number; // degrees (0-360)
  PLANE_PITCH_DEGREES?: number; // degrees (-90 to +90)
  PLANE_BANK_DEGREES?: number; // degrees (-180 to +180)
  SIM_ON_GROUND?: boolean;
  
  G_FORCE?: number; // G force

  TITLE?: string; // Aircraft title/name
  ATC_MODEL?: string; // ATC model
  LIGHT_NAV_ON?: boolean; // Navigation lights
  LIGHT_BEACON_ON?: boolean; // Beacon lights
  LIGHT_STROBE_ON?: boolean; // Strobe lights
  LIGHT_TAXI_ON?: boolean;  // Taxi lights
  LIGHT_LANDING_ON?: boolean; // Landing lights
  FLAPS_HANDLE_INDEX?: number; // Flaps handle position index
  TRAILING_EDGE_FLAPS_LEFT_ANGLE?: number;  // degrees
  TRAILING_EDGE_FLAPS_RIGHT_ANGLE?: number; // degrees
  GEAR_HANDLE_POSITION?: number; // 0=down, 1=up
  GEAR_CENTER_POSITION?: number; // 0=down, 1=up
  GEAR_LEFT_POSITION?: number; // 0=down, 1=up
  GEAR_RIGHT_POSITION?: number; // 0=down, 1=up
  SPOILERS_HANDLE_POSITION?: number; // 0=down, 1=up
  
  // Engine data
  /* GENERAL_ENG_RPM?: number; // RPM
  GENERAL_ENG_THROTTLE_LEVER_POSITION?: number; // percent (0-100)
  GENERAL_ENG_MIXTURE_LEVER_POSITION?: number; // percent (0-100)
  ENG_FUEL_FLOW_GPH?: number; // gallons per hour
  GENERAL_ENG_OIL_TEMPERATURE?: number; // °F
  GENERAL_ENG_OIL_PRESSURE?: number; // PSI
  
  // Additional flight data
  KOHLSMAN_SETTING_HG?: number; // inches of mercury
  WISKEY_COMPASS_INDICATION_DEGREES?: number; // degrees
  */
  // Extensible: Add any additional properties as needed
  [key: string]: number | boolean | string | undefined;
}

/**
 * Simulator connection status
 */
export interface SimulatorStatus {
  connected: boolean;
  simulator?: "MSFS" | "P3D" | "X-Plane" | string;
}
/**
 * Pong response data from ping request
 */
export interface PongResponse {
 payload: {
   simulator: 'MSFS' | 'P3DV5' | string;
 }
}
