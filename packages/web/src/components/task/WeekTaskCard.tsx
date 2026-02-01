import type { Task } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface WeekTaskCardProps {
  task: Task;
  onToggle: (taskId: number) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: number) => void;
  onClick?: (task: Task) => void;
}

export function WeekTaskCard({ task, onToggle, onEdit, onDelete, onClick }: WeekTaskCardProps) {
  const isCompleted = task.status === "completed";

  const handleCardClick = () => {
    if (onClick) {
      onClick(task);
    }
  };

  return (
    <div
      className={cn(
        "bg-white rounded-lg p-2 border border-gray-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5",
        isCompleted && "opacity-60",
        onClick && "cursor-pointer",
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-center gap-2">
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isCompleted}
            onCheckedChange={() => onToggle(task.id)}
            className="shrink-0"
          />
        </div>
        <h4
          className={cn(
            "font-medium text-sm text-gray-800 flex-1 truncate",
            isCompleted && "line-through text-gray-500",
          )}
          title={task.title}
        >
          {task.title}
        </h4>
        {(onEdit || onDelete) && (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
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
    </div>
  );
}
