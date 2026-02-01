import { useMemo, useState } from "react";
import { useTaskList } from "@/hooks/useTaskList";
import { Button } from "@/components/ui/button";
import { DayGroup } from "./DayGroup";
import { DayGroupSkeleton } from "./DayGroupSkeleton";
import { formatLocalDate } from "@/utils/date";
import { CreateTaskModal } from "@/features/task/CreateTaskModal";
import { updateTaskStatus, deleteTask, updateTask } from "@/services/tasks.api";
import { showToastError, showToastSuccess } from "@/utils/toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { TaskStatus, Task } from "@/types";

interface WeekViewProps {
  onCreateTask: () => void;
}

export function WeekView({ onCreateTask }: WeekViewProps) {
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

  // 计算本周日期范围
  const weekRange = useMemo(() => {
    if (weekDays.length === 0) return { from: "", to: "" };
    const monday = weekDays[0];
    const sunday = weekDays[6];
    return {
      from: formatLocalDate(monday),
      to: formatLocalDate(sunday),
    };
  }, [weekDays]);

  // 使用日期范围查询任务
  const { tasks, loading, refetch } = useTaskList({
    dueDateFrom: weekRange.from,
    dueDateTo: weekRange.to,
  });

  // 状态管理
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    taskId: number;
    taskTitle: string;
  } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");

  // 按日期分组任务
  const tasksByDate = useMemo(() => {
    const grouped: { [key: string]: Task[] } = {};

    weekDays.forEach((date) => {
      const dateStr = formatLocalDate(date);
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

  // 任务状态切换函数
  const toggleTaskStatus = async (taskId: number) => {
    try {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const newStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";
      await updateTaskStatus(taskId, newStatus);
      await refetch();
      showToastSuccess(newStatus === "completed" ? "任务已完成 ✓" : "任务已标记为未完成");
    } catch (error) {
      console.error("更新任务状态失败:", error);
      showToastError(error instanceof Error ? error.message : "更新任务状态失败");
    }
  };

  // 打开删除确认对话框
  const handleDeleteTask = (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setDeleteConfirm({
        open: true,
        taskId,
        taskTitle: task.title,
      });
    }
  };

  // 执行删除任务
  const executeDeleteTask = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteTask(deleteConfirm.taskId);
      await refetch();
      showToastSuccess("任务已删除");
    } catch (error) {
      console.error("删除任务失败:", error);
      showToastError(error instanceof Error ? error.message : "删除任务失败");
    } finally {
      setDeleteConfirm(null);
    }
  };

  // 打开查看任务 Modal（点击卡片）
  const handleViewTask = (task: Task) => {
    setEditingTask(task);
    setModalMode("view");
  };

  // 打开编辑任务 Modal（从菜单）
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setModalMode("edit");
  };

  // 处理更新任务
  const handleUpdateTask = async (data: any) => {
    if (!editingTask) return;
    try {
      await updateTask(editingTask.id, data);
      await refetch();
      showToastSuccess("任务已更新");
      setEditingTask(null);
    } catch (error) {
      console.error("更新任务失败:", error);
      showToastError(error instanceof Error ? error.message : "更新任务失败");
    }
  };

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
          const dateStr = formatLocalDate(date);
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
              onViewTask={handleViewTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
            />
          );
        })}
      </div>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteConfirm?.open || false}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={executeDeleteTask}
        title="确认删除任务"
        description={`确定要删除任务"${deleteConfirm?.taskTitle}"吗？\n\n删除后将无法恢复。`}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
      />

      {/* 查看/编辑任务 Modal */}
      <CreateTaskModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={handleUpdateTask}
        editTask={editingTask || undefined}
        initialMode={modalMode}
      />
    </section>
  );
}
