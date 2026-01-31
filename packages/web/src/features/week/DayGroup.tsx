import type { Task } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DayGroupProps {
  date: Date;
  dayIndex: number;
  tasks: Task[];
  onToggle: (taskId: number) => void;
}

const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const priorityColors = {
  low: "bg-green-500",
  medium: "bg-orange-500",
  high: "bg-red-500",
};

export function DayGroup({ date, tasks, onToggle }: DayGroupProps) {
  const isToday = new Date().toDateString() === date.toDateString();
  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
  const dayOfWeek = date.getDay();

  const formatDate = () => {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const formatTime = (task: Task) => {
    if (task.isAllDay) return "全天";
    if (task.startTime && task.endTime) return `${task.startTime}-${task.endTime}`;
    if (task.startTime) return `${task.startTime}前`;
    return "";
  };

  return (
    <div className={cn("rounded-xl", isPast && !isToday && "opacity-60")}>
      {/* Day Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            "w-16 h-16 rounded-xl flex flex-col items-center justify-center",
            isToday ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-600",
          )}
        >
          <span className="text-xs font-medium">{weekdayNames[dayOfWeek]}</span>
          <span className="text-lg font-bold">{date.getDate()}</span>
        </div>
        <div>
          <div className="font-medium text-gray-700 flex items-center gap-2">
            {formatDate()}
            {isToday && <Badge className="bg-orange-500 text-white">今天</Badge>}
          </div>
          <div className="text-sm text-gray-400">
            {tasks.length === 0 ? "无任务" : `${tasks.length}个任务`}
          </div>
        </div>
      </div>

      {/* Tasks */}
      {tasks.length > 0 ? (
        <div className="ml-20 space-y-2">
          {tasks.map((task) => {
            const isCompleted = task.status === "completed";
            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 transition-all hover:shadow-sm",
                  isCompleted && "opacity-60",
                )}
              >
                <Checkbox checked={isCompleted} onCheckedChange={() => onToggle(task.id)} />
                <span
                  className={cn(
                    "flex-1 text-gray-700",
                    isCompleted && "line-through text-gray-400",
                  )}
                >
                  {task.title}
                </span>
                <span className="text-xs text-gray-400">{formatTime(task)}</span>
                <span
                  className={cn("w-2 h-2 rounded-full", priorityColors[task.priority])}
                  title={`${task.priority}优先级`}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ml-20 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
          <p className="text-sm text-gray-400">暂无任务</p>
        </div>
      )}
    </div>
  );
}
