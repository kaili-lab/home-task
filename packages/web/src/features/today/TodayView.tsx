import { useTaskListByGroup } from "@/hooks/useTaskList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/hooks/useAuth";
import { useApp } from "@/contexts/AppContext";
import { TodayHeader } from "./TodayHeader";
import { TaskSection } from "@/components/task/TaskSection";
import { TaskCard } from "@/components/task/TaskCard";
import { TaskListSkeleton } from "@/features/task/TaskListSkeleton";
import { GroupTasksList } from "./GroupTasksList";

export function TodayView({ onCreateTask }: { onCreateTask: () => void }) {
  const { currentUser } = useCurrentUser();
  const { user } = useAuth();
  const { groups } = useApp();

  // 查询个人任务
  const { tasks: personalTasks, loading: personalLoading } = useTaskListByGroup(null);

  // 查询默认群组任务
  const { tasks: defaultGroupTasks, loading: defaultGroupLoading } = useTaskListByGroup(
    user?.defaultGroupId ?? undefined
  );

  // 获取默认群组信息
  const defaultGroup = user?.defaultGroupId
    ? groups.find((g) => g.id === user.defaultGroupId)
    : null;

  // 获取我创建的群组（排除默认群组）
  const createdGroups = groups.filter(
    (g) => g.role === "owner" && g.id !== user?.defaultGroupId
  );

  // 获取我加入的群组
  const joinedGroups = groups.filter((g) => g.role === "member");

  // 计算任务总数（只计算个人任务和默认群组任务的待处理任务）
  const totalTaskCount =
    personalTasks.filter((t) => t.status === "pending").length +
    (defaultGroupTasks?.filter((t) => t.status === "pending").length || 0);

  // 任务状态切换函数（暂时保留，后续实现）
  const toggleTaskStatus = (taskId: number) => {
    console.log("切换任务状态:", taskId);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personalTasks.map((task) => (
              <TaskCard key={task.id} task={task} onToggle={toggleTaskStatus} />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {defaultGroupTasks?.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={toggleTaskStatus} />
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
            excludeGroupId={user?.defaultGroupId}
            onToggleTaskStatus={toggleTaskStatus}
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
          <GroupTasksList groups={joinedGroups} onToggleTaskStatus={toggleTaskStatus} />
        </TaskSection>
      )}
    </section>
  );
}
