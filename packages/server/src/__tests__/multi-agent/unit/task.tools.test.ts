import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import type { TaskInfo } from "shared";
import {
  createTaskTool,
  finishTaskTool,
  modifyTaskTool,
  queryTasksTool,
  removeTaskTool,
} from "../../../services/multi-agent/tools/task.tools";

// 使用 mock 方式隔离数据库依赖，保证工具逻辑可控
const mockCreateTask = vi.fn();
const mockGetTasks = vi.fn();
const mockUpdateTask = vi.fn();
const mockUpdateTaskStatus = vi.fn();
const mockDeleteTask = vi.fn();
const mockGetTaskById = vi.fn();

vi.mock("../../../services/task.service", () => {
  return {
    TaskService: vi.fn().mockImplementation(() => ({
      createTask: mockCreateTask,
      getTasks: mockGetTasks,
      updateTask: mockUpdateTask,
      updateTaskStatus: mockUpdateTaskStatus,
      deleteTask: mockDeleteTask,
      getTaskById: mockGetTaskById,
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

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  mockCreateTask.mockReset();
  mockGetTasks.mockReset();
  mockUpdateTask.mockReset();
  mockUpdateTaskStatus.mockReset();
  mockDeleteTask.mockReset();
  mockGetTaskById.mockReset();
});

describe("task.tools - 正常 case", () => {
  it("create_task 完整参数 -> success", async () => {
    // 固定时间到 06:00 UTC，确保 09:00-10:00 时间段尚未过去
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-11T06:00:00Z"));

    mockGetTasks.mockResolvedValue({ tasks: [] });
    const created = makeTask({ title: "写周报", startTime: "09:00", endTime: "10:00" });
    mockCreateTask.mockResolvedValue(created);

    const result = await createTaskTool.invoke(
      {
        title: "写周报",
        dueDate: "2026-02-11",
        startTime: "09:00",
        endTime: "10:00",
      },
      makeConfig(),
    );
    const json = JSON.parse(result as string);
    expect(json.status).toBe("success");
    expect(json.task.title).toBe("写周报");
  });

  it("create_task 无时间信息 -> 自动填充默认 timeSegment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T08:00:00Z"));
    mockGetTasks.mockResolvedValue({ tasks: [] });
    const created = makeTask({ title: "买菜", timeSegment: "all_day" });
    mockCreateTask.mockResolvedValue(created);

    await createTaskTool.invoke(
      {
        title: "买菜",
        dueDate: "2026-02-11",
      },
      makeConfig(),
    );

    const args = mockCreateTask.mock.calls[0][1];
    expect(args.timeSegment).toBe("all_day");
  });

  it("finish_task({ title }) 匹配到 1 个 -> 直接完成", async () => {
    mockGetTasks.mockResolvedValue({ tasks: [makeTask({ id: 2, title: "写周报" })] });
    mockUpdateTaskStatus.mockResolvedValue(makeTask({ id: 2, title: "写周报", status: "completed" }));

    const result = await finishTaskTool.invoke({ title: "写周报" }, makeConfig());
    const json = JSON.parse(result as string);
    expect(json.status).toBe("success");
    expect(json.task.status).toBe("completed");
  });

  it("query_tasks({ dueDate }) -> 返回任务列表", async () => {
    mockGetTasks.mockResolvedValue({ tasks: [makeTask({ id: 3, title: "开会" })] });

    const result = await queryTasksTool.invoke({ dueDate: "2026-02-11" }, makeConfig());
    const json = JSON.parse(result as string);
    expect(json.status).toBe("success");
    expect(json.message).toContain("开会");
  });

  it("modify_task({ title }) 匹配到 1 个 -> 直接更新", async () => {
    mockGetTasks.mockResolvedValue({ tasks: [makeTask({ id: 4, title: "开会" })] });
    mockUpdateTask.mockResolvedValue(makeTask({ id: 4, title: "开会", dueDate: "2026-02-13" }));

    const result = await modifyTaskTool.invoke(
      { title: "开会", dueDate: "2026-02-13" },
      makeConfig(),
    );
    const json = JSON.parse(result as string);
    expect(json.status).toBe("success");
  });
});

describe("task.tools - 异常 case", () => {
  it("create_task 今天 + 时段已过 -> need_confirmation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T20:00:00Z"));
    mockGetTasks.mockResolvedValue({ tasks: [] });

    const result = await createTaskTool.invoke(
      { title: "跑步", timeSegment: "morning" },
      makeConfig(),
    );
    const json = JSON.parse(result as string);
    expect(json.status).toBe("need_confirmation");
  });

  it("create_task 语义冲突 -> conflict", async () => {
    mockGetTasks.mockResolvedValue({ tasks: [makeTask({ id: 5, title: "取快递" })] });

    const result = await createTaskTool.invoke(
      { title: "拿快递", dueDate: "2026-02-11" },
      makeConfig(),
    );
    const json = JSON.parse(result as string);
    expect(json.status).toBe("conflict");
    expect(json.conflictingTasks.length).toBeGreaterThan(0);
  });

  it("create_task 时间冲突 -> conflict", async () => {
    mockGetTasks.mockResolvedValue({
      tasks: [makeTask({ id: 6, title: "开会", startTime: "14:00", endTime: "15:00" })],
    });

    const result = await createTaskTool.invoke(
      { title: "写报告", dueDate: "2026-02-11", startTime: "14:30", endTime: "15:30" },
      makeConfig(),
    );
    const json = JSON.parse(result as string);
    expect(json.status).toBe("conflict");
  });

  it("create_task 有 startTime 无 endTime -> need_confirmation", async () => {
    mockGetTasks.mockResolvedValue({ tasks: [] });

    const result = await createTaskTool.invoke(
      { title: "整理资料", startTime: "09:00" },
      makeConfig(),
    );
    const json = JSON.parse(result as string);
    expect(json.status).toBe("need_confirmation");
  });

  it("finish_task 匹配 0 个 -> error", async () => {
    mockGetTasks.mockResolvedValue({ tasks: [] });

    const result = await finishTaskTool.invoke({ title: "写周报" }, makeConfig());
    const json = JSON.parse(result as string);
    expect(json.status).toBe("error");
  });

  it("finish_task 匹配多个 -> need_confirmation", async () => {
    mockGetTasks.mockResolvedValue({
      tasks: [makeTask({ id: 7, title: "开会" }), makeTask({ id: 8, title: "开会" })],
    });

    const result = await finishTaskTool.invoke({ title: "开会" }, makeConfig());
    const json = JSON.parse(result as string);
    expect(json.status).toBe("need_confirmation");
  });

  it("remove_task 无 taskId 也无 title -> error", async () => {
    const result = await removeTaskTool.invoke({}, makeConfig());
    const json = JSON.parse(result as string);
    expect(json.status).toBe("error");
  });
});
