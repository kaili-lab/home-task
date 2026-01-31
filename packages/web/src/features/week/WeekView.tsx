import { useMemo } from "react";
import { useTaskList } from "@/hooks/useTaskList";
import { Button } from "@/components/ui/button";
import { DayGroup } from "./DayGroup";
import { DayGroupSkeleton } from "./DayGroupSkeleton";
import type { Task } from "@/types";

interface WeekViewProps {
  onCreateTask: () => void;
}

export function WeekView({ onCreateTask }: WeekViewProps) {
  const { tasks, toggleTaskStatus, loading } = useTaskList();

  // 获取本周日期范围（周一到周日）
  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // 如果是周日，往前推6天；否则推到周一

    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push(date);
    }
    return days;
  }, []);

  // 按日期分组任务
  const tasksByDate = useMemo(() => {
    const grouped: { [key: string]: Task[] } = {};

    weekDays.forEach((date) => {
      const dateStr = date.toISOString().split("T")[0];
      grouped[dateStr] = tasks.filter((task) => task.dueDate === dateStr);
    });

    return grouped;
  }, [tasks, weekDays]);

  // 格式化日期范围
  const dateRange = useMemo(() => {
    if (weekDays.length === 0) return "";
    const start = weekDays[0];
    const end = weekDays[6];
    return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
  }, [weekDays]);

  return (
    <section className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">本周计划 📅</h2>
          <p className="text-gray-500 text-sm mt-1">{dateRange}</p>
        </div>
        <Button onClick={onCreateTask} className="bg-orange-500 hover:bg-orange-600">
          <span className="mr-2">➕</span>
          新建任务
        </Button>
      </div>

      {/* Week Days */}
      <div className="space-y-6">
        {weekDays.map((date, index) => {
          const dateStr = date.toISOString().split("T")[0];
          const dayTasks = tasksByDate[dateStr] || [];

          return loading ? (
            <DayGroupSkeleton key={dateStr} date={date} taskCount={2} />
          ) : (
            <DayGroup
              key={dateStr}
              date={date}
              dayIndex={index}
              tasks={dayTasks}
              onToggle={toggleTaskStatus}
            />
          );
        })}
      </div>
    </section>
  );
}
