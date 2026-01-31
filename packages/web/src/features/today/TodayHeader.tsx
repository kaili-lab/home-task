import { Button } from "@/components/ui/button";

interface TodayHeaderProps {
  userName: string;
  taskCount: number;
  onCreateTask: () => void;
}

export function TodayHeader({ userName, taskCount, onCreateTask }: TodayHeaderProps) {
  const today = new Date();
  const dateStr = today.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">早安，{userName} 👋</h2>
        <p className="text-gray-500 text-sm mt-1">
          {dateStr} · 今天有 {taskCount} 个任务等待处理
        </p>
      </div>
      <Button onClick={onCreateTask} className="bg-orange-500 hover:bg-orange-600">
        <span className="mr-2">➕</span>
        新建任务
      </Button>
    </div>
  );
}
