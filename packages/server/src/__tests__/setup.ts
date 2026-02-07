import { beforeAll, afterEach, vi } from "vitest";
import { config } from "dotenv";
import { resolve } from "path";

/**
 * Global test setup and teardown
 *
 * 环境变量加载：
 * - 从 .dev.vars 文件加载环境变量（Cloudflare Workers 格式）
 * - 这使得集成测试可以访问 DATABASE_URL 和其他配置
 *
 * AIService 模型层选择逻辑：
 * 1. 如果设置了 AIHUBMIX_API_KEY，则使用中转服务（baseURL: AIHUBMIX_BASE_URL）
 * 2. 否则使用官方 OpenAI（apiKey: OPENAI_API_KEY）
 */
beforeAll(() => {
  // Load environment variables from .dev.vars file
  // This file contains DATABASE_URL and other sensitive configuration
  const envPath = resolve(__dirname, "../../.dev.vars");
  config({ path: envPath });

  // 仅为单元测试提供 OPENAI_API_KEY
  // 集成测试会使用 .dev.vars 中的 AIHUBMIX_API_KEY
  if (process.env.NODE_ENV !== "test" || !process.env.AIHUBMIX_API_KEY) {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";
  }
});

afterEach(() => {
  // Clean up all mocks after each test to prevent test pollution
  // This ensures mock call counts don't carry over between tests
  vi.clearAllMocks();
});
