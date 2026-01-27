import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type {
  TaskInfo,
  TaskListResult,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  TaskStatus,
} from "shared";

/**
 * 创建任务
 */
export async function createTask(data: CreateTaskInput) {
  const response = await apiPost<TaskInfo>("/api/tasks", data);
  return response.data;
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

  const queryString = params.toString();
  const endpoint = queryString ? `/api/tasks?${queryString}` : "/api/tasks";

  const response = await apiGet<TaskListResult>(endpoint);
  return response.data;
}

/**
 * 获取任务详情
 */
export async function getTaskById(id: number) {
  const response = await apiGet<TaskInfo>(`/api/tasks/${id}`);
  return response.data;
}

/**
 * 更新任务
 */
export async function updateTask(id: number, data: UpdateTaskInput) {
  const response = await apiPatch<TaskInfo>(`/api/tasks/${id}`, data);
  return response.data;
}

/**
 * 更新任务状态
 */
export async function updateTaskStatus(id: number, status: TaskStatus) {
  const response = await apiPatch<TaskInfo>(`/api/tasks/${id}/status`, { status });
  return response.data;
}

/**
 * 删除任务
 */
export async function deleteTask(id: number) {
  const response = await apiDelete<{ message: string }>(`/api/tasks/${id}`);
  return response.data;
}
