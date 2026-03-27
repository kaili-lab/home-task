import { beforeAll, afterEach, vi } from "vitest";

/**
 * Global test setup and teardown
 *
 * AIService 模型层选择逻辑：
 * 1. 如果设置了 AIHUBMIX_API_KEY，则使用中转服务（baseURL: AIHUBMIX_BASE_URL）
 * 2. 否则使用官方 OpenAI（apiKey: OPENAI_API_KEY）
 */
beforeAll(() => {
  // Initialize environment variables if needed
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";
});

afterEach(() => {
  // Clean up all mocks after each test to prevent test pollution
  // This ensures mock call counts don't carry over between tests
  vi.clearAllMocks();
});
