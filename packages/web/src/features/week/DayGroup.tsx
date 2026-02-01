import type { Task, Group } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WeekTaskCard } from "@/components/task/WeekTaskCard";
import { TaskSection } from "@/components/task/TaskSection";

interface DayGroupProps {
  date: Date;
  dayIndex: number;
  personalTasks: Task[];
  defaultGroup?: { group: Group; tasks: Task[] };
  otherGroups: { group: Group; tasks: Task[] }[];
  onToggle: (taskId: number) => void;
  onViewTask?: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: number) => void;
}

const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function DayGroup({
  date,
  personalTasks,
  defaultGroup,
  otherGroups,
  onToggle,
  onViewTask,
  onEditTask,
  onDeleteTask,
}: DayGroupProps) {
  const isToday = new Date().toDateString() === date.toDateString();
  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
  const dayOfWeek = date.getDay();

  const formatDate = () => {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  return (
    <div className={cn("rounded-xl", isPast && !isToday && "opacity-60")}>
      {/* Day Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            "w-16 h-16 rounded-xl flex flex-col items-center justify-center",
            isToday ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-600",
          )}
        >
          <span className="text-xs font-medium">{weekdayNames[dayOfWeek]}</span>
          <span className="text-lg font-bold">{date.getDate()}</span>
        </div>
        <div>
          <div className="font-medium text-gray-700 flex items-center gap-2">
            {formatDate()}
            {isToday && <Badge className="bg-orange-500 text-white">今天</Badge>}
          </div>
          <div className="text-sm text-gray-400">
            {(() => {
              const totalTaskCount =
                personalTasks.length +
                (defaultGroup?.tasks.length || 0) +
                otherGroups.reduce((sum, g) => sum + g.tasks.length, 0);
              return totalTaskCount === 0 ? "无任务" : `${totalTaskCount}个任务`;
            })()}
          </div>
        </div>
      </div>

      {/* Tasks */}
      {(() => {
        const totalTaskCount =
          personalTasks.length +
          (defaultGroup?.tasks.length || 0) +
          otherGroups.reduce((sum, g) => sum + g.tasks.length, 0);

        if (totalTaskCount === 0) {
          return (
            <div className="ml-20 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
              <p className="text-sm text-gray-400">暂无任务</p>
            </div>
          );
        }

        return (
          <div className="ml-20 space-y-4">
            {/* 个人任务 */}
            {personalTasks.length > 0 && (
              <TaskSection title="个人任务" icon="👤" count={personalTasks.length} collapsible={false}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                  {personalTasks.map((task) => (
                    <WeekTaskCard
                      key={task.id}
                      task={task}
                      onToggle={onToggle}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onClick={onViewTask}
                    />
                  ))}
                </div>
              </TaskSection>
            )}

            {/* 默认群组任务 */}
            {defaultGroup && defaultGroup.tasks.length > 0 && (
              <TaskSection
                title={defaultGroup.group.name}
                icon={defaultGroup.group.icon || "🏠"}
                count={defaultGroup.tasks.length}
                subtitle="默认群组"
                collapsible={false}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                  {defaultGroup.tasks.map((task) => (
                    <WeekTaskCard
                      key={task.id}
                      task={task}
                      onToggle={onToggle}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onClick={onViewTask}
                    />
                  ))}
                </div>
              </TaskSection>
            )}

            {/* 其他群组任务 */}
            {otherGroups.map((groupData) => {
              if (groupData.tasks.length === 0) return null;
              return (
                <TaskSection
                  key={groupData.group.id}
                  title={groupData.group.name}
                  icon={groupData.group.icon || "🏠"}
                  count={groupData.tasks.length}
                  collapsible={false}
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                    {groupData.tasks.map((task) => (
                      <WeekTaskCard
                        key={task.id}
                        task={task}
                        onToggle={onToggle}
                        onEdit={onEditTask}
                        onDelete={onDeleteTask}
                        onClick={onViewTask}
                      />
                    ))}
                  </div>
                </TaskSection>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
