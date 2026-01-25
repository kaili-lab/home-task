/**
 * AI 错误处理工具模块
 *
 * 职责：
 * 1. 错误分类：区分中转站故障、OpenAI 服务器问题、超时等
 * 2. 超时控制：防止请求无限等待
 * 3. 重试机制：针对临时性错误（如中转站重启）自动重试
 * 4. 错误包装：提供统一的错误类型和消息
 *
 * 使用场景：
 * - 中转站故障（代理服务器重启）：自动重试
 * - OpenAI 服务器问题：重试后仍失败，返回降级数据
 * - 超时：60秒超时，避免长时间等待
 */

/**
 * AI 错误类型枚举
 */
export enum AIErrorType {
  TIMEOUT = "TIMEOUT", // 超时
  NETWORK = "NETWORK", // 网络错误（中转站故障）
  API_ERROR = "API_ERROR", // API 错误（OpenAI 服务器问题）
  PARSE_ERROR = "PARSE_ERROR", // 解析错误
  VALIDATION_ERROR = "VALIDATION_ERROR", // 验证错误
  UNKNOWN = "UNKNOWN", // 未知错误
}

/**
 * AI 错误类
 *
 * 包含错误类型、原始错误、是否可重试等信息
 */
export class AIError extends Error {
  constructor(
    public readonly type: AIErrorType,
    message: string,
    public readonly originalError?: unknown,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "AIError";
  }
}

/**
 * 超时错误
 */
export class AITimeoutError extends AIError {
  constructor() {
    super(
      AIErrorType.TIMEOUT,
      "AI 服务响应超时",
      undefined,
      true // 超时可以重试
    );
    this.name = "AITimeoutError";
  }
}

/**
 * 网络错误（中转站故障）
 */
export class AINetworkError extends AIError {
  constructor(message: string, originalError?: unknown) {
    super(
      AIErrorType.NETWORK,
      `网络连接失败: ${message}`,
      originalError,
      true // 网络错误可以重试
    );
    this.name = "AINetworkError";
  }
}

/**
 * API 错误（OpenAI 服务器问题）
 */
export class AIAPIError extends AIError {
  constructor(
    public readonly statusCode: number,
    message: string,
    originalError?: unknown
  ) {
    super(
      AIErrorType.API_ERROR,
      `AI API 错误 (${statusCode}): ${message}`,
      originalError,
      statusCode >= 500 || statusCode === 429 // 5xx 和 429 可以重试
    );
    this.name = "AIAPIError";
  }
}

/**
 * 解析错误
 */
export class AIParseError extends AIError {
  constructor(message: string, originalError?: unknown) {
    super(
      AIErrorType.PARSE_ERROR,
      `数据解析失败: ${message}`,
      originalError,
      false // 解析错误不重试
    );
    this.name = "AIParseError";
  }
}

/**
 * 验证错误
 */
export class AIValidationError extends AIError {
  constructor(message: string) {
    super(
      AIErrorType.VALIDATION_ERROR,
      `数据验证失败: ${message}`,
      undefined,
      false // 验证错误不重试
    );
    this.name = "AIValidationError";
  }
}

/**
 * 带超时的 Promise 包装器
 *
 * @param promise - 要执行的 Promise
 * @param timeoutMs - 超时时间（毫秒），默认 60 秒
 * @returns 带超时控制的 Promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 60000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new AITimeoutError()), timeoutMs);
    }),
  ]);
}

/**
 * 错误分类器
 *
 * 根据原始错误判断错误类型
 *
 * @param error - 原始错误
 * @returns 分类后的 AIError
 */
