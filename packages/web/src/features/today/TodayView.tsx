import { useTaskList } from "@/hooks/useTaskList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { TodayHeader } from "./TodayHeader";
import { TaskSection } from "@/components/task/TaskSection";
import { TaskCard } from "@/components/task/TaskCard";

export function TodayView({ onCreateTask }: { onCreateTask: () => void }) {
  const { tasks, toggleTaskStatus } = useTaskList();
  const { currentUser } = useCurrentUser();

  const personalTasks = tasks.filter((t) => !t.groupId);
  const groupTasks = tasks.filter((t) => t.groupId);

  return (
    <section className="p-6">
      <TodayHeader
        userName={currentUser.name}
        taskCount={tasks.filter((t) => t.status === "pending").length}
        onCreateTask={onCreateTask}
      />

      {/* 个人任务 */}
      <TaskSection title="个人任务" icon="👤" count={personalTasks.length}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {personalTasks.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={toggleTaskStatus} />
          ))}
        </div>
      </TaskSection>

      {/* 家庭任务 */}
      <TaskSection
        title="家庭任务"
        icon="🏠"
        count={groupTasks.length}
        subtitle="来自群组：温馨小家 ⭐"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupTasks.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={toggleTaskStatus} />
          ))}
        </div>
      </TaskSection>
    </section>
  );
}
