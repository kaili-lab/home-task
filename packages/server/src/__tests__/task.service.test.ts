import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TaskService } from "../services/task.service";

// 只保留 TaskService 会用到的方法，避免无关依赖干扰测试意图。
function makeDb(overrides: Partial<any> = {}) {
  return {
    query: {
      groupUsers: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
      groups: { findFirst: vi.fn() },
      tasks: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

// 链式调用保持一致，末端方法返回 Promise 才能贴近真实查询行为。
function makeSelectChain<T>({
  terminal,
  value,
}: {
  terminal: "where" | "limit" | "offset";
  value: T;
}) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };
  chain[terminal] = vi.fn().mockResolvedValue(value);
  return chain;
}

// 更新链保持最小实现，避免测试被无关链式细节牵扯。
function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

// 删除链仅覆盖必要分支，减少无意义的模拟复杂度。
function makeDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

describe("TaskService - create task & validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("group task: creator not in group", async () => {
    const db = makeDb();
    db.query.groupUsers.findFirst.mockResolvedValue(undefined);
    const service = new TaskService(db as any);

    await expect(
      service.createTask(1, {
        title: "test",
        description: "desc",
        dueDate: "2099-01-01",
        groupId: 99,
        assignedToIds: [1],
      }),
    ).rejects.toThrow();
  });

  it("assignees include missing user", async () => {
    const db = makeDb();
    const chain = makeSelectChain({ terminal: "where", value: [{ id: 1 }] });
    db.select.mockReturnValueOnce(chain);
    const service = new TaskService(db as any);

    await expect(
      service.createTask(1, {
        title: "test",
        description: "desc",
        dueDate: "2099-01-01",
        assignedToIds: [1, 2],
      }),
    ).rejects.toThrow();
  });

  it("group task: assignee not in group", async () => {
    const db = makeDb();
    db.query.groupUsers.findFirst.mockResolvedValue({ id: 1 });
    // 第一次 select 只验证 assignedToIds 是否存在，防止后续逻辑掩盖问题。
    db.select
      .mockReturnValueOnce(makeSelectChain({ terminal: "where", value: [{ id: 1 }, { id: 2 }] }))
      // 第二次 select 校验组成员关系，确保权限规则被单独验证。
      .mockReturnValueOnce(makeSelectChain({ terminal: "where", value: [{ userId: 1 }] }));

    const service = new TaskService(db as any);

    await expect(
      service.createTask(1, {
        title: "test",
        description: "desc",
        dueDate: "2099-01-01",
        groupId: 1,
        assignedToIds: [1, 2],
      }),
    ).rejects.toThrow();
  });

  it("startTime / endTime only one set", async () => {
    const db = makeDb();
    const service = new TaskService(db as any);

    await expect(
      service.createTask(1, {
        title: "test",
        description: "desc",
        dueDate: "2099-01-01",
        startTime: "10:00",
      }),
    ).rejects.toThrow();
  });

  it("today afternoon cannot pick forenoon", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 5, 14, 0, 0));
    const db = makeDb();
    const service = new TaskService(db as any);
    const today = "2026-02-05";

    await expect(
      service.createTask(1, {
        title: "test",
        description: "desc",
        dueDate: today,
        timeSegment: "forenoon",
      }),
    ).rejects.toThrow();

    vi.useRealTimers();
  });

  it("today evening cannot pick afternoon", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 5, 20, 0, 0));
    const db = makeDb();
    const service = new TaskService(db as any);
    const today = "2026-02-05";

    await expect(
      service.createTask(1, {
        title: "test",
        description: "desc",
        dueDate: today,
        timeSegment: "afternoon",
      }),
    ).rejects.toThrow();

    vi.useRealTimers();
  });

  it("today evening cannot pick all_day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 5, 20, 0, 0));
    const db = makeDb();
    const service = new TaskService(db as any);
    const today = "2026-02-05";

    await expect(
      service.createTask(1, {
        title: "test",
        description: "desc",
        dueDate: today,
        timeSegment: "all_day",
      }),
    ).rejects.toThrow();

    vi.useRealTimers();
  });

  it("create normal task success (all day)", async () => {
    const db = makeDb();
    const insertChain = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }),
    };
    db.insert.mockReturnValueOnce(insertChain);

    const service = new TaskService(db as any);
    const getTaskSpy = vi
      .spyOn(service as any, "getTaskById")
      .mockResolvedValue({ id: 10, title: "test" });

    const result = await service.createTask(1, {
      title: "test",
      description: "desc",
      dueDate: "2099-01-01",
    });

    expect(result).toEqual({ id: 10, title: "test" });
    const insertPayload = insertChain.values.mock.calls[0][0];
    expect(insertPayload.timeSegment).toBe("all_day");
    expect(insertPayload.startTime).toBeNull();
    expect(insertPayload.endTime).toBeNull();
    expect(getTaskSpy).toHaveBeenCalledWith(10, 1);
  });

  it("recurring task triggers validateRecurringRule + createRecurringTask", async () => {
    const db = makeDb();
    const service = new TaskService(db as any);

    const validateSpy = vi.spyOn(service as any, "validateRecurringRule").mockImplementation(() => {});
    const createRecurringSpy = vi
      .spyOn(service as any, "createRecurringTask")
      .mockResolvedValue({ id: 1, title: "recurring" });

    const result = await service.createTask(1, {
      title: "recurring",
      description: "desc",
      isRecurring: true,
      recurringRule: {
        freq: "daily",
        interval: 1,
        startDate: "2099-01-01",
        endAfterOccurrences: 1,
      },
    } as any);

    expect(validateSpy).toHaveBeenCalled();
    expect(createRecurringSpy).toHaveBeenCalled();
    expect(result).toEqual({ id: 1, title: "recurring" });
  });
});

