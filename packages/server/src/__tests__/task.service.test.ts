import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TaskService } from "../services/task.service";

// Build a controllable mock DB with only the methods used by TaskService.
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

// Build a select chain mock; the terminal method resolves a Promise.
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

// Build an update chain mock.
function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

// Build a delete chain mock.
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
    // First select: validate assignedToIds exist
    db.select
      .mockReturnValueOnce(makeSelectChain({ terminal: "where", value: [{ id: 1 }, { id: 2 }] }))
      // Second select: validate assignees are group members
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

    // Mock instance dates to avoid real time calculation.
    vi.spyOn(service as any, "calculateInstanceDates").mockReturnValue([
      "2024-02-01",
      "2024-02-02",
    ]);

    // First insert: template task
    const insertTemplate = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 100 }]),
      }),
    };
    // Second insert: instance tasks
    const insertInstances = {
      values: vi.fn().mockResolvedValue(undefined),
    };
    // Third insert: task assignments
    const insertAssignments = {
      values: vi.fn().mockResolvedValue(undefined),
    };
    db.insert
      .mockReturnValueOnce(insertTemplate)
      .mockReturnValueOnce(insertInstances)
      .mockReturnValueOnce(insertAssignments);

    // Query instance task IDs
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

    // Assignments should include template + instances (3 tasks) * 2 users = 6 rows
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

    // 1) User groups
    db.select
      .mockReturnValueOnce(makeSelectChain({ terminal: "where", value: [{ groupId: 1 }] }))
      // 2) Total count
      .mockReturnValueOnce(makeSelectChain({ terminal: "where", value: [{ count: 1 }] }))
      // 3) Task list
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
      // 4) Task assignments
      .mockReturnValueOnce(
        makeSelectChain({
          terminal: "where",
          value: [{ taskId: 10, userId: 2 }],
        }),
      )
      // 5) User names
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
