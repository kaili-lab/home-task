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
    return c.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
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

    // 根据错误消息判断错误类型
    if (error.message.includes("不存在") || error.message.includes("未找到")) {
      return c.json(
        {
          success: false,
          error: error.message,
          code: ErrorCode.NOT_FOUND,
        } as ErrorResponse,
        404
      );
    }

    if (
      error.message.includes("无权") ||
      error.message.includes("权限") ||
      error.message.includes("只有")
    ) {
      return c.json(
        {
          success: false,
          error: error.message,
          code: ErrorCode.FORBIDDEN,
        } as ErrorResponse,
        403
      );
    }

    if (
      error.message.includes("已存在") ||
      error.message.includes("重复") ||
      error.message.includes("冲突")
    ) {
      return c.json(
        {
          success: false,
          error: error.message,
          code: ErrorCode.CONFLICT,
        } as ErrorResponse,
        409
      );
    }

    // 返回具体错误消息
    return c.json(
      {
        success: false,
        error: error.message,
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
