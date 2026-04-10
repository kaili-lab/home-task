import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useTaskListByGroup } from "@/hooks/useTaskList";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DayGroup } from "./DayGroup";
import { DayGroupSkeleton } from "./DayGroupSkeleton";
import { formatLocalDate } from "@/utils/date";
import { CreateTaskModal } from "@/features/task/CreateTaskModal";
import { updateTaskStatus, deleteTask, updateTask } from "@/services/tasks.api";
import { showToastError, showToastSuccess } from "@/utils/toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getTasks } from "@/services/tasks.api";
import type { TaskInfo } from "shared";
import type { TaskStatus, Task, Group } from "@/types";

interface WeekViewProps {
  onCreateTask: () => void;
}

// 将 TaskInfo 转换为 Task 类型
function taskInfoToTask(taskInfo: TaskInfo): Task {
  return {
    id: taskInfo.id,
    title: taskInfo.title,
    description: taskInfo.description || undefined,
    status: taskInfo.status,
    priority: taskInfo.priority,
    dueDate: taskInfo.dueDate || undefined,
    startTime: taskInfo.startTime || undefined,
    endTime: taskInfo.endTime || undefined,
    timeSegment: taskInfo.timeSegment,
    groupId: taskInfo.groupId || undefined,
    createdBy: taskInfo.createdBy,
    assignedTo: taskInfo.assignedToIds,
    assignedToNames: taskInfo.assignedToNames,
    completedBy: taskInfo.completedBy || undefined,
    completedByName: taskInfo.completedByName,
    completedAt: taskInfo.completedAt || undefined,
    source: taskInfo.source,
    isRecurring: taskInfo.isRecurring,
    recurringRule: taskInfo.recurringRule || undefined,
    recurringParentId: taskInfo.recurringParentId || undefined,
    createdAt: taskInfo.createdAt,
    updatedAt: taskInfo.updatedAt,
  };
}

