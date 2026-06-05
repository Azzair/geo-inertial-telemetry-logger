/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TelemetryRecord {
  timestamp: number; // millisecond timestamp from recording start
  absTime: number; // absolute unix epoch millisecond timestamp
  formattedTime: string; // HH:mm:ss.SSS

  // GPS Raw & Filtered
  gpsLat: number | null;
  gpsLon: number | null;
  gpsAlt: number | null; // Altitude in meters
  gpsSpeed: number; // m/s from GPS speed or calculated
  gpsDistance: number; // meters accumulated
  gpsAccel: number; // m/s² calculated from GPS speed derivative

  // Raw & Filtered IMU Sensors
  accelX: number; // m/s²
  accelY: number; // m/s²
  accelZ: number; // m/s²
  accelXRaw: number;
  accelYRaw: number;
  accelZRaw: number;
  accelRawMag: number;

  gyroX: number; // rad/s
  gyroY: number; // rad/s
  gyroZ: number; // rad/s
  gyroXRaw: number;
  gyroYRaw: number;
  gyroZRaw: number;

  // Weather & Environment parameters updated once per minute
  temp: number; // °C
  pressure: number | null; // hPa
  humidity: number | null; // %
  windSpeed: number | null; // m/s
  windDir: number | null; // degrees

  // IMU Integrated calculations (separately calculated)
  calcSpeedIMU: number; // m/s, integrated from linear acceleration
  calcDistIMU: number; // meters, integrated from calculated speed
  calcAccelIMU: number; // m/s², motion acceleration (magnitude without gravity)

  // ELM327 OBD-II parameters (optional, present when connected)
  obdConnected?: boolean;
  obdRPM?: number | null; // RPM
  obdSpeed?: number | null; // km/h
  obdGear?: string | null; // Gear: 'N', 'R', '1', '2', '3', '4', '5', '6'
  obdFuelFlow?: number | null; // l/h
  obdFuelEconomy?: number | null; // km/l
  obdCoolantTemp?: number | null; // Coolant °C
  obdOilTemp?: number | null; // Oil °C
  obdTotalFuelUsed?: number | null; // Liters
  obdElectricPower?: number | null; // Watts (hybrid/electric)
  obdEnergyConsumption?: number | null; // Wh/km (hybrid/electric)
  obdBatterySOC?: number | null; // % (hybrid/electric)
  obdRecuperation?: number | null; // Watts (regenerative recuperation power)
}

export interface SavedSession {
  id: string;
  date: string;
  filename: string;
  count: number;
  name: string;
  comment: string;
}

export interface CalibrationData {
  accelOffsetX: number;
  accelOffsetY: number;
  accelOffsetZ: number;
  gyroOffsetX: number;
  gyroOffsetY: number;
  gyroOffsetZ: number;
}

export interface FilterSettings {
  alphaLowPass: number; // Coeff for Low Pass Filter (0 < alpha <= 1)
  enableKalman: boolean;
  targetFrequencyHz: number; // 10 or 20 Hz
  simulatedMode: boolean; // For desktop testing / simulation demo
}
