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

  AIRCRAFT_MODEL?: string; // ICAO code of the aircraft
  AIRCRAFT_TYPE?: string; // Full name of the aircraft

  G_FORCE?: number; // G force
  
  // Engine data
  GENERAL_ENG_RPM?: number; // RPM
  GENERAL_ENG_THROTTLE_LEVER_POSITION?: number; // percent (0-100)
  GENERAL_ENG_MIXTURE_LEVER_POSITION?: number; // percent (0-100)
  ENG_FUEL_FLOW_GPH?: number; // gallons per hour
  GENERAL_ENG_OIL_TEMPERATURE?: number; // °F
  GENERAL_ENG_OIL_PRESSURE?: number; // PSI
  
  // Additional flight data
  KOHLSMAN_SETTING_HG?: number; // inches of mercury
  WISKEY_COMPASS_INDICATION_DEGREES?: number; // degrees
  
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