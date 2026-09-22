import { Skeleton } from "@/components/ui/skeleton";

export default function ScheduleLoading() {
  return (
    <div role="status" aria-label="Loading your schedule" className="space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-11 w-20" />
      </div>
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-12 w-52" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  );
}
