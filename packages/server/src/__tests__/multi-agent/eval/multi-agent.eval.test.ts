import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TaskInfo } from "shared";
import { MultiAgentService } from "../../../services/multi-agent";

// 使用内存数据结构模拟任务与提醒，避免依赖真实数据库
let taskIdSeq = 1;
const tasksStore: TaskInfo[] = [];
const remindersStore: Array<{ id: number; userId: number; content: string; status: string }> = [];
let reminderIdSeq = 1;

vi.mock("../../../services/task.service", () => {
  return {
    TaskService: vi.fn().mockImplementation(() => ({
      async createTask(userId: number, data: any) {
        const task: TaskInfo = {
          id: taskIdSeq++,
          title: data.title,
          description: data.description ?? null,
          status: "pending",
          priority: data.priority ?? "medium",
          groupId: data.groupId ?? null,
          groupName: null,
          createdBy: userId,
          createdByName: null,
          assignedToIds: data.assignedToIds ?? [userId],
          assignedToNames: [],
          completedBy: null,
          completedByName: null,
          completedAt: null,
          dueDate: data.dueDate ?? null,
          startTime: data.startTime ?? null,
          endTime: data.endTime ?? null,
          timeSegment: data.timeSegment ?? "all_day",
          source: data.source ?? "ai",
          isRecurring: false,
          recurringRule: null,
          recurringParentId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        tasksStore.push(task);
        return task;
      },
      async getTasks(_userId: number, filters: any) {
        const filtered = tasksStore.filter((t) => {
          if (filters.status && t.status !== filters.status) return false;
          if (filters.dueDate && t.dueDate !== filters.dueDate) return false;
          return true;
        });
        return { tasks: filtered, pagination: { page: 1, limit: 20, total: filtered.length, totalPages: 1 } };
      },
      async updateTask(taskId: number, _userId: number, data: any) {
        const task = tasksStore.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");
        Object.assign(task, {
          title: data.title ?? task.title,
          description: data.description ?? task.description,
          dueDate: data.dueDate ?? task.dueDate,
          startTime: data.startTime ?? task.startTime,
          endTime: data.endTime ?? task.endTime,
          timeSegment: data.timeSegment ?? task.timeSegment,
          priority: data.priority ?? task.priority,
          updatedAt: new Date().toISOString(),
        });
        return task;
      },
      async updateTaskStatus(taskId: number) {
        const task = tasksStore.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");
        task.status = "completed";
        task.completedAt = new Date().toISOString();
        return task;
      },
      async deleteTask(taskId: number) {
        const index = tasksStore.findIndex((t) => t.id === taskId);
        if (index >= 0) tasksStore.splice(index, 1);
      },
      async getTaskById(taskId: number) {
        const task = tasksStore.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");
        return task;
      },
    })),
  };
});

function makeDb() {
  return {
    insert: () => ({
      values: (value: any) => {
        if (value && value.content) {
          remindersStore.push({
            id: reminderIdSeq++,
            userId: value.userId,
            content: value.content,
            status: value.status ?? "pending",
          });
        }
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(remindersStore),
      }),
    }),
  };
}

beforeEach(() => {
  tasksStore.length = 0;
  remindersStore.length = 0;
  taskIdSeq = 1;
  reminderIdSeq = 1;
});

describe("multi-agent.eval", () => {
  // 真实 LLM 调用需要充足的超时时间
  it("端到端核心场景", { timeout: 120_000 }, async () => {
    // 无真实密钥时跳过，避免非预期失败
    if (!process.env.AIHUBMIX_API_KEY && !process.env.OPENAI_API_KEY) {
      return;
    }

    const service = new MultiAgentService(makeDb() as any, process.env as any, 0);

    const created = await service.chat(1, "帮我创建一个任务，明天去买菜");
    expect(created.type).toBe("task_summary");

    const completed = await service.chat(1, "完成写周报");
    expect(completed.content).toContain("完成");

    const calendar = await service.chat(1, "明天下午有空吗");
    expect(calendar.content.length).toBeGreaterThan(0);

    const weather = await service.chat(1, "明天天气怎么样");
    expect(weather.content.length).toBeGreaterThan(0);

    const combined = await service.chat(1, "周末早上去机场接人");
    expect(combined.content.length).toBeGreaterThan(0);

    const joke = await service.chat(1, "给我讲个笑话");
    expect(joke.content.length).toBeGreaterThan(0);
  });
});
