import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AIError,
  AIErrorType,
  AITimeoutError,
  AINetworkError,
  AIAPIError,
  AIParseError,
  AIValidationError,
  classifyAIError,
  withTimeout,
  withRetry,
  getUserFriendlyMessage,
} from "../utils/ai-error-handler";

describe("AI 错误处理", () => {
  // AI 错误处理的核心单元测试
  describe("错误类定义", () => {
    // 验证 AITimeoutError 的属性和初始化
    it("应使用正确的属性创建 AITimeoutError", () => {
      const error = new AITimeoutError();
      expect(error.type).toBe(AIErrorType.TIMEOUT);
      expect(error.message).toBe("AI 服务响应超时");
      expect(error.retryable).toBe(true);
      expect(error.name).toBe("AITimeoutError");
    });

    // 验证 AINetworkError 的属性和初始化
    it("应使用正确的属性创建 AINetworkError", () => {
      const error = new AINetworkError("Connection refused");
      expect(error.type).toBe(AIErrorType.NETWORK);
      expect(error.message).toContain("网络连接失败");
      expect(error.retryable).toBe(true);
      expect(error.name).toBe("AINetworkError");
    });

    // 验证 AIAPIError 的属性包括状态码和重试标志
    it("应使用状态码和重试标志创建 AIAPIError", () => {
      const error = new AIAPIError(500, "Server error");
      expect(error.type).toBe(AIErrorType.API_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
    });

    // 429 状态码（频率限制）应标记为可重试
    it("应将 429 状态标记为可重试", () => {
      const error = new AIAPIError(429, "Rate limited");
      expect(error.retryable).toBe(true);
    });

    // 4xx 状态码（除了 429）应标记为不可重试，因为客户端错误无法通过重试解决
    it("应将 4xx 状态（除 429 外）标记为不可重试", () => {
      const error = new AIAPIError(401, "Unauthorized");
      expect(error.retryable).toBe(false);
    });

    // 解析错误不可重试，因为问题出在响应数据本身
    it("应创建标记为不可重试的 AIParseError", () => {
      const error = new AIParseError("Invalid JSON");
      expect(error.type).toBe(AIErrorType.PARSE_ERROR);
      expect(error.retryable).toBe(false);
    });

    // 验证错误不可重试，因为验证问题需要修改请求数据才能解决
    it("应创建标记为不可重试的 AIValidationError", () => {
      const error = new AIValidationError("Missing required field");
      expect(error.type).toBe(AIErrorType.VALIDATION_ERROR);
      expect(error.retryable).toBe(false);
    });
  });

  // AI 错误分类测试：根据不同的错误信号识别错误类型
  describe("AI 错误分类", () => {
    // 如果已是 AIError 则直接返回，无需重新分类
    it("如果已分类则返回相同的 AIError", () => {
      const original = new AITimeoutError();
      const classified = classifyAIError(original);
      expect(classified).toBe(original);
    });

    // 识别 OpenAI SDK 的 429 错误（频率限制）并标记为可重试
    it("应分类 OpenAI SDK 429 状态错误", () => {
      const error = { status: 429, message: "Too many requests" };
      const classified = classifyAIError(error);
      expect(classified).toBeInstanceOf(AIAPIError);
      expect(classified.type).toBe(AIErrorType.API_ERROR);
      expect(classified.retryable).toBe(true);
    });

    // 识别 OpenAI SDK 的 500 错误（服务器错误）并标记为可重试
    it("应分类 OpenAI SDK 500 状态错误", () => {
      const error = { status: 500, message: "Server error" };
      const classified = classifyAIError(error);
      expect(classified).toBeInstanceOf(AIAPIError);
      expect(classified.retryable).toBe(true);
    });

    // 识别 OpenAI SDK 的 401 错误（未授权）并标记为不可重试
    it("应分类 OpenAI SDK 401 状态错误", () => {
      const error = { status: 401, message: "Unauthorized" };
      const classified = classifyAIError(error);
      expect(classified).toBeInstanceOf(AIAPIError);
      expect(classified.retryable).toBe(false);
    });

    // 识别网络错误代码 ECONNREFUSED（连接被拒绝）并标记为可重试
    it("应分类网络错误 ECONNREFUSED", () => {
      const error = new Error("Connection refused");
      (error as any).code = "ECONNREFUSED";
      const classified = classifyAIError(error);
      expect(classified).toBeInstanceOf(AINetworkError);
      expect(classified.retryable).toBe(true);
    });

    // 识别网络错误代码 ENOTFOUND（域名未找到）并标记为可重试
    it("应分类网络错误 ENOTFOUND", () => {
      const error = new Error("getaddrinfo ENOTFOUND");
      (error as any).code = "ENOTFOUND";
      const classified = classifyAIError(error);
      expect(classified).toBeInstanceOf(AINetworkError);
      expect(classified.retryable).toBe(true);
    });

    // 通过错误消息内容识别网络错误并标记为可重试
    it("应通过错误消息识别网络错误", () => {
      const error = new Error("fetch failed with network error");
      const classified = classifyAIError(error);
      expect(classified).toBeInstanceOf(AINetworkError);
      expect(classified.retryable).toBe(true);
    });

    // 无法分类的错误应标记为未知类型，且不可重试
    it("应分类未知错误", () => {
      const error = new Error("Some random error");
      const classified = classifyAIError(error);
      expect(classified.type).toBe(AIErrorType.UNKNOWN);
      expect(classified.retryable).toBe(false);
    });

    // 处理非 Error 对象（如字符串）并分类为未知错误
    it("应处理非 Error 对象", () => {
      const classified = classifyAIError("string error");
      expect(classified).toBeInstanceOf(AIError);
      expect(classified.type).toBe(AIErrorType.UNKNOWN);
    });
  });

  // 超时处理测试：验证 Promise 在指定时间内完成或超时的行为
  describe("超时处理", () => {
    // 在超时时间内完成的 Promise 应正常返回结果
    it("Promise 在超时时间内完成时应解决", async () => {
      const promise = Promise.resolve("success");
      const result = await withTimeout(promise, 1000);
      expect(result).toBe("success");
    });

    // Promise 超过超时时间应拒绝并抛出 AITimeoutError
    it("Promise 超过超时时间时应拒绝并抛出 AITimeoutError", async () => {
      const promise = new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
      try {
        await withTimeout(promise, 100);
        expect.fail("应已超时");
      } catch (error) {
        expect(error).toBeInstanceOf(AITimeoutError);
      }
    });

    // 未指定超时时间时应使用默认值 60000ms
    it("应使用默认超时时间 60000ms", async () => {
      const promise = Promise.resolve("success");
      const result = await withTimeout(promise);
      expect(result).toBe("success");
    });
  });

  // 重试机制测试：验证错误重试、指数退避、最大重试次数等功能
  describe("重试机制", () => {
    // 成功情况下应仅执行一次函数
    it("成功时应仅执行一次函数", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await withRetry(fn);
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    // 可重试错误发生时应进行重试，直到成功或达到最大重试次数
    it("可重试错误时应进行重试", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new AINetworkError("Failed"))
        .mockResolvedValueOnce("success");

      const result = await withRetry(fn, {
        maxRetries: 2,
        initialDelayMs: 1,
      });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    // 不可重试错误应立即抛出，不进行重试
    it("不可重试错误时应立即抛出", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new AIParseError("Parse failed"));

      try {
        await withRetry(fn);
        expect.fail("应已抛出错误");
      } catch (error) {
        expect(error).toBeInstanceOf(AIParseError);
        expect(fn).toHaveBeenCalledTimes(1);
      }
    });

    // 指数退避策略：初始延迟为 100ms，第一次重试延迟 100ms，第二次延迟 200ms（倍数为 2）
    it("应使用指数退避机制", async () => {
      vi.useFakeTimers();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new AINetworkError("Failed 1"))
        .mockRejectedValueOnce(new AINetworkError("Failed 2"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(fn, {
        maxRetries: 2,
        initialDelayMs: 100,
        backoffMultiplier: 2,
      });

      // 首次尝试立即失败
      expect(fn).toHaveBeenCalledTimes(1);

      // 等待第一次重试（100ms 延迟）
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // 等待第二次重试（200ms 延迟）
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    // 达到最大重试次数后应抛出最后的错误（初始尝试 + 最大重试次数）
    it("达到最大重试次数后应抛出错误", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new AINetworkError("Always fails"));

      try {
        await withRetry(fn, { maxRetries: 2, initialDelayMs: 1 });
        expect.fail("应已抛出错误");
      } catch (error) {
        expect(error).toBeInstanceOf(AINetworkError);
        expect(fn).toHaveBeenCalledTimes(3); // 初始尝试 + 2 次重试
      }
    });

    // maxDelayMs 参数限制延迟的最大值，即使指数退避计算结果更大
    it("应在退避计算中尊重 maxDelayMs 上限", async () => {
      vi.useFakeTimers();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new AINetworkError("Failed"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(fn, {
        maxRetries: 1,
        initialDelayMs: 100,
        backoffMultiplier: 3,
        maxDelayMs: 50, // 延迟被限制在 50ms
      });

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe("success");

      vi.useRealTimers();
    });
  });

  // 用户友好的错误信息测试：验证不同错误类型返回合适的用户提示
  describe("用户友好的错误信息", () => {
    // 超时错误应返回友好的超时提示
    it("超时错误应返回友好的错误信息", () => {
      const error = new AITimeoutError();
      const message = getUserFriendlyMessage(error);
      expect(message).toContain("响应超时");
    });

    // 网络错误应返回友好的网络故障提示
    it("网络错误应返回友好的错误信息", () => {
      const error = new AINetworkError("Connection failed");
      const message = getUserFriendlyMessage(error);
      expect(message).toContain("中转站故障");
    });

    // 频率限制错误（429）应返回特定的友好提示
    it("频率限制错误应返回友好的错误信息", () => {
      const error = new AIAPIError(429, "Rate limit exceeded");
      const message = getUserFriendlyMessage(error);
      expect(message).toContain("过于频繁");
    });

    // 服务器错误（5xx）应返回特定的友好提示
    it("服务器错误应返回友好的错误信息", () => {
      const error = new AIAPIError(503, "Service unavailable");
      const message = getUserFriendlyMessage(error);
      expect(message).toContain("服务器出现问题");
    });

    // 其他 API 错误应返回通用的友好提示
    it("其他 API 错误应返回通用的错误信息", () => {
      const error = new AIAPIError(400, "Bad request");
      const message = getUserFriendlyMessage(error);
      expect(message).toContain("暂时不可用");
    });

    // 解析错误应返回友好的数据格式异常提示
    it("解析错误应返回友好的错误信息", () => {
      const error = new AIParseError("Invalid response");
      const message = getUserFriendlyMessage(error);
      expect(message).toContain("数据格式异常");
    });

    // 验证错误应返回友好的数据格式异常提示
    it("验证错误应返回友好的错误信息", () => {
      const error = new AIValidationError("Missing field");
      const message = getUserFriendlyMessage(error);
      expect(message).toContain("数据格式异常");
    });
  });
});
