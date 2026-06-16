import "server-only";

/**
 * Weather via Open-Meteo (https://open-meteo.com) — free, no API key,
 * so there is no secret to leak. Swap the fetch here if you prefer a
 * keyed provider.
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

export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<WeatherSnapshot | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max",
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
    console.error("[weather] fetch failed:", err);
    return null;
  }
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
