import { useTaskListByGroup } from "@/hooks/useTaskList";
import type { Group } from "@/types";
import { TaskSection } from "@/components/task/TaskSection";
import { TaskCard } from "@/components/task/TaskCard";
import { TaskListSkeleton } from "@/features/task/TaskListSkeleton";

interface GroupTasksListProps {
  groups: Group[];
  excludeGroupId?: number;
  onToggleTaskStatus?: (taskId: number) => void;
  dateFilter?: { dueDate?: string; dueDateFrom?: string; dueDateTo?: string };
}

export function GroupTasksList({
  groups,
  excludeGroupId,
  onToggleTaskStatus,
  dateFilter,
}: GroupTasksListProps) {
  // 过滤掉排除的群组
  const filteredGroups = excludeGroupId
    ? groups.filter((g) => g.id !== excludeGroupId)
    : groups;

  if (filteredGroups.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>暂无群组</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {filteredGroups.map((group) => (
        <GroupTasksSection
          key={group.id}
          group={group}
          onToggleTaskStatus={onToggleTaskStatus}
          dateFilter={dateFilter}
        />
      ))}
    </div>
  );
}

interface GroupTasksSectionProps {
  group: Group;
  onToggleTaskStatus?: (taskId: number) => void;
  dateFilter?: { dueDate?: string; dueDateFrom?: string; dueDateTo?: string };
}

function GroupTasksSection({ group, onToggleTaskStatus, dateFilter }: GroupTasksSectionProps) {
  const { tasks, loading } = useTaskListByGroup(group.id, dateFilter);

  return (
    <TaskSection
      title={group.name}
      icon={group.icon || "🏠"}
      count={tasks.length}
      collapsible={false}
    >
      {loading ? (
        <TaskListSkeleton count={2} />
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>暂无任务</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={onToggleTaskStatus || (() => {})} />
          ))}
        </div>
      )}
    </TaskSection>
  );
}