export function WeekView({ onCreateTask }: WeekViewProps) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { groups } = useApp();
  const { user } = useAuth();
  const todayGroupRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const todayDateStr = useMemo(() => formatLocalDate(new Date()), []);

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

  useEffect(() => {
    if (location.pathname !== "/week") return;
    queryClient.refetchQueries({ queryKey: ["tasks"], type: "active" });
  }, [location.pathname, queryClient]);

  // 查询个人任务（本周日期范围）
  const {
    tasks: personalTasks,
    loading: personalLoading,
    refetch: refetchPersonal,
  } = useTaskListByGroup(null, {
    dueDateFrom: weekRange.from,
    dueDateTo: weekRange.to,
  });

  // 查询默认群组任务（本周日期范围）
  const {
    tasks: defaultGroupTasks,
    loading: defaultGroupLoading,
    refetch: refetchDefault,
  } = useTaskListByGroup(user?.defaultGroupId ?? undefined, {
    dueDateFrom: weekRange.from,
    dueDateTo: weekRange.to,
  });

  // 获取默认群组信息
  const defaultGroup = user?.defaultGroupId
    ? groups.find((g) => g.id === user.defaultGroupId)
    : null;

  // 获取其他群组（排除默认群组）
  const otherGroups = groups.filter((g) => g.id !== user?.defaultGroupId);

  // 查询其他群组的任务（使用useQueries）
  const otherGroupQueries = useQueries({
    queries: otherGroups.map((group) => ({
      queryKey: ["tasks", "group", group.id, { dueDateFrom: weekRange.from, dueDateTo: weekRange.to }],
      queryFn: async () => {
        const result = await getTasks({
          groupId: group.id,
          dueDateFrom: weekRange.from,
          dueDateTo: weekRange.to,
        });
        return {
          group,
          tasks: result.tasks.map(taskInfoToTask),
        };
      },
      enabled: weekRange.from !== "" && weekRange.to !== "",
      keepPreviousData: true,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      staleTime: 0,
    })),
  });

  const otherGroupTasks: { group: Group; tasks: Task[] }[] = otherGroupQueries
    .map((query, index) => {
      if (query.data) {
        return query.data;
      }
      return {
        group: otherGroups[index],
        tasks: [],
      };
    })
    .filter((data) => data.group !== undefined);
  const otherGroupsLoading = otherGroupQueries.some((query) => query.isLoading);

  // 计算loading状态
  const loading = personalLoading || defaultGroupLoading || otherGroupsLoading;

  useEffect(() => {
    if (location.pathname !== "/week") return;
    if (loading) return;
    if (hasAutoScrolledRef.current) return;
    if (!todayGroupRef.current) return;

    requestAnimationFrame(() => {
      todayGroupRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      hasAutoScrolledRef.current = true;
    });
  }, [location.pathname, loading]);

  // 状态管理
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    taskId: number;
    taskTitle: string;
  } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");

  // 按日期和群组双重分组任务
  const tasksByDateAndGroup = useMemo(() => {
    const result: {
      [dateStr: string]: {
        personal: Task[];
        defaultGroup?: { group: Group; tasks: Task[] };
        otherGroups: { group: Group; tasks: Task[] }[];
      };
    } = {};

    weekDays.forEach((date) => {
      const dateStr = formatLocalDate(date);
      result[dateStr] = {
        personal: personalTasks.filter((task) => task.dueDate === dateStr),
        otherGroups: [],
      };

      // 默认群组任务
      if (defaultGroup && defaultGroupTasks) {
        const groupTasks = defaultGroupTasks.filter((task) => task.dueDate === dateStr);
        if (groupTasks.length > 0) {
          result[dateStr].defaultGroup = {
            group: defaultGroup,
            tasks: groupTasks,
          };
        }
      }

      // 其他群组任务
      otherGroupTasks.forEach((groupData) => {
        if (groupData.group) {
          const groupTasks = groupData.tasks.filter((task) => task.dueDate === dateStr);
          if (groupTasks.length > 0) {
            result[dateStr].otherGroups.push({
              group: groupData.group,
              tasks: groupTasks,
            });
          }
        }
      });
    });

    return result;
  }, [weekDays, personalTasks, defaultGroupTasks, defaultGroup, otherGroupTasks]);

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
      // 从所有任务源中查找任务
      const allTasks = [
        ...personalTasks,
        ...(defaultGroupTasks || []),
        ...otherGroupTasks.flatMap((g) => g.tasks),
      ];
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;

      const newStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";
      await updateTaskStatus(taskId, newStatus);

      // 刷新所有任务列表
      const refetchPromises = [
        refetchPersonal(),
        refetchDefault(),
        ...otherGroupQueries.map((query) => query.refetch()),
      ];
      await Promise.all(refetchPromises);

      showToastSuccess(newStatus === "completed" ? "任务已完成 ✓" : "任务已标记为未完成");
    } catch (error) {
      console.error("更新任务状态失败:", error);
      showToastError(error instanceof Error ? error.message : "更新任务状态失败");
    }
  };

  // 打开删除确认对话框
  const handleDeleteTask = (taskId: number) => {
    const allTasks = [
      ...personalTasks,
      ...(defaultGroupTasks || []),
      ...otherGroupTasks.flatMap((g) => g.tasks),
    ];
    const task = allTasks.find((t) => t.id === taskId);
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
      const refetchPromises = [
        refetchPersonal(),
        refetchDefault(),
        ...otherGroupQueries.map((query) => query.refetch()),
      ];
      await Promise.all(refetchPromises);
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
      const refetchPromises = [
        refetchPersonal(),
        refetchDefault(),
        ...otherGroupQueries.map((query) => query.refetch()),
      ];
      await Promise.all(refetchPromises);
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
          const isToday = dateStr === todayDateStr;
          const dayData = tasksByDateAndGroup[dateStr] || {
            personal: [],
            otherGroups: [],
          };

          return (
            <div key={dateStr} ref={isToday ? todayGroupRef : undefined}>
              {loading ? (
                <DayGroupSkeleton date={date} taskCount={2} />
              ) : (
                <DayGroup
                  date={date}
                  dayIndex={index}
                  personalTasks={dayData.personal}
                  defaultGroup={dayData.defaultGroup}
                  otherGroups={dayData.otherGroups}
                  onToggle={toggleTaskStatus}
                  onViewTask={handleViewTask}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                />
              )}
            </div>
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
