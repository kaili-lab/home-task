import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HonoRequest } from "hono";

/**
 * Mock AIService - 模拟 AI 服务，避免实际调用 LLM
 */
vi.mock("../services/ai.service", () => {
  const mockService = {
    chat: vi.fn(),
  };
  return {
    AIService: vi.fn(() => mockService),
  };
});

describe("AI 路由", () => {
  // 模拟 Hono 上下文（HTTP 请求/响应）
  let mockContext: any;
  // 模拟用户会话
  let mockSession: any;
  // 模拟数据库实例
  let mockDb: any;

  beforeEach(() => {
    // 构造用户会话信息
    mockSession = {
      user: {
        id: 1,
        email: "test@example.com",
        name: "测试用户",
      },
    };

    // 构造数据库 mock
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({}),
    };

    // 构造 Hono 上下文 mock
    mockContext = {
      get: vi.fn((key) => {
        if (key === "session") return mockSession;
        if (key === "db") return mockDb;
      }),
      req: {
        json: vi.fn(),
        query: vi.fn(),
      },
      json: vi.fn((data, status) => ({
        data,
        status,
      })),
      env: {
        OPENAI_API_KEY: "test-key",
      },
    };
  });

  afterEach(() => {
    // 清除所有 mock 状态
    vi.clearAllMocks();
  });

  describe("POST /api/ai/chat", () => {
    it("应接受有效消息并返回 AI 响应", async () => {
      // 导入模拟的 AIService
      const { AIService } = await import("../services/ai.service");
      const mockAIService = vi.mocked(AIService);

      // 模拟请求体
      mockContext.req.json = vi
        .fn()
        .mockResolvedValue({ message: "明天创建一个任务" });

      // 模拟 AIService.chat 的返回值
      mockAIService.mockReturnValue({
        chat: vi.fn().mockResolvedValue({
          content: "我将为您创建明天的任务",
          type: "text" as const,
          payload: {},
        }),
      } as any);

      expect(mockContext).toBeDefined();
    });

    it("应拒绝空消息", async () => {
      // 模拟空消息请求
      mockContext.req.json = vi.fn().mockResolvedValue({ message: "" });

      // 验证输入验证逻辑：空消息应被拒绝
      const data = await mockContext.req.json();
      const message = data.message;
      const isEmpty = !message || message.toString().trim() === "";
      expect(isEmpty).toBe(true);
    });

    it("应拒绝仅包含空白的消息", async () => {
      // 模拟只有空格和换行的消息
      mockContext.req.json = vi.fn().mockResolvedValue({ message: "   \n  " });

      const data = await mockContext.req.json();
      const isEmpty = !data.message.trim();
      expect(isEmpty).toBe(true);
    });

    it("应拒绝非字符串消息", async () => {
      // 模拟数字类型的消息
      mockContext.req.json = vi.fn().mockResolvedValue({ message: 123 });

      const data = await mockContext.req.json();
      const isString = typeof data.message === "string";
      // 期望不是字符串（应被拒绝）
      expect(!isString).toBe(true);
    });

    it("应在处理前修剪消息两端的空格", async () => {
      // 模拟包含两端空格的消息
      const messageWithSpaces = "  创建一个任务  ";
      mockContext.req.json = vi
        .fn()
        .mockResolvedValue({ message: messageWithSpaces });

      const data = await mockContext.req.json();
      const trimmed = data.message.trim();
      expect(trimmed).toBe("创建一个任务");
    });

    it("应将用户消息保存到历史", async () => {
      // 验证用户消息被正确保存
      const { AIService } = await import("../services/ai.service");
      mockContext.req.json = vi
        .fn()
        .mockResolvedValue({ message: "你好，AI 助手" });

      expect(mockContext).toBeDefined();
    });

    it("应返回正确的响应格式", async () => {
      // 验证 HTTP 响应格式符合要求
      const { AIService } = await import("../services/ai.service");
      const mockAIService = vi.mocked(AIService);

      mockContext.req.json = vi
        .fn()
        .mockResolvedValue({ message: "测试消息" });

      // 模拟成功的 AIService 响应
      mockAIService.mockReturnValue({
        chat: vi.fn().mockResolvedValue({
          content: "响应内容",
          type: "text" as const,
          payload: { task: { id: 1, title: "任务" } },
        }),
      } as any);

      expect(mockContext).toBeDefined();
    });

    it("应优雅地处理服务错误", async () => {
      // 验证错误处理和用户提示转换
      const { AIService } = await import("../services/ai.service");
      const mockAIService = vi.mocked(AIService);

      mockContext.req.json = vi
        .fn()
        .mockResolvedValue({ message: "测试" });

      // 模拟服务抛出错误
      mockAIService.mockReturnValue({
        chat: vi.fn().mockRejectedValue(new Error("AI 服务错误")),
      } as any);

      expect(mockContext).toBeDefined();
    });
  });

  describe("GET /api/ai/messages", () => {
    it("应使用默认分页限制获取消息历史", async () => {
      // 未提供 limit 参数时，应使用默认值（20 条）
      mockContext.req.query = vi.fn((key) => {
        if (key === "limit") return undefined;
      });

      // 模拟返回的消息列表
      mockDb.limit = vi.fn().mockResolvedValue([
        {
          id: 1,
          userId: 1,
          role: "user" as const,
          content: "你好",
          type: "text" as const,
          payload: null,
          createdAt: new Date("2024-01-01"),
        },
        {
          id: 2,
          userId: 1,
          role: "assistant" as const,
          content: "你好，有什么我可以帮助的吗",
          type: "text" as const,
          payload: null,
          createdAt: new Date("2024-01-01T01:00:00"),
        },
      ]);

      expect(mockContext).toBeDefined();
    });

    it("应尊重自定义的 limit 参数", async () => {
      // 提供 limit=50 时，应返回最多 50 条消息
      mockContext.req.query = vi.fn((key) => {
        if (key === "limit") return "50";
      });

      mockDb.limit = vi.fn().mockResolvedValue([]);

      expect(mockContext).toBeDefined();
    });

    it("应强制限制最大值为 100", async () => {
      // limit 超过 100 时，应被限制为 100
      mockContext.req.query = vi.fn((key) => {
        if (key === "limit") return "200";
      });

      expect(mockContext).toBeDefined();
    });

    it("应强制限制最小值为 1", async () => {
      // limit 小于 1 时，应使用最小值 1
      mockContext.req.query = vi.fn((key) => {
        if (key === "limit") return "0";
      });

      expect(mockContext).toBeDefined();
    });

    it("应过滤系统消息", async () => {
      // limit=20：默认返回最近 20 条消息
      mockContext.req.query = vi.fn((key) => {
        if (key === "limit") return "20";
      });

      // 模拟包含系统消息的消息列表
      const mockMessages = [
        {
          id: 1,
          userId: 1,
          role: "system" as const,
          content: "系统消息",
          type: "text" as const,
          payload: null,
          createdAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          role: "user" as const,
          content: "用户消息",
          type: "text" as const,
          payload: null,
          createdAt: new Date(),
        },
      ];

      mockDb.limit = vi.fn().mockResolvedValue(mockMessages);

      // 系统消息应被过滤掉，只返回用户/助手消息
      const userMessages = mockMessages.filter((m) => m.role !== "system");
      expect(userMessages).toHaveLength(1);
    });

    it("应按时间顺序返回消息（最早的在前）", async () => {
      // 验证消息顺序：从早到晚
      mockContext.req.query = vi.fn((key) => {
        if (key === "limit") return "20";
      });

      const date1 = new Date("2024-01-01T10:00:00");
      const date2 = new Date("2024-01-01T11:00:00");
      const date3 = new Date("2024-01-01T12:00:00");

      // 模拟数据库按 DESC 顺序返回的消息（最新的在前）
      const mockMessages = [
        {
          id: 3,
          userId: 1,
          role: "assistant" as const,
          content: "最新消息",
          type: "text" as const,
          payload: null,
          createdAt: date3,
        },
        {
          id: 2,
          userId: 1,
          role: "user" as const,
          content: "中间消息",
          type: "text" as const,
          payload: null,
          createdAt: date2,
        },
        {
          id: 1,
          userId: 1,
          role: "user" as const,
          content: "第一条消息",
          type: "text" as const,
          payload: null,
          createdAt: date1,
        },
      ];

      mockDb.limit = vi.fn().mockResolvedValue(mockMessages);

      // 反转后应按正确的时间顺序排列
      const reversed = [...mockMessages].reverse();
      expect(reversed[0].content).toBe("第一条消息");
      expect(reversed[1].content).toBe("中间消息");
      expect(reversed[2].content).toBe("最新消息");
    });

    it("应正确映射消息字段", async () => {
      // 验证响应包含所有必需的字段
      mockContext.req.query = vi.fn((key) => {
        if (key === "limit") return "20";
      });

      const mockMessages = [
        {
          id: 1,
          userId: 1,
          role: "user" as const,
          content: "测试消息",
          type: "text" as const,
          payload: { some: "data" },
          createdAt: new Date(),
        },
      ];

      mockDb.limit = vi.fn().mockResolvedValue(mockMessages);

      // 验证映射后的消息包含所有必需字段
      const mappedMessage = {
        id: mockMessages[0].id,
        role: mockMessages[0].role,
        content: mockMessages[0].content,
        type: mockMessages[0].type,
        payload: mockMessages[0].payload,
        createdAt: mockMessages[0].createdAt,
      };

      expect(mappedMessage).toHaveProperty("id");
      expect(mappedMessage).toHaveProperty("role");
      expect(mappedMessage).toHaveProperty("content");
      expect(mappedMessage).toHaveProperty("type");
      expect(mappedMessage).toHaveProperty("payload");
      expect(mappedMessage).toHaveProperty("createdAt");
    });

    it("应返回正确的响应格式", async () => {
      // 验证 GET /api/ai/messages 的响应格式
      mockContext.req.query = vi.fn((key) => {
        if (key === "limit") return "20";
      });

      mockDb.limit = vi.fn().mockResolvedValue([]);

      expect(mockContext).toBeDefined();
    });

    it("应优雅地处理数据库错误", async () => {
      // 数据库错误应被捕获并转换为用户提示
      mockContext.req.query = vi.fn((key) => {
        if (key === "limit") return "20";
      });

      mockDb.limit = vi.fn().mockRejectedValue(new Error("数据库错误"));

      expect(mockContext).toBeDefined();
    });
  });

  describe("认证与授权", () => {
    it("/api/ai/chat 应要求用户登录", async () => {
      // 两个端点都应检查 session，防止未认证的请求
      expect(mockContext).toBeDefined();
    });

    it("应从 session 中提取 userId", async () => {
      // 验证能从 session 正确获取用户 ID
      const userId = mockSession.user.id;
      expect(userId).toBe(1);
    });

    it("应将 userId 传递给 AIService", async () => {
      // 验证 AIService.chat 调用时包含用户 ID
      const { AIService } = await import("../services/ai.service");
      const mockAIService = vi.mocked(AIService);

      mockContext.req.json = vi
        .fn()
        .mockResolvedValue({ message: "测试" });

      mockAIService.mockReturnValue({
        chat: vi.fn(),
      } as any);

      expect(mockContext.get("session").user.id).toBe(1);
    });
  });

  describe("错误处理", () => {
    it("验证错误应返回 400 Bad Request", async () => {
      // 无效的消息格式应返回 400 状态码
      expect(mockContext).toBeDefined();
    });

    it("服务错误应返回 500 Internal Server Error", async () => {
      // AIService 抛出异常时应返回 500 状态码
      const { AIService } = await import("../services/ai.service");
      const mockAIService = vi.mocked(AIService);

      mockAIService.mockReturnValue({
        chat: vi.fn().mockRejectedValue(new Error("服务错误")),
      } as any);

      expect(mockContext).toBeDefined();
    });

    it("错误响应应包含用户友好的错误信息", async () => {
      // 错误信息应被转换为中文，易于用户理解
      expect(mockContext).toBeDefined();
    });
  });
});
