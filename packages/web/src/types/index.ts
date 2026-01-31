import type { TaskStatus, Priority, TaskSource, RecurringRule } from "shared";
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

export interface Group {
  id: number;
  name: string;
  icon: string;
  isDefault: boolean;
  memberCount: number;
  inviteCode?: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

export type TabType = "today" | "week" | "ai" | "group" | "profile";
