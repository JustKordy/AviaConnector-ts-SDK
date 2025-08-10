export type ISO8601 = string;

export interface MessageEnvelope<T = unknown> {
  type: string;
  ts?: number; // unix epoch ms
  seq?: number;
  data?: T;
}

export type AviaEventType =
  | "flightData"
  | "landing"
  | "airport"
  | "weather"
  | "status"
  | "error"
  | "pong"
  | "heartbeat"
  | "raw";

export interface FlightData {
  simTime?: ISO8601;
  aircraft?: {
    name?: string;
    type?: string;
    icao?: string;
  };
  position?: {
    lat: number;
    lon: number;
    altFt?: number;
  };
  attitude?: {
    pitchDeg?: number;
    rollDeg?: number;
    headingDeg?: number;
  };
  speed?: {
    iasKts?: number;
    gsKts?: number;
    tasKts?: number;
    vsFpm?: number;
  };
  engine?: {
    n1Pct?: number;
    n2Pct?: number;
    throttlePct?: number;
    rpm?: number;
  };
}

export interface LandingAnalytics {
  rateOfDescentFpm?: number;
  gForce?: number;
  runwayId?: string;
  touchdown?: {
    lat: number;
    lon: number;
    distanceFromThresholdM?: number;
    lateralOffsetM?: number;
  };
}

export interface AirportRunwayInfo {
  icao?: string;
  iata?: string;
  name?: string;
  runway?: {
    id: string;
    headingDeg?: number;
    lengthM?: number;
    surface?: string;
  };
}

export interface WeatherData {
  wind?: {
    dirDeg?: number;
    speedKts?: number;
    gustKts?: number;
  };
  visibilityM?: number;
  temperatureC?: number;
  qnhHpa?: number;
  clouds?: string;
  metar?: string;
}

export interface EventMap {
  flightData: FlightData;
  landing: LandingAnalytics;
  airport: AirportRunwayInfo;
  weather: WeatherData;
  status: { message: string; code?: string | number };
  error: { message: string; code?: string | number; details?: unknown };
  pong: { ts?: number };
  heartbeat: { ts: number };
  raw: unknown;
}

export type EventName = keyof EventMap;
export type EventHandler<K extends EventName = EventName> = (payload: EventMap[K]) => void;