import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import aiRoutes from "../routes/ai.routes";
import type { Bindings } from "../types/bindings";
import { AIService } from "../services/ai.service";
import { MultiAgentService } from "../services/multi-agent";

const { mockAIChat, mockMultiChat } = vi.hoisted(() => ({
  mockAIChat: vi.fn(),
  mockMultiChat: vi.fn(),
}));

vi.mock("../services/ai.service", () => ({
  AIService: vi.fn(() => ({
    chat: mockAIChat,
  })),
}));

vi.mock("../services/multi-agent", () => ({
  MultiAgentService: vi.fn(() => ({
    chat: mockMultiChat,
  })),
}));

const baseEnv: Bindings = {
  DATABASE_URL: "postgresql://test",
  BETTER_AUTH_SECRET: "test-secret",
  BETTER_AUTH_URL: "https://example.com",
  RESEND_API_KEY: "test-resend",
  OPENAI_API_KEY: "test-openai",
};

function createEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    ...baseEnv,
    ...overrides,
  };
}

function createApp() {
  const app = new Hono<{
    Bindings: Bindings;
    Variables: {
      session: {
        user: {
          id: number;
        };
      };
      db: Record<string, unknown>;
    };
  }>();

  app.use("/api/ai/*", async (c, next) => {
    c.set("session", { user: { id: 1 } });
    c.set("db", {});
    await next();
  });

  app.route("/api/ai", aiRoutes);
  return app;
}

async function requestChat(
  app: ReturnType<typeof createApp>,
  env: Bindings,
  options?: {
    query?: string;
    headers?: Record<string, string>;
    message?: string;
  },
) {
  const queryString = options?.query ? `?${options.query}` : "";
  const response = await app.fetch(
    new Request(`http://localhost/api/ai/chat${queryString}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...options?.headers,
      },
      body: JSON.stringify({
        message: options?.message ?? "  创建任务  ",
      }),
    }),
    env,
  );

  const data = (await response.json()) as { success: boolean; data?: unknown; error?: string };
  return { response, data };
}

describe("ai.routes 多 Agent 路由开关", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAIChat.mockResolvedValue({
      content: "single",
      type: "text",
      payload: {},
    });
    mockMultiChat.mockResolvedValue({
      content: "multi",
      type: "text",
      payload: {},
    });
  });

  it("ENABLE_MULTI_AGENT=true 时应走 MultiAgentService", async () => {
    const app = createApp();

    const { response, data } = await requestChat(app, createEnv({ ENABLE_MULTI_AGENT: "true" }), {
      headers: {
        "x-timezone-offset": "480",
      },
      message: "  安排明天会议  ",
    });

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(vi.mocked(MultiAgentService)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(MultiAgentService)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ENABLE_MULTI_AGENT: "true" }),
      480,
    );
    expect(mockMultiChat).toHaveBeenCalledWith(1, "安排明天会议");
    expect(vi.mocked(AIService)).not.toHaveBeenCalled();
  });

  it("ENABLE_MULTI_AGENT=false 时应走 AIService（忽略 query/header）", async () => {
    const app = createApp();

    const { response, data } = await requestChat(app, createEnv({ ENABLE_MULTI_AGENT: "false" }), {
      query: "multi=true",
      headers: {
        "x-multi-agent": "true",
      },
    });

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(vi.mocked(AIService)).toHaveBeenCalledTimes(1);
    expect(mockAIChat).toHaveBeenCalledWith(1, "创建任务");
    expect(vi.mocked(MultiAgentService)).not.toHaveBeenCalled();
  });

  it("未配置 ENABLE_MULTI_AGENT 时默认走 AIService", async () => {
    const app = createApp();
    const env = createEnv();

    const { response, data } = await requestChat(app, env, {
      query: "multi=true",
      headers: {
        "x-multi-agent": "true",
      },
    });

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(vi.mocked(AIService)).toHaveBeenCalledTimes(1);
    expect(mockAIChat).toHaveBeenCalledWith(1, "创建任务");
    expect(vi.mocked(MultiAgentService)).not.toHaveBeenCalled();
  });
});
