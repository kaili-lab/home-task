import { cn } from "@/lib/utils";

interface PageLoaderProps {
  message?: string;
  className?: string;
}

export function PageLoader({ message = "加载中...", className }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[400px] gap-4",
        className
      )}
    >
      {/* Spinner */}
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-gray-200 rounded-full" />
        <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin" />
      </div>
      {/* 加载文字 */}
      {message && <p className="text-gray-500 text-sm">{message}</p>}
    </div>
  );
}
