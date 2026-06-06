/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Haversine formula to compute distance between two latitude/longitude points in meters
export function getHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Low-pass filter implementation
export function applyLowPass(
  currentRaw: number,
  prevFiltered: number,
  alpha: number
): number {
  return alpha * currentRaw + (1 - alpha) * prevFiltered;
}

// Formats millisecond duration as HH:mm:ss.SSS
export function formatMilliseconds(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);

  const pad = (num: number, size: number = 2) => {
    let s = num.toString();
    while (s.length < size) s = "0" + s;
    return s.slice(0, size);
  };

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
}

// Formats absolute timestamp (ms) as YY.MM.DD HH:MM:SS.000
export function formatAbsoluteTime(ms: number): string {
  const d = new Date(ms);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const sss = String(d.getMilliseconds()).padStart(3, "0");
  return `${yy}.${mm}.${dd} ${hh}:${min}:${ss}.${sss}`;
}

// Converts a list of TelemetryRecords to a CSV String with support for comments
export function convertToCSV(records: any[], comment?: string): string {
  if (records.length === 0) return "";

  const csvRows: string[] = [];

  // Comment is the first line in the file
  if (comment && comment.trim().length > 0) {
    csvRows.push(`# ${comment.replace(/\n/g, " ")}`);
  }

  // Define headers
  const headers = [
    "Absolute_Time",
    "Relative_Time_s",
    "GPS_Latitude",
    "GPS_Longitude",
    "GPS_Altitude_m",
    "GPS_Speed_ms",
    "GPS_Distance_km",
    "GPS_Acceleration_ms2",
    "Accel_X_Filtered_ms2",
    "Accel_Y_Filtered_ms2",
    "Accel_Z_Filtered_ms2",
    "Accel_X_Raw_ms2",
    "Accel_Y_Raw_ms2",
    "Accel_Z_Raw_ms2",
    "Gyro_X_Filtered_rads",
    "Gyro_Y_Filtered_rads",
    "Gyro_Z_Filtered_rads",
    "Gyro_X_Raw_rads",
    "Gyro_Y_Raw_rads",
    "Gyro_Z_Raw_rads",
    "Temperature_C",
    "Pressure_kPa",
    "Humidity_percent",
    "WindSpeed_ms",
    "WindDirection_deg",
    "IMU_Speed_ms",
    "IMU_Distance_km",
    "IMU_Acceleration_ms2",
    "IMU_Relative_Altitude_m",
    "Magnetometer_X_uT",
    "Magnetometer_Y_uT",
    "Magnetometer_Z_uT",
    "Compass_Heading_deg",
    "Pitch_deg",
    "Roll_deg",
    "Device_Pressure_hPa",
    "Relative_Altitude_Baro_m",
    "Noise_Level_dB",
    "Ambient_Light_lux",
    "Battery_Level_percent",
    "Battery_Charging",
    "OBD_Connected",
    "OBD_Engine_RPM",
    "OBD_Vehicle_Speed_kmh",
    "OBD_Gear",
    "OBD_Fuel_Flow_lh",
    "OBD_Fuel_Economy_kml",
    "OBD_Coolant_Temp_C",
    "OBD_Oil_Temp_C",
    "OBD_Total_Fuel_L",
    "OBD_Electric_Power_W",
    "OBD_Energy_Consumption_Wh_km",
    "OBD_Battery_SOC_percent",
    "OBD_Recuperation_W"
  ];

  csvRows.push(headers.join(","));

  for (const r of records) {
    const absTimeStr = formatAbsoluteTime(r.absTime || Date.now());
    const totalMs = r.timestamp || 0;
    const wholeSec = Math.floor(totalMs / 1000);
    const msPortion = Math.floor(totalMs % 1000);
    const wholeSecPadded = String(wholeSec).padStart(2, "0");
    const msPadded = String(msPortion).padStart(3, "0");
    const relTimeStr = `${wholeSecPadded}.${msPadded}`;
    const row = [
      absTimeStr,
      relTimeStr,
      r.gpsLat !== null && r.gpsLat !== undefined ? r.gpsLat.toFixed(8) : "",
      r.gpsLon !== null && r.gpsLon !== undefined ? r.gpsLon.toFixed(8) : "",
      r.gpsAlt !== null && r.gpsAlt !== undefined ? r.gpsAlt.toFixed(2) : "",
      r.gpsSpeed.toFixed(4),
      (r.gpsDistance / 1000).toFixed(3),
      r.gpsAccel.toFixed(4),
      r.accelX.toFixed(4),
      r.accelY.toFixed(4),
      r.accelZ.toFixed(4),
      r.accelXRaw.toFixed(4),
      r.accelYRaw.toFixed(4),
      r.accelZRaw.toFixed(4),
      r.gyroX.toFixed(4),
      r.gyroY.toFixed(4),
      r.gyroZ.toFixed(4),
      r.gyroXRaw.toFixed(4),
      r.gyroYRaw.toFixed(4),
      r.gyroZRaw.toFixed(4),
      r.temp.toFixed(1),
      r.pressure !== null && r.pressure !== undefined ? r.pressure.toFixed(2) : "",
      r.humidity !== null && r.humidity !== undefined ? r.humidity.toFixed(1) : "",
      r.windSpeed !== null && r.windSpeed !== undefined ? r.windSpeed.toFixed(1) : "",
      r.windDir !== null && r.windDir !== undefined ? r.windDir.toFixed(1) : "",
      r.calcSpeedIMU.toFixed(4),
      (r.calcDistIMU / 1000).toFixed(3),
      r.calcAccelIMU.toFixed(4),
      r.calcHeightIMU !== null && r.calcHeightIMU !== undefined ? r.calcHeightIMU.toFixed(4) : "0.0000",
      r.magX !== null && r.magX !== undefined ? r.magX.toFixed(3) : "0.000",
      r.magY !== null && r.magY !== undefined ? r.magY.toFixed(3) : "0.000",
      r.magZ !== null && r.magZ !== undefined ? r.magZ.toFixed(3) : "0.000",
      r.heading !== null && r.heading !== undefined ? r.heading.toFixed(1) : "0.0",
      r.pitch !== null && r.pitch !== undefined ? r.pitch.toFixed(1) : "0.0",
      r.roll !== null && r.roll !== undefined ? r.roll.toFixed(1) : "0.0",
      r.baroPressure !== null && r.baroPressure !== undefined ? r.baroPressure.toFixed(2) : "",
      r.calcHeightBaro !== null && r.calcHeightBaro !== undefined ? r.calcHeightBaro.toFixed(4) : "0.0000",
      r.noiseLevelDb !== null && r.noiseLevelDb !== undefined ? r.noiseLevelDb.toFixed(1) : "0.0",
      r.lightLux !== null && r.lightLux !== undefined ? r.lightLux.toFixed(0) : "0",
      r.batteryLevel !== null && r.batteryLevel !== undefined ? r.batteryLevel.toFixed(0) : "100",
      r.batteryCharging ? "1" : "0",
      // OBD-II fields
      r.obdConnected ? "1" : "0",
      r.obdRPM !== null && r.obdRPM !== undefined ? r.obdRPM.toFixed(0) : "",
      r.obdSpeed !== null && r.obdSpeed !== undefined ? r.obdSpeed.toFixed(1) : "",
      r.obdGear !== null && r.obdGear !== undefined ? r.obdGear : "",
      r.obdFuelFlow !== null && r.obdFuelFlow !== undefined ? r.obdFuelFlow.toFixed(3) : "",
      r.obdFuelEconomy !== null && r.obdFuelEconomy !== undefined ? r.obdFuelEconomy.toFixed(2) : "",
      r.obdCoolantTemp !== null && r.obdCoolantTemp !== undefined ? r.obdCoolantTemp.toFixed(1) : "",
      r.obdOilTemp !== null && r.obdOilTemp !== undefined ? r.obdOilTemp.toFixed(1) : "",
      r.obdTotalFuelUsed !== null && r.obdTotalFuelUsed !== undefined ? r.obdTotalFuelUsed.toFixed(4) : "",
      r.obdElectricPower !== null && r.obdElectricPower !== undefined ? r.obdElectricPower.toFixed(1) : "",
      r.obdEnergyConsumption !== null && r.obdEnergyConsumption !== undefined ? r.obdEnergyConsumption.toFixed(1) : "",
      r.obdBatterySOC !== null && r.obdBatterySOC !== undefined ? r.obdBatterySOC.toFixed(1) : "",
      r.obdRecuperation !== null && r.obdRecuperation !== undefined ? r.obdRecuperation.toFixed(1) : ""
    ];
    csvRows.push(row.join(","));
  }

  return csvRows.join("\n");
}

export function getNumericTimestampFilename(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${year}_${month}_${day}_${hours}_${minutes}_${seconds}`;
}
