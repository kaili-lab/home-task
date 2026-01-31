import { Skeleton } from "@/components/ui/skeleton";

interface TaskListSkeletonProps {
  count?: number;
}

export function TaskListSkeleton({ count = 3 }: TaskListSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="p-4 bg-white rounded-lg border border-gray-100"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="w-5 h-5 rounded mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="w-2 h-2 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
