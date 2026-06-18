import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sunrise,
  Sunset,
  Droplets,
  Wind,
  MapPin,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeatherSnapshot } from "@/lib/integrations/weather";

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code === 0) return <Sun className={className} aria-hidden />;
  if (code <= 2) return <CloudSun className={className} aria-hidden />;
  if (code === 3) return <Cloud className={className} aria-hidden />;
  if (code <= 48) return <CloudFog className={className} aria-hidden />;
  if (code <= 57) return <CloudDrizzle className={className} aria-hidden />;
  if (code <= 67) return <CloudRain className={className} aria-hidden />;
  if (code <= 77) return <CloudSnow className={className} aria-hidden />;
  if (code <= 82) return <CloudRain className={className} aria-hidden />;
  if (code <= 86) return <CloudSnow className={className} aria-hidden />;
  return <CloudLightning className={className} aria-hidden />;
}

export function WeatherCard({ weather, city }: { weather: WeatherSnapshot | null; city: string | null }) {
  return (
    <Card className="bg-sunrise h-full border-none text-[#5a3d1a]">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" aria-hidden />
          {city ?? "Weather"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        {weather ? (
          <>
            <div className="flex items-center gap-4">
              <WeatherIcon code={weather.weatherCode} className="h-12 w-12" />
              <div>
                <p className="text-4xl font-semibold tabular-nums">
                  {Math.round(weather.temperature)}°
                </p>
                <p className="text-sm opacity-80">{weather.description}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <span>
                H {Math.round(weather.tempMax)}° · L {Math.round(weather.tempMin)}°
              </span>
              <span className="flex items-center gap-1">
                <Wind className="h-3.5 w-3.5" aria-hidden /> {Math.round(weather.windSpeed)} mph
              </span>
              {weather.precipitationChance != null && (
                <span className="flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5" aria-hidden /> {weather.precipitationChance}% rain
                </span>
              )}
              <span className="flex items-center gap-1">
                <Sunrise className="h-3.5 w-3.5" aria-hidden />
                {format(parseISO(weather.sunrise), "h:mm a")}
              </span>
              <span className="flex items-center gap-1">
                <Sunset className="h-3.5 w-3.5" aria-hidden />
                {format(parseISO(weather.sunset), "h:mm a")}
              </span>
            </div>
          </>
        ) : (
          <p className="py-6 text-sm">
            Set your city in{" "}
            <Link href="/settings" className="font-medium underline underline-offset-2">
              settings
            </Link>{" "}
            to see your local morning weather here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