describe("TaskService - recurring rule validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("default endDate when missing end fields", () => {
    const db = makeDb();
    const service = new TaskService(db as any);
    const rule: any = {
      freq: "daily",
      interval: 1,
      startDate: "2099-01-01",
    };

    (service as any).validateRecurringRule(rule);

    expect(rule.endDate).toBe("2100-01-01");
  });

  it("weekly requires daysOfWeek", () => {
    const db = makeDb();
    const service = new TaskService(db as any);
    const rule: any = {
      freq: "weekly",
      interval: 1,
      startDate: "2099-01-01",
    };

    expect(() => (service as any).validateRecurringRule(rule)).toThrow();
  });

  it("monthly requires dayOfMonth", () => {
    const db = makeDb();
    const service = new TaskService(db as any);
    const rule: any = {
      freq: "monthly",
      interval: 1,
      startDate: "2099-01-01",
    };

    expect(() => (service as any).validateRecurringRule(rule)).toThrow();
  });

  it("endAfterOccurrences > 365 throws", () => {
    const db = makeDb();
    const service = new TaskService(db as any);
    const rule: any = {
      freq: "daily",
      interval: 1,
      startDate: "2099-01-01",
      endAfterOccurrences: 366,
    };

    expect(() => (service as any).validateRecurringRule(rule)).toThrow();
  });

  it("endDate <= today throws", () => {
    const db = makeDb();
    const service = new TaskService(db as any);
    const rule: any = {
      freq: "daily",
      interval: 1,
      startDate: "2024-01-10",
      endDate: "2024-01-10",
    };

    expect(() => (service as any).validateRecurringRule(rule)).toThrow();
  });

  it("endDate span > 1 year throws", () => {
    const db = makeDb();
    const service = new TaskService(db as any);
    const rule: any = {
      freq: "daily",
      interval: 1,
      startDate: "2024-01-01",
      endDate: "2025-01-03",
    };

    expect(() => (service as any).validateRecurringRule(rule)).toThrow();
  });

  it("endDate < startDate throws", () => {
    const db = makeDb();
    const service = new TaskService(db as any);
    const rule: any = {
      freq: "daily",
      interval: 1,
      startDate: "2024-02-01",
      endDate: "2024-01-31",
    };

    expect(() => (service as any).validateRecurringRule(rule)).toThrow();
  });
});

describe("TaskService - recurring task creation flow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createRecurringTask: template + instances + assignments", async () => {
    const db = makeDb();
    const service = new TaskService(db as any);

    // 固定实例日期，避免真实时间计算导致测试不稳定。
    vi.spyOn(service as any, "calculateInstanceDates").mockReturnValue([
      "2024-02-01",
      "2024-02-02",
    ]);

    // 第一次 insert 写入模板任务，便于区分模板与实例。
    const insertTemplate = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 100 }]),
      }),
    };
    // 第二次 insert 写入实例任务，保证流程覆盖完整路径。
    const insertInstances = {
      values: vi.fn().mockResolvedValue(undefined),
    };
    // 第三次 insert 写入任务分配，用于验证关联数量是否正确。
    const insertAssignments = {
      values: vi.fn().mockResolvedValue(undefined),
    };
    db.insert
      .mockReturnValueOnce(insertTemplate)
      .mockReturnValueOnce(insertInstances)
      .mockReturnValueOnce(insertAssignments);

    // 查询实例任务 ID，确保后续分配依赖于真实查询结果。
    db.select.mockReturnValueOnce(
      makeSelectChain({ terminal: "where", value: [{ id: 101 }, { id: 102 }] }),
    );

    vi.spyOn(service as any, "getTaskById").mockResolvedValue({ id: 100, title: "temp" });

    await (service as any).createRecurringTask(1, {
      title: "temp",
      description: "desc",
      groupId: null,
      dueDate: null,
      startTime: null,
      endTime: null,
      priority: "medium",
      source: "human",
      isRecurring: true,
      recurringRule: { freq: "daily", interval: 1, startDate: "2024-02-01" },
      assignedToIds: [1, 2],
    });

    // 分配需要覆盖模板与实例，确保数量校验能反映整体关系。
    const assignmentsArg = insertAssignments.values.mock.calls[0][0];
    expect(assignmentsArg).toHaveLength(6);
  });
});

