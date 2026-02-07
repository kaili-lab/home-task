import type { ApiResponse, ApiSuccessResponse, ApiErrorResponse } from "shared";

/**
 * API基础URL，从环境变量读取
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

/**
 * HTTP请求选项
 */
interface RequestOptions extends RequestInit {
  /**
   * 是否跳过自动错误处理（默认false）
   * 设置为true时，即使响应失败也不会抛出错误，而是返回完整的响应对象
   */
  skipErrorHandling?: boolean;
}

/**
 * API错误类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: ApiErrorResponse
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 发起HTTP请求
 *
 * @param endpoint - API端点（相对于基础URL的路径，如 "/api/tasks"）
 * @param options - fetch选项
 * @returns Promise<ApiSuccessResponse<T>>
 * @throws ApiError 当请求失败时
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiSuccessResponse<T>> {
  const { skipErrorHandling = false, ...fetchOptions } = options;

  // 构建完整URL
  const url = `${API_BASE_URL}${endpoint}`;

  // 设置默认请求头
  const headers = new Headers(fetchOptions.headers);
  if (!headers.has("Content-Type") && fetchOptions.body instanceof FormData === false) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("X-Timezone-Offset")) {
    headers.set("X-Timezone-Offset", String(new Date().getTimezoneOffset()));
  }
  if (!headers.has("X-Timezone")) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) headers.set("X-Timezone", timeZone);
  }

  // 发起请求
  // 注意：Better Auth使用Cookie进行认证，浏览器会自动携带Cookie
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: "include", // 确保Cookie被发送
  });

  // 解析响应
  let data: ApiResponse<T>;
  try {
    data = await response.json();
  } catch (error) {
    // 如果响应不是JSON格式
    if (!response.ok) {
      throw new ApiError(
        `请求失败: ${response.statusText}`,
        response.status
      );
    }
    throw new ApiError("响应格式错误", response.status);
  }

  // 处理错误响应
  if (!data.success) {
    const errorResponse = data as ApiErrorResponse;
    const error = new ApiError(
      errorResponse.error || "请求失败",
      response.status,
      errorResponse
    );

    // 处理401未授权错误
    if (response.status === 401) {
      // 可以在这里添加跳转到登录页的逻辑
      // window.location.href = "/login";
    }

    if (skipErrorHandling) {
      throw error;
    }

    // 统一错误处理：可以在这里添加toast提示等
    throw error;
  }

  // 返回成功响应
  return data as ApiSuccessResponse<T>;
}

/**
 * GET请求
 */
export function apiGet<T>(endpoint: string, options?: RequestOptions) {
  return apiRequest<T>(endpoint, {
    ...options,
    method: "GET",
  });
}

/**
 * POST请求
 */
export function apiPost<T>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions
) {
  return apiRequest<T>(endpoint, {
    ...options,
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

/**
 * PATCH请求
 */
export function apiPatch<T>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions
) {
  return apiRequest<T>(endpoint, {
    ...options,
    method: "PATCH",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

/**
 * DELETE请求
 */
export function apiDelete<T>(endpoint: string, options?: RequestOptions) {
  return apiRequest<T>(endpoint, {
    ...options,
    method: "DELETE",
  });
}
