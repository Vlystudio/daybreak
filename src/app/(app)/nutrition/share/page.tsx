import { SharedFoodLogger } from "@/components/nutrition/shared-food-logger";

export const metadata = { title: "Log shared photo · Daybreak" };
export const dynamic = "force-dynamic";

export default function ShareTargetPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log this meal</h1>
        <p className="mt-1 text-sm text-muted-foreground">From the photo you shared to Daybreak.</p>
      </div>
      <SharedFoodLogger />
    </div>
  );
}
