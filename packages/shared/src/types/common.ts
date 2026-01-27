// 通用类型定义

// 任务状态枚举
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

// 任务来源枚举
export type TaskSource = "ai" | "human";

// 优先级枚举
export type Priority = "high" | "medium" | "low";

// 重复规则类型
export type RecurringRule = {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // 间隔（如每2周 = interval: 2）
  daysOfWeek?: number[]; // 周几（0=周日, 1=周一...6=周六）仅weekly使用
  dayOfMonth?: number; // 每月几号（1-31）仅monthly使用
  endDate?: string; // 结束日期（可选，如 '2026-12-31'）
  endAfterOccurrences?: number; // 或指定生成N次后结束
};
