// API响应类型定义

/**
 * 成功响应格式
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * 错误响应格式
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
}

/**
 * API响应联合类型
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
