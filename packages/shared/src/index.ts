// 统一导出所有类型

// 通用类型
export type {
  TaskStatus,
  TaskSource,
  Priority,
  RecurringFreq,
  RecurringRule,
} from "./types/common";

// API响应类型
export type { ApiSuccessResponse, ApiErrorResponse, ApiResponse } from "./api/response";

// 任务相关类型
export type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  TaskInfo,
  TaskListResult,
} from "./api/tasks";

// 用户相关类型
export type { UpdateUserInput, UserInfo, UserGroup } from "./api/users";

// 群组相关类型
export type { CreateGroupInput, UpdateGroupInput, GroupInfo, GroupDetail } from "./api/groups";

// 设备相关类型
export type { CreateDeviceInput, DeviceInfo, DeviceTask } from "./api/devices";

// AI相关类型
export type { MessageInput, AIChatInput, AIChatResponse } from "./api/ai";
