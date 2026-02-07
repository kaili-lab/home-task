import { useQuery, useQueries } from "@tanstack/react-query";
import type { Task } from "@/types";
import type { TaskInfo, TaskFilters } from "shared";
import { getTasks } from "@/services/tasks.api";

/**
 * 将 TaskInfo 转换为 Task 类型
 */
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

export function useTaskList(filters?: TaskFilters) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tasks", filters],
    queryFn: async () => {
      const result = await getTasks(filters);
      return result.tasks.map(taskInfoToTask);
    },
    keepPreviousData: true,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const tasks: Task[] = data || [];
  const loading = isLoading;

  const toggleTaskStatus = (taskId: number) => {
    // TODO: 实现任务状态切换的API调用
    console.log("切换任务状态:", taskId);
  };

  return { tasks, loading, toggleTaskStatus, refetch };
}

/**
 * 按群组查询任务列表
 * @param groupId - 群组ID，null表示个人任务，undefined表示不查询
 * @param dateFilter - 日期过滤条件
 */
export function useTaskListByGroup(
  groupId: number | null | undefined,
  dateFilter?: { dueDate?: string; dueDateFrom?: string; dueDateTo?: string }
) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tasks", "group", groupId, dateFilter],
    queryFn: async () => {
      const filters: TaskFilters = { groupId: groupId === undefined ? undefined : groupId };
      
      // 添加日期过滤
      if (dateFilter?.dueDate) {
        filters.dueDate = dateFilter.dueDate;
      }
      if (dateFilter?.dueDateFrom) {
        filters.dueDateFrom = dateFilter.dueDateFrom;
      }
      if (dateFilter?.dueDateTo) {
        filters.dueDateTo = dateFilter.dueDateTo;
      }
      
      const result = await getTasks(filters);
      return result.tasks.map(taskInfoToTask);
    },
    enabled: groupId !== undefined, // 只有在groupId不是undefined时才查询（null表示个人任务，需要查询）
    keepPreviousData: true,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const tasks: Task[] = data || [];
  const loading = isLoading;

  return { tasks, loading, refetch };
}

/**
 * 查询多个群组的任务
 * @param groupIds - 群组ID数组
 */
export function useOtherGroupsTasks(groupIds: number[]) {
  const queries = useQueries({
    queries: groupIds.map((groupId) => ({
      queryKey: ["tasks", "group", groupId],
      queryFn: async () => {
        const result = await getTasks({ groupId });
        return {
          groupId,
          tasks: result.tasks.map(taskInfoToTask),
        };
      },
    })),
  });

  const groupTasks = queries.map((query, index) => ({
    groupId: groupIds[index],
    tasks: query.data?.tasks || [],
    loading: query.isLoading,
  }));

  const isLoading = queries.some((query) => query.isLoading);

  return { groupTasks, isLoading };
}
