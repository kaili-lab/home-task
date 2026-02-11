import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import type { TaskInfo } from "shared";
import { createTaskAgent } from "../../../services/multi-agent/agents/task.agent";

// 使用 FakeListChatModel 是为了控制 LLM 输出，确保测试只验证工具调用链
const mockCreateTask = vi.fn();
const mockUpdateTaskStatus = vi.fn();
const mockGetTasks = vi.fn();

vi.mock("../../../services/task.service", () => {
  return {
    TaskService: vi.fn().mockImplementation(() => ({
      createTask: mockCreateTask,
      updateTaskStatus: mockUpdateTaskStatus,
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
  mockCreateTask.mockReset();
  mockUpdateTaskStatus.mockReset();
  mockGetTasks.mockReset();
});

describe("task.agent - 集成", () => {
  it("create_task tool call -> 执行并返回结果", async () => {
    mockGetTasks.mockResolvedValue({ tasks: [] });
    mockCreateTask.mockResolvedValue(makeTask({ title: "写周报" }));

    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "create_task",
              args: { title: "写周报", dueDate: "2026-02-11" },
              id: "call_1",
            },
          ],
        }),
        new AIMessage({ content: "任务已创建" }),
      ],
    });

    const agent = createTaskAgent(llm as any, 0);
    const result = await agent.invoke(
      { messages: [{ role: "user", content: "帮我写周报" }] },
      makeConfig(),
    );

    const lastMessage = result.messages[result.messages.length - 1];
    expect(String(lastMessage.content)).toContain("任务已创建");
  });

  it("finish_task tool call -> 执行完成", async () => {
    mockGetTasks.mockResolvedValue({ tasks: [makeTask({ id: 2, title: "写周报" })] });
    mockUpdateTaskStatus.mockResolvedValue(makeTask({ id: 2, title: "写周报", status: "completed" }));

    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "finish_task",
              args: { title: "写周报" },
              id: "call_2",
            },
          ],
        }),
        new AIMessage({ content: "已完成" }),
      ],
    });

    const agent = createTaskAgent(llm as any, 0);
    const result = await agent.invoke(
      { messages: [{ role: "user", content: "完成写周报" }] },
      makeConfig(),
    );

    const lastMessage = result.messages[result.messages.length - 1];
    expect(String(lastMessage.content)).toContain("已完成");
  });

  it("Tool 执行失败 -> 返回错误信息", async () => {
    // createReactAgent 捕获 Tool 异常后以 ToolMessage 形式返回，而非抛出
    mockGetTasks.mockResolvedValue({ tasks: [] });
    mockCreateTask.mockRejectedValue(new Error("DB failed"));

    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "create_task",
              args: { title: "写周报", dueDate: "2026-02-11" },
              id: "call_3",
            },
          ],
        }),
        new AIMessage({ content: "创建任务时出错了" }),
      ],
    });

    const agent = createTaskAgent(llm as any, 0);
    const result = await agent.invoke(
      { messages: [{ role: "user", content: "帮我写周报" }] },
      makeConfig(),
    );

    // 验证错误信息出现在消息链中（ToolMessage 或最终回复）
    const allContent = result.messages.map((m: any) => String(m.content)).join(" ");
    expect(allContent).toContain("DB failed");
  });
});
