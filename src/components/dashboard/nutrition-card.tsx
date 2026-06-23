import Link from "next/link";
import { Utensils, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NutritionCard({
  nutrition,
}: {
  nutrition: { calories: number; protein: number; count: number } | null;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Utensils className="h-4 w-4 text-primary" aria-hidden />
          Nutrition
        </CardTitle>
        <Link href="/nutrition" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
          Log
        </Link>
      </CardHeader>
      <CardContent className="pb-6">
        {nutrition ? (
          <Link href="/nutrition" className="block">
            <p className="text-3xl font-semibold tabular-nums">{Math.round(nutrition.calories)}</p>
            <p className="text-sm text-muted-foreground">
              calories today · {Math.round(nutrition.protein)}g protein · {nutrition.count}{" "}
              {nutrition.count === 1 ? "item" : "items"}
            </p>
          </Link>
        ) : (
          <Link
            href="/nutrition"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Camera className="h-4 w-4" aria-hidden />
            Snap a photo of your meal to track calories.
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
