import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentLoop } from "../../../../services/ai/agent-loop";

const langchainMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn(() => ({
    invoke: langchainMocks.invoke,
  })),
}));

function createAgentLoop(overrides?: {
  historyManager?: Record<string, any>;
  promptBuilder?: Record<string, any>;
  hallucinationGuard?: Record<string, any>;
  toolExecutor?: Record<string, any>;
  env?: Record<string, any>;
}) {
  const historyManager = {
    loadHistory: vi.fn().mockResolvedValue([]),
    loadLastAssistantMessage: vi.fn().mockResolvedValue(null),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    ...overrides?.historyManager,
  };

  const promptBuilder = {
    buildSystemPrompt: vi.fn().mockResolvedValue("system prompt"),
    hasTimeSegmentHint: vi.fn().mockReturnValue(false),
    inferTimeSegmentFromText: vi.fn().mockReturnValue("all_day"),
    isSegmentAllowedForToday: vi.fn().mockReturnValue(true),
    buildSegmentNotAllowedMessage: vi.fn().mockReturnValue("不允许的时段"),
    getTodayDate: vi.fn().mockReturnValue("2026-04-11"),
    ...overrides?.promptBuilder,
  };

  const hallucinationGuard = {
    evaluateUserMessage: vi.fn().mockReturnValue({
      inferredIntent: "create",
      requireToolCall: false,
      skipSemanticConflictCheck: false,
    }),
    resolveNoToolCallResponse: vi
      .fn()
      .mockImplementation(({ llmContent }) => ({
        action: "return_as_is",
        content: llmContent,
      })),
    ...overrides?.hallucinationGuard,
  };

  const toolExecutor = {
    executeToolCall: vi.fn(),
    ...overrides?.toolExecutor,
  };

  const env = {
    NODE_ENV: "test",
    OPENAI_API_KEY: "test-key",
    AIHUBMIX_API_KEY: undefined,
    ...overrides?.env,
  };

  const loop = new AgentLoop(
    env as any,
    "req_test",
    historyManager as any,
    promptBuilder as any,
    hallucinationGuard as any,
    toolExecutor as any,
  );

  return { loop, historyManager, promptBuilder, hallucinationGuard, toolExecutor };
}

