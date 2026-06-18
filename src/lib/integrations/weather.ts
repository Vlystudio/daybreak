import "server-only";
import { serverEnv } from "@/env";

/**
 * Weather. Uses WeatherAPI.com (https://www.weatherapi.com) when
 * WEATHER_API_KEY is set; otherwise falls back to Open-Meteo
 * (https://open-meteo.com), which is free and key-less. Both map into the
 * same WeatherSnapshot, and the condition is normalized to WMO weather
 * codes so the dashboard icon mapping works regardless of provider.
 */

export interface WeatherSnapshot {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
  tempMax: number;
  tempMin: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number | null;
  precipitationChance: number | null;
}

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm",
};

export function describeWeather(code: number): string {
  return WEATHER_DESCRIPTIONS[code] ?? "Mixed conditions";
}

/** WeatherAPI.com condition code -> nearest WMO code (for the icon mapping). */
const WEATHERAPI_TO_WMO: Record<number, number> = {
  1000: 0, // Sunny / Clear
  1003: 2, // Partly cloudy
  1006: 3, // Cloudy
  1009: 3, // Overcast
  1030: 45, // Mist
  1063: 61, // Patchy rain possible
  1066: 71, // Patchy snow possible
  1069: 71, // Patchy sleet possible
  1072: 51, // Patchy freezing drizzle possible
  1087: 95, // Thundery outbreaks possible
  1114: 75, // Blowing snow
  1117: 75, // Blizzard
  1135: 45, // Fog
  1147: 48, // Freezing fog
  1150: 51, // Patchy light drizzle
  1153: 51, // Light drizzle
  1168: 56, // Freezing drizzle
  1171: 57, // Heavy freezing drizzle
  1180: 61, // Patchy light rain
  1183: 61, // Light rain
  1186: 63, // Moderate rain at times
  1189: 63, // Moderate rain
  1192: 65, // Heavy rain at times
  1195: 65, // Heavy rain
  1198: 66, // Light freezing rain
  1201: 67, // Moderate/heavy freezing rain
  1204: 66, // Light sleet
  1207: 67, // Moderate/heavy sleet
  1210: 71, // Patchy light snow
  1213: 71, // Light snow
  1216: 73, // Patchy moderate snow
  1219: 73, // Moderate snow
  1222: 75, // Patchy heavy snow
  1225: 75, // Heavy snow
  1237: 77, // Ice pellets
  1240: 80, // Light rain shower
  1243: 81, // Moderate/heavy rain shower
  1246: 82, // Torrential rain shower
  1249: 80, // Light sleet showers
  1252: 81, // Moderate/heavy sleet showers
  1255: 85, // Light snow showers
  1258: 86, // Moderate/heavy snow showers
  1261: 77, // Light showers of ice pellets
  1264: 77, // Moderate/heavy showers of ice pellets
  1273: 95, // Patchy light rain with thunder
  1276: 96, // Moderate/heavy rain with thunder
  1279: 95, // Patchy light snow with thunder
  1282: 99, // Moderate/heavy snow with thunder
};

/** Convert WeatherAPI astro time ("06:12 AM") + date ("2026-06-18") to ISO. */
function astroTimeToIso(date: string, time12: string): string {
  const m = time12?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return `${date}T00:00`;
  let hour = parseInt(m[1], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return `${date}T${String(hour).padStart(2, "0")}:${m[2]}`;
}

interface WeatherApiResponse {
  current: {
    temp_f: number;
    feelslike_f: number;
    humidity: number;
    wind_mph: number;
    condition: { text: string; code: number };
  };
  forecast: {
    forecastday: {
      date: string;
      day: {
        maxtemp_f: number;
        mintemp_f: number;
        daily_chance_of_rain?: number;
        uv?: number;
      };
      astro: { sunrise: string; sunset: string };
    }[];
  };
}

async function fetchFromWeatherApi(
  latitude: number,
  longitude: number,
  apiKey: string
): Promise<WeatherSnapshot | null> {
  const params = new URLSearchParams({
    key: apiKey,
    q: `${latitude},${longitude}`,
    days: "1",
    aqi: "no",
    alerts: "no",
  });

  try {
    const res = await fetch(`https://api.weatherapi.com/v1/forecast.json?${params}`, {
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as WeatherApiResponse;
    const fc = json.forecast?.forecastday?.[0];
    if (!fc) return null;

    return {
      temperature: json.current.temp_f,
      apparentTemperature: json.current.feelslike_f,
      humidity: json.current.humidity,
      windSpeed: json.current.wind_mph,
      weatherCode: WEATHERAPI_TO_WMO[json.current.condition.code] ?? 3,
      description: json.current.condition.text?.trim() || describeWeather(0),
      tempMax: fc.day.maxtemp_f,
      tempMin: fc.day.mintemp_f,
      sunrise: astroTimeToIso(fc.date, fc.astro.sunrise),
      sunset: astroTimeToIso(fc.date, fc.astro.sunset),
      uvIndexMax: fc.day.uv ?? null,
      precipitationChance: fc.day.daily_chance_of_rain ?? null,
    };
  } catch (err) {
    console.error("[weather] WeatherAPI fetch failed:", err);
    return null;
  }
}

async function fetchFromOpenMeteo(
  latitude: number,
  longitude: number
): Promise<WeatherSnapshot | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto",
    forecast_days: "1",
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      current: {
        temperature_2m: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        weather_code: number;
        wind_speed_10m: number;
      };
      daily: {
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        sunrise: string[];
        sunset: string[];
        uv_index_max: (number | null)[];
        precipitation_probability_max: (number | null)[];
      };
    };

    return {
      temperature: json.current.temperature_2m,
      apparentTemperature: json.current.apparent_temperature,
      humidity: json.current.relative_humidity_2m,
      windSpeed: json.current.wind_speed_10m,
      weatherCode: json.current.weather_code,
      description: describeWeather(json.current.weather_code),
      tempMax: json.daily.temperature_2m_max[0],
      tempMin: json.daily.temperature_2m_min[0],
      sunrise: json.daily.sunrise[0],
      sunset: json.daily.sunset[0],
      uvIndexMax: json.daily.uv_index_max[0] ?? null,
      precipitationChance: json.daily.precipitation_probability_max[0] ?? null,
    };
  } catch (err) {
    console.error("[weather] Open-Meteo fetch failed:", err);
    return null;
  }
}

export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<WeatherSnapshot | null> {
  const apiKey = serverEnv().WEATHER_API_KEY;
  if (apiKey) {
    const result = await fetchFromWeatherApi(latitude, longitude, apiKey);
    if (result) return result;
    // WeatherAPI failed — fall back to the key-less provider so the card still renders.
  }
  return fetchFromOpenMeteo(latitude, longitude);
}

/** Geocode a city name to coordinates (Open-Meteo geocoding, also key-free). */
export async function geocodeCity(
  city: string
): Promise<{ latitude: number; longitude: number; name: string; timezone: string } | null> {
  const params = new URLSearchParams({ name: city, count: "1", language: "en", format: "json" });
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: { latitude: number; longitude: number; name: string; timezone: string; admin1?: string; country?: string }[];
    };
    const hit = json.results?.[0];
    if (!hit) return null;
    return {
      latitude: hit.latitude,
      longitude: hit.longitude,
      name: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "),
      timezone: hit.timezone,
    };
  } catch {
    return null;
  }
}