describe("TaskService - query / update / delete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getTasks returns expected data", async () => {
    const db = makeDb();
    const service = new TaskService(db as any);

    // 1) 先查询用户所属组，保证后续权限与范围正确。
    db.select
      .mockReturnValueOnce(makeSelectChain({ terminal: "where", value: [{ groupId: 1 }] }))
      // 2) 再拿总数，避免分页结果与统计不一致。
      .mockReturnValueOnce(makeSelectChain({ terminal: "where", value: [{ count: 1 }] }))
      // 3) 然后查询任务列表，确保数据结构完整可用。
      .mockReturnValueOnce(
        makeSelectChain({
          terminal: "offset",
          value: [
            {
              tasks: {
                id: 10,
                title: "task",
                description: "desc",
                status: "pending",
                priority: "medium",
                groupId: 1,
                createdBy: 1,
                completedBy: null,
                completedAt: null,
                dueDate: "2024-02-01",
                startTime: null,
                endTime: null,
                source: "human",
                isRecurring: false,
                recurringRule: null,
                recurringParentId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              groups: { name: "G1" },
            },
          ],
        }),
      )
      // 4) 接着查询任务分配，便于还原负责人信息。
      .mockReturnValueOnce(
        makeSelectChain({
          terminal: "where",
          value: [{ taskId: 10, userId: 2 }],
        }),
      )
      // 5) 最后查用户姓名，保证展示字段可组装。
      .mockReturnValueOnce(
        makeSelectChain({
          terminal: "where",
          value: [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
          ],
        }),
      );

    const result = await service.getTasks(1, {});
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].assignedToNames).toEqual(["Bob"]);
    expect(result.tasks[0].createdByName).toBe("Alice");
  });

  it("updateTask: non-creator should throw", async () => {
    const db = makeDb();
    db.query.tasks.findFirst.mockResolvedValue({ id: 1, createdBy: 2 });
    const service = new TaskService(db as any);

    await expect(
      service.updateTask(1, 1, { title: "new" }),
    ).rejects.toThrow();
  });

  it("updateTask: assignees include missing user", async () => {
    const db = makeDb();
    db.query.tasks.findFirst.mockResolvedValue({ id: 1, createdBy: 1, groupId: null });
    db.select.mockReturnValueOnce(makeSelectChain({ terminal: "where", value: [{ id: 1 }] }));
    const service = new TaskService(db as any);

    await expect(
      service.updateTask(1, 1, { assignedToIds: [1, 2] }),
    ).rejects.toThrow();
  });

  it("updateTaskStatus: completed sets completedBy/completedAt", async () => {
    const db = makeDb();
    db.query.tasks.findFirst.mockResolvedValue({ id: 1, createdBy: 1, groupId: null });
    const updateChain = makeUpdateChain();
    db.update.mockReturnValueOnce(updateChain);

    const service = new TaskService(db as any);
    vi.spyOn(service as any, "getTaskById").mockResolvedValue({ id: 1 });

    await service.updateTaskStatus(1, 1, "completed");
    const setArg = updateChain.set.mock.calls[0][0];
    expect(setArg.completedBy).toBe(1);
    expect(setArg.completedAt).toBeInstanceOf(Date);
  });

  it("updateTaskStatus: pending clears completedBy/completedAt", async () => {
    const db = makeDb();
    db.query.tasks.findFirst.mockResolvedValue({ id: 1, createdBy: 1, groupId: null });
    const updateChain = makeUpdateChain();
    db.update.mockReturnValueOnce(updateChain);

    const service = new TaskService(db as any);
    vi.spyOn(service as any, "getTaskById").mockResolvedValue({ id: 1 });

    await service.updateTaskStatus(1, 1, "pending");
    const setArg = updateChain.set.mock.calls[0][0];
    expect(setArg.completedBy).toBeNull();
    expect(setArg.completedAt).toBeNull();
  });

  it("deleteTask: non-creator should throw", async () => {
    const db = makeDb();
    db.query.tasks.findFirst.mockResolvedValue({ id: 1, createdBy: 2 });
    db.delete.mockReturnValueOnce(makeDeleteChain());
    const service = new TaskService(db as any);

    await expect(service.deleteTask(1, 1)).rejects.toThrow();
  });
});
