import { Skeleton } from "@/components/ui/skeleton";

interface MemberListSkeletonProps {
  count?: number; // 显示的骨架数量，默认3个
  showRemoveButton?: boolean; // 是否显示移除按钮的占位符
}

export function MemberListSkeleton({
  count = 3,
  showRemoveButton = false,
}: MemberListSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg"
        >
          <div className="flex items-center gap-3 flex-1">
            {/* 头像占位符 */}
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              {/* 名称和标签占位符 */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-8 rounded-full" />
              </div>
              {/* 描述占位符 */}
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          {/* 移除按钮占位符（可选） */}
          {showRemoveButton && <Skeleton className="h-8 w-12 rounded-md" />}
        </div>
      ))}
    </div>
  );
}
