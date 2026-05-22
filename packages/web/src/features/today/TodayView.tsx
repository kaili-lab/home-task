import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useTaskListByGroup } from "@/hooks/useTaskList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/hooks/useAuth";
import { useApp } from "@/hooks/useApp";
import { TodayHeader } from "./TodayHeader";
import { TaskSection } from "@/components/task/TaskSection";
import { TaskCard } from "@/components/task/TaskCard";
import { TaskListSkeleton } from "@/features/task/TaskListSkeleton";
import { GroupTasksList } from "./GroupTasksList";
import { CreateTaskModal } from "@/features/task/CreateTaskModal";
import { updateTaskStatus, deleteTask, updateTask } from "@/services/tasks.api";
import { showToastError, showToastSuccess } from "@/utils/toast";
import { getTodayLocalDate } from "@/utils/date";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { TaskStatus, Task } from "@/types";
import type { UpdateTaskInput } from "shared";

export function TodayView({ onCreateTask }: { onCreateTask: () => void }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { currentUser } = useCurrentUser();
  const { user } = useAuth();
  const { groups } = useApp();
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    taskId: number;
    taskTitle: string;
  } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");

  // 获取今天的日期字符串 YYYY-MM-DD
  const today = useMemo(() => {
    return getTodayLocalDate();
  }, []);

  useEffect(() => {
    if (location.pathname !== "/today") return;
    queryClient.refetchQueries({ queryKey: ["tasks"], type: "active" });
  }, [location.pathname, queryClient]);

  // 查询个人任务（只显示今天的）
  const {
    tasks: personalTasks,
    loading: personalLoading,
    refetch: refetchPersonal,
  } = useTaskListByGroup(null, {
    dueDate: today,
  });

  // 查询默认群组任务（只显示今天的）
  const {
    tasks: defaultGroupTasks,
    loading: defaultGroupLoading,
    refetch: refetchDefault,
  } = useTaskListByGroup(user?.defaultGroupId ?? undefined, { dueDate: today });

  // 获取默认群组信息
  const defaultGroup = user?.defaultGroupId
    ? groups.find((g) => g.id === user.defaultGroupId)
    : null;

  // 获取我创建的群组（排除默认群组）
  const createdGroups = groups.filter((g) => g.role === "owner" && g.id !== user?.defaultGroupId);

  // 获取我加入的群组
  const joinedGroups = groups.filter((g) => g.role === "member");

  // 计算任务总数（只计算个人任务和默认群组任务的待处理任务）
  const totalTaskCount =
    personalTasks.filter((t) => t.status === "pending").length +
    (defaultGroupTasks?.filter((t) => t.status === "pending").length || 0);

  // 任务状态切换函数
  const toggleTaskStatus = async (taskId: number) => {
    try {
      // 查找任务以获取当前状态
      const task = [...personalTasks, ...(defaultGroupTasks || [])].find((t) => t.id === taskId);
      if (!task) return;

      // 切换状态
      const newStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";

      // 调用 API 更新状态
      await updateTaskStatus(taskId, newStatus);

      // 刷新任务列表
      await Promise.all([refetchPersonal(), refetchDefault()]);

      // 显示成功提示
      showToastSuccess(newStatus === "completed" ? "任务已完成 ✓" : "任务已标记为未完成");
    } catch (error) {
      console.error("更新任务状态失败:", error);
      showToastError(error instanceof Error ? error.message : "更新任务状态失败");
    }
  };

  // 打开删除确认对话框
  const handleDeleteTask = (taskId: number) => {
    const task = [...personalTasks, ...(defaultGroupTasks || [])].find((t) => t.id === taskId);
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

      // 刷新任务列表
      await Promise.all([refetchPersonal(), refetchDefault()]);

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
  const handleUpdateTask = async (data: UpdateTaskInput) => {
    if (!editingTask) return;

    try {
      await updateTask(editingTask.id, data);

      // 刷新任务列表
      await Promise.all([refetchPersonal(), refetchDefault()]);

      showToastSuccess("任务已更新");
      setEditingTask(null);
    } catch (error) {
      console.error("更新任务失败:", error);
      showToastError(error instanceof Error ? error.message : "更新任务失败");
    }
  };

  return (
    <section className="p-6">
      <TodayHeader
        userName={currentUser.name}
        taskCount={totalTaskCount}
        onCreateTask={onCreateTask}
      />

      {/* 个人任务 */}
      <TaskSection title="个人任务" icon="👤" count={personalTasks.length} collapsible={false}>
        {personalLoading ? (
          <TaskListSkeleton count={2} />
        ) : personalTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>暂无个人任务</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {personalTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={toggleTaskStatus}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onClick={handleViewTask}
              />
            ))}
          </div>
        )}
      </TaskSection>

      {/* 默认群组任务 */}
      {defaultGroup && (
        <TaskSection
          title={defaultGroup.name}
          icon={defaultGroup.icon || "🏠"}
          count={defaultGroupTasks?.length || 0}
          subtitle="默认群组"
          collapsible={false}
        >
          {defaultGroupLoading ? (
            <TaskListSkeleton count={2} />
          ) : (defaultGroupTasks?.length || 0) === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>暂无任务</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {defaultGroupTasks?.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={toggleTaskStatus}
                  onEdit={handleEditTask}
                  onDelete={handleDeleteTask}
                  onClick={handleViewTask}
                />
              ))}
            </div>
          )}
        </TaskSection>
      )}

      {/* 我创建的群组 */}
      {createdGroups.length > 0 && (
        <TaskSection
          title="我创建的群组"
          icon="👑"
          count={0}
          collapsible={true}
          defaultExpanded={false}
          showCount={false}
        >
          <GroupTasksList
            groups={createdGroups}
            excludeGroupId={user?.defaultGroupId ?? undefined}
            onToggleTaskStatus={toggleTaskStatus}
            onViewTask={handleViewTask}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            dateFilter={{ dueDate: today }}
          />
        </TaskSection>
      )}

      {/* 我加入的群组 */}
      {joinedGroups.length > 0 && (
        <TaskSection
          title="我加入的群组"
          icon="➕"
          count={0}
          collapsible={true}
          defaultExpanded={false}
          showCount={false}
        >
          <GroupTasksList
            groups={joinedGroups}
            onToggleTaskStatus={toggleTaskStatus}
            onViewTask={handleViewTask}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            dateFilter={{ dueDate: today }}
          />
        </TaskSection>
      )}

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
