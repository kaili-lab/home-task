import type { Context } from "hono";
import { ZodError } from "zod";

/**
 * 标准错误码
 */
export enum ErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * 自定义应用错误类
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * 格式化Zod验证错误
 */
export function formatZodError(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
}

/**
 * 统一错误响应格式
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: ErrorCode;
  details?: unknown;
}

const INTERNAL_ERROR_MESSAGE = "服务内部错误，请稍后重试";

type MappedError = {
  code: ErrorCode;
  status: 400 | 401 | 403 | 404 | 409 | 429;
  productionMessage: string;
};

function includesAny(message: string, patterns: string[]): boolean {
  const normalized = message.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function mapErrorMessage(message: string): MappedError | null {
  if (
    includesAny(message, [
      "unauthorized",
      "not authenticated",
      "authentication",
      "未授权",
      "未登录",
      "登录失效",
    ])
  ) {
    return {
      code: ErrorCode.UNAUTHORIZED,
      status: 401,
      productionMessage: "未授权，请重新登录",
    };
  }

  if (
    includesAny(message, [
      "not found",
      "does not exist",
      "不存在",
      "未找到",
      "找不到",
    ])
  ) {
    return {
      code: ErrorCode.NOT_FOUND,
      status: 404,
      productionMessage: "资源不存在",
    };
  }

  if (
    includesAny(message, [
      "permission",
      "forbidden",
      "not allowed",
      "无权",
      "权限",
      "禁止访问",
      "只有",
    ])
  ) {
    return {
      code: ErrorCode.FORBIDDEN,
      status: 403,
      productionMessage: "无权限执行该操作",
    };
  }

  if (
    includesAny(message, [
      "duplicate",
      "already exists",
      "conflict",
      "已存在",
      "重复",
      "冲突",
    ])
  ) {
    return {
      code: ErrorCode.CONFLICT,
      status: 409,
      productionMessage: "资源状态冲突，请检查后重试",
    };
  }

  if (
    includesAny(message, [
      "too many requests",
      "rate limit",
      "请求过于频繁",
      "尝试次数过多",
    ])
  ) {
    return {
      code: ErrorCode.TOO_MANY_REQUESTS,
      status: 429,
      productionMessage: "请求过于频繁，请稍后重试",
    };
  }

  if (
    includesAny(message, [
      "invalid",
      "validation",
      "required",
      "must",
      "无效",
      "不能为空",
      "格式错误",
      "参数错误",
    ])
  ) {
    return {
      code: ErrorCode.VALIDATION_ERROR,
      status: 400,
      productionMessage: "请求参数不合法",
    };
  }

  return null;
}

function isProduction(c: Context): boolean {
  const envFromContext = (c as { env?: { NODE_ENV?: string } }).env?.NODE_ENV;
  const nodeEnv =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.NODE_ENV;
  const env = envFromContext || nodeEnv;
  return env === "production";
}

/**
 * 处理服务层错误
 *
 * 根据错误类型返回适当的 HTTP 状态码和错误消息
 *
 * @param c - Hono Context
 * @param error - 错误对象
 * @param defaultMessage - 默认错误消息
 * @returns HTTP 响应
 */
export function handleServiceError(
  c: Context,
  error: unknown,
  defaultMessage: string = "操作失败，请稍后重试"
) {
  const prod = isProduction(c);
  console.error("Service error:", error);

  // Zod验证错误
  if (error instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: "输入验证失败",
        code: ErrorCode.VALIDATION_ERROR,
        details: formatZodError(error),
      } as ErrorResponse,
      400
    );
  }

  // 自定义应用错误
  if (error instanceof AppError) {
    const statusCode = error.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503;
    const isInternal = statusCode >= 500 || error.code === ErrorCode.INTERNAL_ERROR;
    const safeMessage = prod && isInternal ? INTERNAL_ERROR_MESSAGE : error.message;

    return c.json(
      {
        success: false,
        error: safeMessage,
        code: error.code,
        details: !prod ? error.details : undefined,
      } as ErrorResponse,
      statusCode
    );
  }

  // 普通Error对象
  if (error instanceof Error) {
    // 特定错误类型的处理
    if (error.message.includes("Google NLP API")) {
      return c.json(
        {
          success: false,
          error: "调用 Google NLP 服务失败，请稍后重试",
          code: ErrorCode.INTERNAL_ERROR,
        } as ErrorResponse,
        503
      );
    }

    if (error.message.includes("AI") || error.message.includes("OpenAI")) {
      return c.json(
        {
          success: false,
          error: "AI 服务暂时不可用，请稍后重试",
          code: ErrorCode.INTERNAL_ERROR,
        } as ErrorResponse,
        503
      );
    }

    // 根据错误消息映射常见业务错误，避免错误状态码全落到 500
    const mapped = mapErrorMessage(error.message);
    if (mapped) {
      return c.json(
        {
          success: false,
          error: prod ? mapped.productionMessage : error.message,
          code: mapped.code,
        } as ErrorResponse,
        mapped.status
      );
    }

    // 未识别错误：开发环境保留原始错误，生产环境返回通用文案，避免泄露内部实现细节
    return c.json(
      {
        success: false,
        error: prod ? INTERNAL_ERROR_MESSAGE : error.message,
        code: ErrorCode.INTERNAL_ERROR,
      } as ErrorResponse,
      500
    );
  }

  // 未知错误，返回默认消息
  return c.json(
    {
      success: false,
      error: defaultMessage,
      code: ErrorCode.INTERNAL_ERROR,
    } as ErrorResponse,
    500
  );
}

/**
 * 创建标准错误对象
 */
export function createError(
  code: ErrorCode,
  message: string,
  statusCode: number = 500,
  details?: unknown
): AppError {
  return new AppError(code, message, statusCode, details);
}
