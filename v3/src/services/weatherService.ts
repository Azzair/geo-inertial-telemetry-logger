/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface WeatherData {
  temp: number;
  pressure: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDir: number | null;
}

/**
 * Service to interact with the external Open-Meteo Meteorology APIs
 */
export async function fetchLocalWeatherFromCoordinates(
  lat: number,
  lon: number
): Promise<WeatherData> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`
  );
  if (!res.ok) {
    throw new Error(`Weather API returned status: ${res.status}`);
  }
  const data = await res.json();
  if (!data || !data.current) {
    throw new Error("Invalid response format from Open-Meteo API");
  }

  const temp = parseFloat((data.current.temperature_2m ?? 22.4).toFixed(1));
  const pressure = parseFloat(((data.current.surface_pressure ?? 1013.25) / 10).toFixed(2)); // hPa to kPa
  const humidity = parseFloat((data.current.relative_humidity_2m ?? 60.0).toFixed(1));
  const windSpeed = parseFloat((data.current.wind_speed_10m ?? 2.5).toFixed(1));
  const windDir = Math.round(data.current.wind_direction_10m ?? 180.0);

  return {
    temp,
    pressure,
    humidity,
    windSpeed,
    windDir
  };
}
