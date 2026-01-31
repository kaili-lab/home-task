import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DayGroupSkeletonProps {
  date: Date;
  taskCount?: number;
}

const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function DayGroupSkeleton({
  date,
  taskCount = 2,
}: DayGroupSkeletonProps) {
  const dayOfWeek = date.getDay();

  return (
    <div className="rounded-xl">
      {/* Day Header */}
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-16 h-16 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      {/* Tasks */}
      <div className="ml-20 space-y-2">
        {Array.from({ length: taskCount }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100"
          >
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="flex-1 h-5" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="w-2 h-2 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
