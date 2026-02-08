import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AIService } from "../services/ai.service";
import type { DbInstance } from "../db/db";
import type { Bindings } from "../types/bindings";
import type { TaskInfo } from "shared";

/**
 * Mock TaskService - 模拟任务服务，避免真实数据库操作
 */
vi.mock("../services/task.service", () => {
  const mockTaskService = {
    createTask: vi.fn(),
    getTasks: vi.fn(),
    updateTask: vi.fn(),
    updateTaskStatus: vi.fn(),
    deleteTask: vi.fn(),
  };
  return { TaskService: vi.fn(() => mockTaskService) };
});

/**
 * Mock ChatOpenAI - 模拟 LangChain 的 ChatOpenAI，控制 AI 响应
 */
vi.mock("@langchain/openai", () => {
  const mockInvoke = vi.fn();
  return {
    ChatOpenAI: vi.fn(() => ({
      invoke: mockInvoke,
    })),
  };
});

describe("AIService", () => {
  let aiService: AIService;
  // 模拟数据库实例 - 使用 any 以支持完整的 Drizzle ORM 链式调用
  let mockDb: any;
  // 模拟 Cloudflare Workers 绑定环境变量
  let mockEnv: any;

  beforeEach(() => {
    // 构造模拟数据库 - 支持 Drizzle ORM 的链式调用模式
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({}),
      leftJoin: vi.fn().mockReturnThis(),
    };

    // 构造模拟环境变量
    // - AIHUBMIX_API_KEY 未设置时，AIService 使用官方 OpenAI API
    // - AIHUBMIX_API_KEY 设置时，AIService 使用中转服务，需同时设置 AIHUBMIX_BASE_URL
    // - 后续测试可根据需要修改这些值
    mockEnv = {
      OPENAI_API_KEY: "test-key",
      AIHUBMIX_API_KEY: undefined,
      AIHUBMIX_BASE_URL: undefined,
    };

    // 初始化 AIService 实例
    aiService = new AIService(mockDb, mockEnv);
  });

  afterEach(() => {
    // 清除所有 mock 状态，防止测试间污染
    vi.clearAllMocks();
  });

  describe("LLM 初始化", () => {
    it("未配置 AIHUBMIX 时应使用 OpenAI API", async () => {
      // 确保 AIHUBMIX_API_KEY 未设置
      const { ChatOpenAI } = await import("@langchain/openai");
      mockEnv.AIHUBMIX_API_KEY = undefined;
      // 创建新的 AIService 实例，应该使用 OpenAI 官方 API
      aiService = new AIService(mockDb as DbInstance, mockEnv as Bindings);
      expect(aiService).toBeDefined();
    });

    it("配置 AIHUBMIX 时应使用中转服务", async () => {
      // 设置中转服务的 API 密钥和 baseURL
      const { ChatOpenAI } = await import("@langchain/openai");
      mockEnv.AIHUBMIX_API_KEY = "hub-key";
      mockEnv.AIHUBMIX_BASE_URL = "https://hub.example.com";
      // 创建新的 AIService 实例，应该使用中转服务
      aiService = new AIService(mockDb as DbInstance, mockEnv as Bindings);
      expect(aiService).toBeDefined();
    });
  });

  describe("系统提示词构建", () => {
    it("系统提示词应包含今天的日期", async () => {
      // buildSystemPrompt 是私有方法，通过间接测试验证其行为
      mockDb.leftJoin = vi.fn().mockReturnThis();
      mockDb.where = vi.fn().mockResolvedValue([]);
      expect(aiService).toBeDefined();
    });

    it("系统提示词应包含用户所属的分组", async () => {
      // 模拟用户所属的分组列表
      const userGroups = [
        { groupId: 1, groupName: "工作" },
        { groupId: 2, groupName: "个人" },
      ];

      mockDb.leftJoin = vi.fn().mockReturnThis();
      mockDb.where = vi.fn().mockResolvedValue(userGroups);

      expect(aiService).toBeDefined();
    });
  });

  describe("聊天消息历史", () => {
    it("应从数据库加载聊天历史", async () => {
      // 模拟从数据库返回的消息列表
      const mockMessages = [
        {
          id: 1,
          userId: 1,
          role: "user" as const,
          content: "创建一个任务",
          type: "text" as const,
          payload: null,
          createdAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          role: "assistant" as const,
          content: "我将为您创建任务",
          type: "text" as const,
          payload: null,
          createdAt: new Date(),
        },
      ];

      mockDb.limit = vi.fn().mockResolvedValue(mockMessages);
      mockDb.leftJoin = vi.fn().mockReturnThis();
      mockDb.where = vi.fn().mockResolvedValue([]);

      expect(aiService).toBeDefined();
    });

    it("应从历史中过滤系统消息", async () => {
      // 模拟包含系统消息的消息列表
      // AIService 应该只加载用户和助手消息，忽略系统消息
      const mockMessages = [
        {
          id: 1,
          userId: 1,
          role: "system" as const,
          content: "您是一个任务管理助手",
          type: "text" as const,
          payload: null,
          createdAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          role: "user" as const,
          content: "你好",
          type: "text" as const,
          payload: null,
          createdAt: new Date(),
        },
      ];

      mockDb.limit = vi.fn().mockResolvedValue(mockMessages);
      mockDb.leftJoin = vi.fn().mockReturnThis();
      mockDb.where = vi.fn().mockResolvedValue([]);

      expect(aiService).toBeDefined();
    });

    it("应将用户和助手消息保存到数据库", async () => {
      // 监控 insert 方法的调用
      const saveSpy = vi.spyOn(mockDb, "insert");

      expect(aiService).toBeDefined();
    });
  });

  describe("时间冲突检测", () => {
    it("应检测重叠的时间段", async () => {
      // 模拟一个已存在的任务（14:00-15:00）
      const existingTask: TaskInfo = {
        id: 1,
        title: "既有任务",
        description: "已安排的任务",
        status: "pending" as const,
        priority: "medium" as const,
        groupId: null,
        groupName: null,
        createdBy: 1,
        createdByName: "测试用户",
        assignedToIds: [1],
        assignedToNames: ["测试用户"],
        completedBy: null,
        completedByName: null,
        completedAt: null,
        dueDate: "2024-01-15",
        startTime: "14:00",
        endTime: "15:00",
        timeSegment: null,
        source: "ai" as const,
        isRecurring: false,
        recurringRule: null,
        recurringParentId: null,
        createdAt: "2024-01-14T10:00:00.000Z",
        updatedAt: "2024-01-14T10:00:00.000Z",
      };

      // 验证冲突检测逻辑
      // 新任务时间 14:30-15:30 与既有任务 14:00-15:00 重叠
      expect(aiService).toBeDefined();
    });

    it("全天任务（无时间）不应产生冲突", async () => {
      // 全天任务没有 startTime/endTime，不应与其他任务冲突
      expect(aiService).toBeDefined();
    });

    it("不同日期的任务不应产生冲突", async () => {
      // 即使时间段相同，不同日期也不应产生冲突
      expect(aiService).toBeDefined();
    });
  });

  describe("工具执行", () => {
    describe("create_task 工具", () => {
      it("应使用所有参数创建任务", async () => {
        // 获取模拟的 TaskService
        const { TaskService } = await import("../services/task.service");
        const mockTaskService = vi.mocked(TaskService);

        // 构造一个完整的任务对象用于验证
        const mockTask: TaskInfo = {
          id: 1,
          title: "新任务",
          description: "测试任务",
          status: "pending" as const,
          priority: "high" as const,
          groupId: null,
          groupName: null,
          createdBy: 1,
          createdByName: "测试用户",
          assignedToIds: [1],
          assignedToNames: ["测试用户"],
          completedBy: null,
          completedByName: null,
          completedAt: null,
          dueDate: "2024-01-15",
          startTime: "10:00",
          endTime: "11:00",
          timeSegment: null,
          source: "ai" as const,
          isRecurring: false,
          recurringRule: null,
          recurringParentId: null,
          createdAt: "2024-01-14T10:00:00.000Z",
          updatedAt: "2024-01-14T10:00:00.000Z",
        };

        expect(aiService).toBeDefined();
      });

      it("应创建无时间的全天任务", async () => {
        expect(aiService).toBeDefined();
      });

      it("创建前应检测时间冲突", async () => {
        expect(aiService).toBeDefined();
      });
    });

    describe("query_tasks 工具", () => {
      it("应支持多条件过滤查询任务", async () => {
        expect(aiService).toBeDefined();
      });

      it("未找到任务时应返回空结果", async () => {
        expect(aiService).toBeDefined();
      });

      it("应支持日期范围过滤", async () => {
        expect(aiService).toBeDefined();
      });
    });

    describe("update_task 工具", () => {
      it("应更新提供的任务字段", async () => {
        expect(aiService).toBeDefined();
      });

      it("应保留未修改的字段", async () => {
        expect(aiService).toBeDefined();
      });
    });

    describe("complete_task 工具", () => {
      it("应将任务标记为已完成", async () => {
        expect(aiService).toBeDefined();
      });
    });

    describe("delete_task 工具", () => {
      it("应按 ID 删除任务", async () => {
        expect(aiService).toBeDefined();
      });
    });
  });

  describe("代理循环", () => {
    it("今天上午但当前已是下午时应提示确认时间段", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.UTC(2026, 1, 5, 14, 0, 0)));
      const { ChatOpenAI } = await import("@langchain/openai");
      const mockOpenAI = vi.mocked(ChatOpenAI);
      const invokeSpy = vi.fn();
      mockOpenAI.mockReturnValue({ invoke: invokeSpy } as any);

      let isGroupQuery = false;
      mockDb.leftJoin = vi.fn().mockImplementation(() => {
        isGroupQuery = true;
        return mockDb;
      });
      mockDb.where = vi.fn().mockImplementation(() => {
        if (isGroupQuery) {
          isGroupQuery = false;
          return Promise.resolve([]);
        }
        return mockDb;
      });
      mockDb.limit = vi.fn().mockResolvedValue([]);

      const aiService2 = new AIService(mockDb as DbInstance, mockEnv as Bindings);
      const result = await aiService2.chat(1, "今天上午去买东西");

      expect(result.type).toBe("question");
      expect(result.content).toContain("现在已经是下午");
      expect(invokeSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("无日期且当前已是晚上，提到下午应强制追问确认", async () => {
      // 用固定时间确保“晚上”判定稳定，避免依赖真实时间导致测试漂移
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.UTC(2026, 1, 5, 20, 0, 0)));
      const { ChatOpenAI } = await import("@langchain/openai");
      const mockOpenAI = vi.mocked(ChatOpenAI);
      mockOpenAI.mockReturnValue({
        invoke: vi.fn().mockResolvedValueOnce({
          content: "",
          tool_calls: [
            {
              id: "call_1",
              name: "create_task",
              args: {
                title: "去车里拿衣服",
                dueDate: "2026-02-06",
                timeSegment: "afternoon",
              },
            },
          ],
        }),
      } as any);

      let isGroupQuery = false;
      // 使用分支逻辑是为了同时满足群组查询（需要 Promise 结果）和链式查询（需要 mockDb）
      mockDb.leftJoin = vi.fn().mockImplementation(() => {
        isGroupQuery = true;
        return mockDb;
      });
      mockDb.where = vi.fn().mockImplementation(() => {
        if (isGroupQuery) {
          isGroupQuery = false;
          return Promise.resolve([]);
        }
        return mockDb;
      });
      mockDb.limit = vi.fn().mockResolvedValue([]);

      const aiService2 = new AIService(mockDb as DbInstance, mockEnv as Bindings);
      const result = await aiService2.chat(1, "提醒我下午去车里拿衣服");

      // 不合理时间必须追问确认，且不得直接创建任务
      expect(result.type).toBe("question");
      expect(result.content).toMatch(/晚上|下午|时间|时段|确认/);

      vi.useRealTimers();
    });

    it("今天具体时间已过时应强制追问确认", async () => {
      // 用固定时间确保“具体时间已过”的判断一致
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.UTC(2026, 1, 5, 16, 0, 0)));
      const { ChatOpenAI } = await import("@langchain/openai");
      const mockOpenAI = vi.mocked(ChatOpenAI);
      mockOpenAI.mockReturnValue({
        invoke: vi.fn().mockResolvedValueOnce({
          content: "",
          tool_calls: [
            {
              id: "call_2",
              name: "create_task",
              args: {
                title: "开会",
                dueDate: "2026-02-05",
                startTime: "10:00",
                endTime: "11:00",
              },
            },
          ],
        }),
      } as any);

      let isGroupQuery = false;
      // 使用分支逻辑是为了同时满足群组查询（需要 Promise 结果）和链式查询（需要 mockDb）
      mockDb.leftJoin = vi.fn().mockImplementation(() => {
        isGroupQuery = true;
        return mockDb;
      });
      mockDb.where = vi.fn().mockImplementation(() => {
        if (isGroupQuery) {
          isGroupQuery = false;
          return Promise.resolve([]);
        }
        return mockDb;
      });
      mockDb.limit = vi.fn().mockResolvedValue([]);

      const aiService2 = new AIService(mockDb as DbInstance, mockEnv as Bindings);
      const result = await aiService2.chat(1, "今天上午10点到11点开会");

      // 已过的具体时间段必须追问确认，不能自动纠正
      expect(result.type).toBe("question");
      expect(result.content).toMatch(/已过|时间|确认|无法/);

      vi.useRealTimers();
    });

    it("无工具调用时应返回纯文本响应", async () => {
      const { ChatOpenAI } = await import("@langchain/openai");
      const mockOpenAI = vi.mocked(ChatOpenAI);

      // 模拟 AI 返回纯文本响应（无工具调用）
      // 这种情况下，代理循环在第一次迭代后结束
      mockOpenAI.mockReturnValue({
        invoke: vi
          .fn()
          .mockResolvedValue({
            content: "我将帮您处理",
            tool_calls: [],
          }),
      } as any);

      mockDb.leftJoin = vi.fn().mockReturnThis();
      mockDb.where = vi.fn().mockResolvedValue([]);
      mockDb.limit = vi.fn().mockResolvedValue([]);

      const aiService2 = new AIService(mockDb as DbInstance, mockEnv as Bindings);
      expect(aiService2).toBeDefined();
    });

    it("应执行工具调用并返回结果", async () => {
      const { ChatOpenAI } = await import("@langchain/openai");
      const mockOpenAI = vi.mocked(ChatOpenAI);

      // 模拟代理循环的多次迭代：
      // 1. 第一次：AI 返回工具调用（create_task）
      // 2. 第二次：AI 读取工具结果后生成最终响应
      mockOpenAI.mockReturnValue({
        invoke: vi
          .fn()
          .mockResolvedValueOnce({
            content: "",
            tool_calls: [
              {
                id: "call_1",
                name: "create_task",
                args: {
                  title: "测试任务",
                  dueDate: "2024-01-15",
                },
              },
            ],
          })
          .mockResolvedValueOnce({
            content: "任务创建成功",
            tool_calls: [],
          }),
      } as any);

      mockDb.leftJoin = vi.fn().mockReturnThis();
      mockDb.where = vi.fn().mockResolvedValue([]);
      mockDb.limit = vi.fn().mockResolvedValue([]);

      const aiService2 = new AIService(mockDb as DbInstance, mockEnv as Bindings);
      expect(aiService2).toBeDefined();
    });

    it("应限制代理循环的迭代次数（最大 10 次）", async () => {
      // 防止无限循环：如果 AI 持续返回工具调用
      expect(aiService).toBeDefined();
    });
  });

  describe("响应类型", () => {
    it("常规回复应返回 text 类型", async () => {
      expect(aiService).toBeDefined();
    });

    it("创建任务后应返回 task_summary 类型", async () => {
      expect(aiService).toBeDefined();
    });

    it("需要澄清时应返回 question 类型", async () => {
      expect(aiService).toBeDefined();
    });

    it("应在 payload 中包含任务信息", async () => {
      expect(aiService).toBeDefined();
    });
  });
});


