import { describe, it, expect } from "vitest";
import type { TaskInfo } from "shared";
import {
  diceCoefficient,
  filterTimeConflicts,
  findSemanticConflicts,
  normalizeTaskTitle,
} from "../../../services/multi-agent/utils/conflict.helpers";

// 统一构造任务是为了保证测试只关注冲突逻辑，不被字段缺失干扰
function makeTask(overrides: Partial<TaskInfo>): TaskInfo {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? "任务",
    description: overrides.description ?? null,
    status: overrides.status ?? "pending",
    priority: overrides.priority ?? "medium",
    groupId: overrides.groupId ?? null,
    groupName: overrides.groupName ?? null,
    createdBy: overrides.createdBy ?? 1,
    createdByName: overrides.createdByName ?? null,
    assignedToIds: overrides.assignedToIds ?? [1],
    assignedToNames: overrides.assignedToNames ?? ["user"],
    completedBy: overrides.completedBy ?? null,
    completedByName: overrides.completedByName ?? null,
    completedAt: overrides.completedAt ?? null,
    dueDate: overrides.dueDate ?? "2025-01-02",
    startTime: overrides.startTime ?? null,
    endTime: overrides.endTime ?? null,
    timeSegment: overrides.timeSegment ?? "all_day",
    source: overrides.source ?? "manual",
    isRecurring: overrides.isRecurring ?? false,
    recurringRule: overrides.recurringRule ?? null,
    recurringParentId: overrides.recurringParentId ?? null,
    createdAt: overrides.createdAt ?? "2025-01-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2025-01-01T00:00:00Z",
  };
}

describe("conflict.helpers - 正常 case", () => {
  it("14:00-15:00 vs 14:30-15:30 -> 时间冲突", () => {
    const tasks = [
      makeTask({ id: 1, startTime: "14:00", endTime: "15:00" }),
      makeTask({ id: 2, startTime: "14:30", endTime: "15:30" }),
    ];
    const conflicts = filterTimeConflicts(tasks, "14:15", "14:45");
    expect(conflicts.length).toBe(2);
  });

  it("14:00-15:00 vs 15:00-16:00 -> 无冲突", () => {
    const tasks = [makeTask({ id: 1, startTime: "14:00", endTime: "15:00" })];
    const conflicts = filterTimeConflicts(tasks, "15:00", "16:00");
    expect(conflicts.length).toBe(0);
  });

  it("取快递 vs 拿快递 -> 语义冲突", () => {
    const tasks = [makeTask({ id: 1, title: "取快递" })];
    const conflicts = findSemanticConflicts(tasks, "拿快递");
    expect(conflicts.length).toBe(1);
  });

  it("取快递 vs 开会 -> 无语义冲突", () => {
    const tasks = [makeTask({ id: 1, title: "取快递" })];
    const conflicts = findSemanticConflicts(tasks, "开会");
    expect(conflicts.length).toBe(0);
  });
});

describe("conflict.helpers - 异常 case", () => {
  it("空任务列表 -> 无冲突", () => {
    const conflicts = findSemanticConflicts([], "取快递");
    expect(conflicts.length).toBe(0);
  });

  it("标题为空 -> 无冲突", () => {
    const tasks = [makeTask({ id: 1, title: "取快递" })];
    const conflicts = findSemanticConflicts(tasks, "");
    expect(conflicts.length).toBe(0);
  });

  it("单字标题 -> bigram 退化，直接字符串比较", () => {
    expect(diceCoefficient("a", "a")).toBe(1);
    expect(diceCoefficient("a", "b")).toBe(0);
  });

  it("normalizeTaskTitle(\"\") -> \"\"", () => {
    expect(normalizeTaskTitle("")).toBe("");
  });

  it("diceCoefficient(\"\", \"abc\") -> 0", () => {
    expect(diceCoefficient("", "abc")).toBe(0);
  });
});
