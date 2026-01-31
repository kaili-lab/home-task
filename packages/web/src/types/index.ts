import type { TaskStatus, Priority, TaskSource, RecurringRule } from "shared";
import type { UserGroup } from "shared";
export type { TaskStatus, Priority, TaskSource, RecurringFreq, RecurringRule } from "shared";

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  groupId?: number;
  createdBy: number;
  assignedTo: number[];
  completedBy?: number;
  completedAt?: string;
  source: TaskSource;
  isRecurring: boolean;
  recurringRule?: RecurringRule;
  recurringParentId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  initials: string;
  color: string;
}

// 前端扩展的群组类型，基于 UserGroup 添加前端显示需要的字段
export interface Group extends Omit<UserGroup, "joinedAt" | "createdAt"> {
  icon: string; // 前端显示用的图标
  memberCount: number; // 成员数量
  createdAt?: string; // 可选，兼容 mock 数据
  updatedAt?: string; // 可选，兼容 mock 数据
}

export interface ChatMessage {
  id: number;
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

export type TabType = "today" | "week" | "ai" | "group" | "profile";
