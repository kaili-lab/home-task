import type { Task } from "@/types";
import { TaskCard } from "./TaskCard";

interface TaskListProps {
  tasks: Task[];
  onToggle: (taskId: number) => void;
  emptyMessage?: string;
}

export function TaskList({ tasks, onToggle, emptyMessage = "暂无任务" }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <span className="text-4xl mb-3">📋</span>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onToggle={onToggle} />
      ))}
    </div>
  );
}
