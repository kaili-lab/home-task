import { describe, it, expect, vi } from "vitest";
import { handleServiceError, ErrorCode } from "../utils/error-handler";

function createMockContext(nodeEnv: "production" | "development" = "development") {
  return {
    env: { NODE_ENV: nodeEnv },
    json: vi.fn((data: unknown, status: number) => ({ data, status })),
  } as any;
}

describe("error-handler", () => {
  it("生产环境遇到未知错误应隐藏内部信息", () => {
    const c = createMockContext("production");
    const result = handleServiceError(c, new Error("database connection failed"));

    expect(result.status).toBe(500);
    expect(result.data).toMatchObject({
      success: false,
      code: ErrorCode.INTERNAL_ERROR,
      error: "服务内部错误，请稍后重试",
    });
  });

  it("开发环境遇到未知错误应保留原始错误信息", () => {
    const c = createMockContext("development");
    const result = handleServiceError(c, new Error("database connection failed"));

    expect(result.status).toBe(500);
    expect(result.data.error).toBe("database connection failed");
  });

  it("应将英文 not found 映射为 404", () => {
    const c = createMockContext("production");
    const result = handleServiceError(c, new Error("Task not found."));

    expect(result.status).toBe(404);
    expect(result.data).toMatchObject({
      code: ErrorCode.NOT_FOUND,
      error: "资源不存在",
    });
  });

  it("应将权限类错误映射为 403", () => {
    const c = createMockContext("production");
    const result = handleServiceError(c, new Error("You do not have permission to view this task."));

    expect(result.status).toBe(403);
    expect(result.data.code).toBe(ErrorCode.FORBIDDEN);
  });

  it("应将冲突类错误映射为 409", () => {
    const c = createMockContext("production");
    const result = handleServiceError(c, new Error("duplicate key value violates unique constraint"));

    expect(result.status).toBe(409);
    expect(result.data.code).toBe(ErrorCode.CONFLICT);
  });

  it("应将限流类错误映射为 429", () => {
    const c = createMockContext("production");
    const result = handleServiceError(c, new Error("Too many requests, please slow down."));

    expect(result.status).toBe(429);
    expect(result.data.code).toBe(ErrorCode.TOO_MANY_REQUESTS);
  });

  it("应将未授权错误映射为 401", () => {
    const c = createMockContext("production");
    const result = handleServiceError(c, new Error("Unauthorized"));

    expect(result.status).toBe(401);
    expect(result.data.code).toBe(ErrorCode.UNAUTHORIZED);
  });
});
