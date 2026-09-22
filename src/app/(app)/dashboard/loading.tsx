import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading your day">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64 max-w-full" />
      </div>
      <Skeleton className="h-52 w-full rounded-3xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 w-full rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