export function classifyAIError(error: unknown): AIError {
  // 如果已经是 AIError，直接返回
  if (error instanceof AIError) {
    return error;
  }

  // OpenAI SDK 错误
  if (error && typeof error === "object" && "status" in error) {
    // 原代码（已注释）：
    // const status = (error as any).status;
    // const message = (error as any).message || "未知错误";

    // 使用类型守卫进行安全的类型检查：
    // - 使用 unknown 替代 any，强制进行类型检查
    // - 使用 typeof 和 'in' 操作符验证属性存在
    // - 确保类型安全，避免运行时错误
    const errorObj = error as { status?: unknown; message?: unknown };
    const status = typeof errorObj.status === "number" ? errorObj.status : 0;
    const message =
      typeof errorObj.message === "string" ? errorObj.message : "未知错误";

    // 429: Rate Limit - 可以重试
    if (status === 429) {
      return new AIAPIError(status, "请求过于频繁，请稍后重试", error);
    }

    // 5xx: 服务器错误 - 可以重试
    if (status >= 500) {
      return new AIAPIError(status, "AI 服务器错误", error);
    }

    // 4xx: 客户端错误 - 不重试
    if (status >= 400) {
      return new AIAPIError(status, message, error);
    }
  }

  // 网络错误（连接失败、DNS 解析失败等）
  if (error instanceof Error) {
    // 原代码（已注释）：
    // const errorCode = (error as any).code;

    // 使用类型安全的方式访问 code 属性：
    // - Node.js 错误对象可能包含 code 属性（如 ECONNREFUSED）
    // - 使用 'in' 操作符检查属性是否存在
    // - 确保类型安全
    const errorCode =
      "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;
    if (
      errorCode === "ECONNREFUSED" ||
      errorCode === "ENOTFOUND" ||
      errorCode === "ETIMEDOUT" ||
      errorCode === "ECONNRESET" ||
      error.message.includes("fetch failed") ||
      error.message.includes("network")
    ) {
      return new AINetworkError(error.message, error);
    }
  }

  // 未知错误
  return new AIError(
    AIErrorType.UNKNOWN,
    error instanceof Error ? error.message : "未知错误",
    error,
    false
  );
}

/**
 * 重试配置
 */
export interface RetryConfig {
  maxRetries: number; // 最大重试次数
  initialDelayMs: number; // 初始延迟（毫秒）
  maxDelayMs: number; // 最大延迟（毫秒）
  backoffMultiplier: number; // 退避倍数
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2, // 重试 2 次（总共尝试 3 次）
  initialDelayMs: 2000, // 初始延迟 2 秒
  maxDelayMs: 10000, // 最大延迟 10 秒
  backoffMultiplier: 2, // 指数退避：2秒 -> 4秒
};

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行器
 *
 * 对于可重试的错误（如中转站故障），自动重试指定次数
 *
 * @param fn - 要执行的异步函数
 * @param config - 重试配置（可选）
 * @returns 执行结果
 * @throws 如果所有重试都失败，抛出最后一次的错误
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: AIError;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const aiError = classifyAIError(error);

      // 如果不可重试，直接抛出
      if (!aiError.retryable) {
        throw aiError;
      }

      lastError = aiError;

      // 如果还有重试机会，等待后重试
      if (attempt < retryConfig.maxRetries) {
        const delayMs = Math.min(
          retryConfig.initialDelayMs *
            Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelayMs
        );

        console.warn(
          `AI 调用失败（尝试 ${attempt + 1}/${
            retryConfig.maxRetries + 1
          }），${delayMs}ms 后重试...`,
          aiError.message
        );

        await delay(delayMs);
      }
    }
  }

  // 所有重试都失败
  console.error(
    `AI 调用失败，已重试 ${retryConfig.maxRetries} 次，放弃重试`,
    lastError!
  );
  throw lastError!;
}

/**
 * 获取用户友好的错误消息
 *
 * 根据错误类型返回适合展示给用户的消息
 *
 * @param error - AIError 实例
 * @returns 用户友好的错误消息
 */
export function getUserFriendlyMessage(error: AIError): string {
  switch (error.type) {
    case AIErrorType.TIMEOUT:
      return "AI 服务响应超时，请稍后重试或联系管理员";

    case AIErrorType.NETWORK:
      return "AI 服务暂时不可用（可能是中转站故障），请稍后重试或联系管理员";

    case AIErrorType.API_ERROR:
      if (error instanceof AIAPIError && error.statusCode === 429) {
        return "AI 服务请求过于频繁，请稍后重试";
      }
      if (error instanceof AIAPIError && error.statusCode >= 500) {
        return "AI 服务器出现问题，请稍后重试或联系管理员";
      }
      return "AI 服务暂时不可用，请稍后重试或联系管理员";

    case AIErrorType.PARSE_ERROR:
    case AIErrorType.VALIDATION_ERROR:
      return "AI 返回数据格式异常，请重试或联系管理员";

    default:
      return "AI 服务暂时不可用，请稍后重试或联系管理员";
  }
}
