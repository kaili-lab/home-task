import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TaskInfo } from "shared";
import { findFreeSlotsTool, getDayScheduleTool } from "../../../services/multi-agent/tools/calendar.tools";

// 使用 mock TaskService 让测试只关注时间计算逻辑
const mockGetTasks = vi.fn();

vi.mock("../../../services/task.service", () => {
  return {
    TaskService: vi.fn().mockImplementation(() => ({
      getTasks: mockGetTasks,
    })),
  };
});

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
    dueDate: overrides.dueDate ?? "2026-02-11",
    startTime: overrides.startTime ?? null,
    endTime: overrides.endTime ?? null,
    timeSegment: overrides.timeSegment ?? "all_day",
    source: overrides.source ?? "ai",
    isRecurring: overrides.isRecurring ?? false,
    recurringRule: overrides.recurringRule ?? null,
    recurringParentId: overrides.recurringParentId ?? null,
    createdAt: overrides.createdAt ?? "2026-02-10T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-02-10T00:00:00Z",
  };
}

function makeConfig() {
  return {
    configurable: {
      db: {},
      userId: 1,
      timezoneOffsetMinutes: 0,
    },
  };
}

beforeEach(() => {
  mockGetTasks.mockReset();
});

describe("calendar.tools - 正常 case", () => {
  it("get_day_schedule 返回按时间排序的时间线", async () => {
    mockGetTasks.mockResolvedValue({
      tasks: [
        makeTask({ title: "下午会议", startTime: "15:00", endTime: "16:00" }),
        makeTask({ title: "早会", startTime: "09:00", endTime: "09:30" }),
        makeTask({ title: "写报告", timeSegment: "afternoon" }),
      ],
    });

    const result = await getDayScheduleTool.invoke({ date: "2026-02-11" }, makeConfig());
    const json = JSON.parse(result as string);
    expect(json.status).toBe("success");
    expect(json.message).toContain("09:00-09:30");
  });

  it("find_free_slots 返回 3 个空闲区间", async () => {
    mockGetTasks.mockResolvedValue({
      tasks: [
        makeTask({ startTime: "10:00", endTime: "11:00" }),
        makeTask({ startTime: "14:00", endTime: "15:00" }),
      ],
    });

    const result = await findFreeSlotsTool.invoke(
      { date: "2026-02-11", startHour: 9, endHour: 18 },
      makeConfig(),
    );
    const json = JSON.parse(result as string);
    expect(json.status).toBe("success");
    expect(json.data.freeSlots.length).toBe(3);
  });
});

describe("calendar.tools - 异常 case", () => {
  it("某天无任务 -> 返回当天没有安排", async () => {
    mockGetTasks.mockResolvedValue({ tasks: [] });

    const result = await getDayScheduleTool.invoke({ date: "2026-02-11" }, makeConfig());
    const json = JSON.parse(result as string);
    expect(json.message).toContain("当天没有安排");
  });

  it("全天排满 -> 返回当天没有空闲时间", async () => {
    mockGetTasks.mockResolvedValue({
      tasks: [makeTask({ startTime: "09:00", endTime: "18:00" })],
    });

    const result = await findFreeSlotsTool.invoke(
      { date: "2026-02-11", startHour: 9, endHour: 18 },
      makeConfig(),
    );
    const json = JSON.parse(result as string);
    expect(json.message).toContain("当天没有空闲时间");
  });
});
