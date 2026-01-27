import type { TaskStatus, TaskSource, Priority, RecurringRule } from "../types/common";

// 创建任务输入类型
export interface CreateTaskInput {
  title: string;
  description?: string;
  groupId?: number | null;
  assignedTo?: number | null;
  dueDate?: Date | null;
  source?: TaskSource;
  priority?: Priority;
  isRecurring?: boolean;
  recurringRule?: RecurringRule;
}

// 更新任务输入类型
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignedTo?: number | null;
  dueDate?: Date | null;
  priority?: Priority;
  isRecurring?: boolean;
  recurringRule?: RecurringRule | null;
}

// 任务筛选器类型
export interface TaskFilters {
  status?: TaskStatus;
  groupId?: number;
  assignedTo?: number | "me";
  priority?: Priority;
  excludeRecurringInstances?: boolean; // 是否排除重复任务的子实例
  page?: number;
  limit?: number;
}

// 任务信息类型
export interface TaskInfo {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  groupId: number | null;
  groupName: string | null;
  createdBy: number;
  createdByName: string | null;
  assignedTo: number | null;
  assignedToName: string | null;
  completedBy: number | null;
  completedByName: string | null;
  completedAt: Date | null;
  dueDate: Date | null;
  source: TaskSource;
  isRecurring: boolean;
  recurringRule: RecurringRule | null;
  recurringParentId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// 任务列表结果类型
export interface TaskListResult {
  tasks: TaskInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
