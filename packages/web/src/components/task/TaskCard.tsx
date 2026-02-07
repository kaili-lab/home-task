import type { Task, TaskStatus, Priority } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TaskAssignees } from "./TaskAssignees";
import { RecurringIndicator } from "./RecurringIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface TaskCardProps {
  task: Task;
  onToggle: (taskId: number) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: number) => void;
  onClick?: (task: Task) => void;
}

const priorityColors: Record<Priority, string> = {
  low: "bg-green-500",
  medium: "bg-orange-500",
  high: "bg-red-500",
};

const statusStyles: Record<TaskStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export function TaskCard({ task, onToggle, onEdit, onDelete, onClick }: TaskCardProps) {
  const isCompleted = task.status === "completed";
  const colorPalette = [
    "from-orange-400 to-orange-500",
    "from-blue-400 to-blue-500",
    "from-green-400 to-green-500",
    "from-purple-400 to-purple-500",
    "from-pink-400 to-pink-500",
    "from-red-400 to-red-500",
    "from-yellow-400 to-yellow-500",
    "from-indigo-400 to-indigo-500",
  ];

  const getUserInitials = (name?: string | null) => {
    const base = name?.trim() || "";
    return base ? base.charAt(0).toUpperCase() : "?";
  };

  const getUserColor = (userId: number) => colorPalette[userId % colorPalette.length];

  const assignees = task.assignedTo.map((userId, index) => {
    const name = task.assignedToNames?.[index] || `用户${userId}`;
    return {
      id: userId,
      name,
      email: "",
      initials: getUserInitials(name),
      color: getUserColor(userId),
    };
  });

  const completedByName =
    task.completedByName || assignees.find((u) => u.id === task.completedBy)?.name || null;

  const formatTime = () => {
    if (task.startTime && task.endTime) return `${task.startTime}-${task.endTime}`;
    if (task.timeSegment === "early_morning") return "凌晨";
    if (task.timeSegment === "morning") return "早上";
    if (task.timeSegment === "forenoon") return "上午";
    if (task.timeSegment === "noon") return "中午";
    if (task.timeSegment === "afternoon") return "下午";
    if (task.timeSegment === "evening") return "晚上";
    if (task.timeSegment === "all_day") return "全天";
    return "";
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(task);
    }
  };

  return (
    <div
      className={cn(
        "task-card bg-white rounded-xl p-4 border border-gray-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5",
        isCompleted && "opacity-60",
        onClick && "cursor-pointer",
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-3">
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isCompleted}
            onCheckedChange={() => onToggle(task.id)}
            className="mt-1"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4
              className={cn(
                "font-medium text-gray-800 flex-1 truncate",
                isCompleted && "line-through text-gray-500",
              )}
              title={task.title}
            >
              {task.title}
            </h4>
            <span
              className={cn("w-2.5 h-2.5 rounded-full", priorityColors[task.priority])}
              title={`${task.priority}优先级`}
            />
            {task.priority === "high" && (
              <Badge variant="destructive" className="text-xs">
                紧急
              </Badge>
            )}
            {task.isRecurring && <RecurringIndicator rule={task.recurringRule} />}

            {/* 更多菜单 */}
            {(onEdit || onDelete) && (
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(task)}>
                        编辑
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        onClick={() => onDelete(task.id)}
                        className="text-red-600 focus:text-red-600"
                      >
                        删除
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {task.description && (
            <p
              className={cn(
                "text-sm text-gray-500 mb-2 line-clamp-2",
                isCompleted && "line-through text-gray-400",
              )}
              title={task.description}
            >
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            <span>📅 今天 {formatTime()}</span>
            {task.source === "ai" && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-600">
                🤖 AI创建
              </Badge>
            )}
            <Badge className={statusStyles[task.status]}>
              {task.status === "pending" && "待办"}
              {task.status === "completed" && "已完成"}
              {task.status === "cancelled" && "已取消"}
            </Badge>
            {completedByName && <span>✅ 由 {completedByName} 完成</span>}
          </div>
        </div>

        {assignees.length > 0 && <TaskAssignees users={assignees} />}
      </div>
    </div>
  );
}
