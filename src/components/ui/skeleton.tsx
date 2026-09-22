import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-muted animate-pulse rounded-xl motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
