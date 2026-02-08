import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type {
  TaskInfo,
  TaskListResult,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  TaskStatus,
} from "shared";
import { formatLocalDateTime } from "@/utils/date";

function mapTaskInfoTimes(task: TaskInfo): TaskInfo {
  // 在接口层统一格式化时间，避免组件重复处理导致格式不一致
  const createdAt = formatLocalDateTime(task.createdAt) ?? task.createdAt;
  const updatedAt = formatLocalDateTime(task.updatedAt) ?? task.updatedAt;
  const completedAt = task.completedAt
    ? formatLocalDateTime(task.completedAt) ?? task.completedAt
    : null;
  return { ...task, createdAt, updatedAt, completedAt };
}

function mapTaskListResultTimes(result: TaskListResult): TaskListResult {
  // 统一在进入 UI 前转换，保证列表与详情时间展示一致
  return {
    ...result,
    tasks: result.tasks.map(mapTaskInfoTimes),
  };
}

/**
 * 创建任务
 */
export async function createTask(data: CreateTaskInput) {
  const response = await apiPost<TaskInfo>("/api/tasks", data);
  return mapTaskInfoTimes(response.data);
}

/**
 * 获取任务列表
 */
export async function getTasks(filters?: TaskFilters) {
  // 构建查询参数
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.groupId !== undefined) {
    params.append("groupId", filters.groupId === null ? "null" : String(filters.groupId));
  }
  if (filters?.assignedTo !== undefined) {
    params.append("assignedTo", filters.assignedTo === "me" ? "me" : String(filters.assignedTo));
  }
  if (filters?.priority) params.append("priority", filters.priority);
  if (filters?.excludeRecurringInstances) {
    params.append("excludeRecurringInstances", "true");
  }
  if (filters?.page) params.append("page", String(filters.page));
  if (filters?.limit) params.append("limit", String(filters.limit));
  if (filters?.dueDate) params.append("dueDate", filters.dueDate);
  if (filters?.dueDateFrom) params.append("dueDateFrom", filters.dueDateFrom);
  if (filters?.dueDateTo) params.append("dueDateTo", filters.dueDateTo);
  if (filters?.includeNullDueDate) params.append("includeNullDueDate", "true");

  const queryString = params.toString();
  const endpoint = queryString ? `/api/tasks?${queryString}` : "/api/tasks";

  const response = await apiGet<TaskListResult>(endpoint);
  return mapTaskListResultTimes(response.data);
}

/**
 * 获取任务详情
 */
export async function getTaskById(id: number) {
  const response = await apiGet<TaskInfo>(`/api/tasks/${id}`);
  return mapTaskInfoTimes(response.data);
}

/**
 * 更新任务
 */
export async function updateTask(id: number, data: UpdateTaskInput) {
  const response = await apiPatch<TaskInfo>(`/api/tasks/${id}`, data);
  return mapTaskInfoTimes(response.data);
}

/**
 * 更新任务状态
 */
export async function updateTaskStatus(id: number, status: TaskStatus) {
  const response = await apiPatch<TaskInfo>(`/api/tasks/${id}/status`, { status });
  return mapTaskInfoTimes(response.data);
}

/**
 * 删除任务
 */
export async function deleteTask(id: number) {
  const response = await apiDelete<{ message: string }>(`/api/tasks/${id}`);
  return response.data;
}
