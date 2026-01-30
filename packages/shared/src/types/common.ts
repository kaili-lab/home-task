// 通用类型定义

// 任务状态枚举
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

// 任务来源枚举
export type TaskSource = "ai" | "human";

// 优先级枚举
export type Priority = "high" | "medium" | "low";

// 重复规则类型
export type RecurringRule = {
  freq: "daily" | "weekly" | "monthly";
  interval: number; // 间隔（如每2周 = interval: 2）
  startDate: string; // 开始日期 YYYY-MM-DD（必填）

  // 结束条件（二选一必填，业务层校验）
  endDate?: string; // 结束日期 YYYY-MM-DD
  endAfterOccurrences?: number; // 重复N次后结束

  // 按频率使用
  daysOfWeek?: number[]; // weekly 时使用（0=周日, 1=周一...6=周六）
  dayOfMonth?: number; // monthly 时使用（1-31）
};