describe("AgentLoop", () => {
  afterEach(() => {
    vi.clearAllMocks();
    langchainMocks.invoke.mockReset();
  });

  it("今天已过的时段应在进入 LLM 前短路返回", async () => {
    const { loop, historyManager, promptBuilder } = createAgentLoop({
      promptBuilder: {
        hasTimeSegmentHint: vi.fn().mockReturnValue(true),
        inferTimeSegmentFromText: vi.fn().mockReturnValue("morning"),
        isSegmentAllowedForToday: vi.fn().mockReturnValue(false),
        buildSegmentNotAllowedMessage: vi
          .fn()
          .mockReturnValue("现在已经是下午了，无法选择早上时间段。"),
      },
    });

    const result = await loop.chat(7, "今天早上开会");

    expect(result).toEqual({
      content: "现在已经是下午了，无法选择早上时间段。",
      type: "question",
    });
    expect(langchainMocks.invoke).not.toHaveBeenCalled();
    expect(historyManager.saveMessage).toHaveBeenNthCalledWith(
      1,
      7,
      "user",
      "今天早上开会",
    );
    expect(historyManager.saveMessage).toHaveBeenNthCalledWith(
      2,
      7,
      "assistant",
      "现在已经是下午了，无法选择早上时间段。",
      "question",
    );
    expect(promptBuilder.buildSegmentNotAllowedMessage).toHaveBeenCalledWith("morning");
  });

  it.each([
    ["把任务改到明天", "update", "AI 聊天暂不支持修改任务，请到任务列表中直接修改。"],
    ["把买菜任务删掉", "delete", "AI 聊天暂不支持删除任务，请到任务列表中直接删除。"],
  ])("更新/删除意图应直接短路引导: %s", async (message, inferredIntent, expected) => {
    const { loop, historyManager } = createAgentLoop({
      hallucinationGuard: {
        evaluateUserMessage: vi.fn().mockReturnValue({
          inferredIntent,
          requireToolCall: false,
          skipSemanticConflictCheck: false,
        }),
      },
    });

    const result = await loop.chat(7, message);

    expect(result).toEqual({
      content: expected,
      type: "text",
    });
    expect(langchainMocks.invoke).not.toHaveBeenCalled();
    expect(historyManager.saveMessage).toHaveBeenNthCalledWith(1, 7, "user", message);
    expect(historyManager.saveMessage).toHaveBeenNthCalledWith(
      2,
      7,
      "assistant",
      expected,
      "text",
    );
  });

  it("工具成功后应保留 task_summary 和 payload", async () => {
    const task = { id: 11, title: "买菜", dueDate: "2026-04-12" };
    const { loop, historyManager, hallucinationGuard, toolExecutor } =
      createAgentLoop({
        hallucinationGuard: {
          evaluateUserMessage: vi.fn().mockReturnValue({
            inferredIntent: "create",
            requireToolCall: true,
            skipSemanticConflictCheck: false,
          }),
        },
        toolExecutor: {
          executeToolCall: vi
            .fn()
            .mockResolvedValueOnce({
              status: "success",
              message: "任务创建成功！",
              task,
              actionPerformed: "create",
              responseType: "task_summary",
            }),
        },
      });

    langchainMocks.invoke
      .mockResolvedValueOnce({
        content: "",
        tool_calls: [{ id: "call_1", name: "create_task", args: { title: "买菜" } }],
      })
      .mockResolvedValueOnce({
        content: "已为你创建任务。",
        tool_calls: [],
      });

    const result = await loop.chat(7, "明天提醒我买菜");

    expect(result).toEqual({
      content: "已为你创建任务。",
      type: "task_summary",
      payload: { task, conflictingTasks: undefined },
    });
    expect(hallucinationGuard.evaluateUserMessage).toHaveBeenCalledWith(
      "明天提醒我买菜",
      null,
    );
    expect(langchainMocks.invoke.mock.calls[0][1]).toMatchObject({
      tool_choice: "required",
    });
    expect(toolExecutor.executeToolCall).toHaveBeenCalledWith(
      7,
      "create_task",
      { title: "买菜" },
      "明天提醒我买菜",
      { skipSemanticConflictCheck: false },
    );
    expect(historyManager.saveMessage).toHaveBeenNthCalledWith(
      2,
      7,
      "assistant",
      "已为你创建任务。",
      "task_summary",
      {
        task,
        conflictingTasks: undefined,
      },
    );
  });

  it("无 tool call 且疑似假成功时应改写回复", async () => {
    const { loop, historyManager, hallucinationGuard } = createAgentLoop({
      hallucinationGuard: {
        resolveNoToolCallResponse: vi.fn().mockReturnValue({
          action: "correct_with_not_executed_message",
          content: "我还没有实际创建任务。请确认任务内容后我再创建。",
        }),
      },
    });

    langchainMocks.invoke.mockResolvedValue({
      content: "已为你创建任务。",
      tool_calls: [],
    });

    const result = await loop.chat(7, "帮我安排明天开会");

    expect(result).toEqual({
      content: "我还没有实际创建任务。请确认任务内容后我再创建。",
      type: "text",
      payload: {
        task: undefined,
        conflictingTasks: undefined,
      },
    });
    expect(hallucinationGuard.resolveNoToolCallResponse).toHaveBeenCalledWith({
      llmContent: "已为你创建任务。",
      inferredIntent: "create",
      lastSignificantResult: null,
    });
    expect(historyManager.saveMessage).toHaveBeenNthCalledWith(
      2,
      7,
      "assistant",
      "我还没有实际创建任务。请确认任务内容后我再创建。",
      "text",
      {
        task: undefined,
        conflictingTasks: undefined,
      },
    );
  });

  it("tool 返回 need_confirmation 时应提前结束", async () => {
    const conflictingTasks = [{ id: 22, title: "例会" }];
    const { loop, historyManager, toolExecutor } = createAgentLoop({
      toolExecutor: {
        executeToolCall: vi.fn().mockResolvedValue({
          status: "need_confirmation",
          message: "存在冲突，请先确认。",
          responseType: "question",
          conflictingTasks,
        }),
      },
    });

    langchainMocks.invoke.mockResolvedValue({
      content: "",
      tool_calls: [{ id: "call_1", name: "create_task", args: { title: "开会" } }],
    });

    const result = await loop.chat(7, "明天安排开会");

    expect(result).toEqual({
      content: "存在冲突，请先确认。",
      type: "question",
      payload: { conflictingTasks },
    });
    expect(toolExecutor.executeToolCall).toHaveBeenCalledTimes(1);
    expect(historyManager.saveMessage).toHaveBeenNthCalledWith(
      2,
      7,
      "assistant",
      "存在冲突，请先确认。",
      "question",
      { conflictingTasks },
    );
  });

  it("连续 tool loop 超过上限时应返回 timeout fallback", async () => {
    const { loop, historyManager, toolExecutor } = createAgentLoop({
      toolExecutor: {
        executeToolCall: vi.fn().mockResolvedValue({
          status: "success",
          message: "继续",
        }),
      },
    });

    langchainMocks.invoke.mockResolvedValue({
      content: "",
      tool_calls: [{ id: "call_1", name: "query_tasks", args: { dueDate: "2026-04-11" } }],
    });

    const result = await loop.chat(7, "查看明天的任务");

    expect(result).toEqual({
      content: "抱歉，处理超时，请重新尝试。",
      type: "text",
    });
    expect(langchainMocks.invoke).toHaveBeenCalledTimes(10);
    expect(toolExecutor.executeToolCall).toHaveBeenCalledTimes(10);
    expect(historyManager.saveMessage).toHaveBeenNthCalledWith(
      2,
      7,
      "assistant",
      "抱歉，处理超时，请重新尝试。",
    );
  });
});


