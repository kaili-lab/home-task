import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

/**
 * Better Auth 客户端实例
 * 用于前端认证操作（登录、注册、登出等）
 */
const AUTH_BASE_URL = (
  import.meta.env.VITE_AUTH_BASE_URL || import.meta.env.VITE_API_BASE_URL || ""
)
  .trim()
  .replace(/\/+$/, "");
const SAME_ORIGIN_BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

export const authClient = createAuthClient({
  // 默认同域，跨域部署时再通过 VITE_AUTH_BASE_URL / VITE_API_BASE_URL 显式配置
  baseURL: AUTH_BASE_URL || SAME_ORIGIN_BASE_URL,
  plugins: [usernameClient()],
});

/**
 * 获取 session hook
 * 用于在组件中获取当前用户会话
 */
export const { useSession } = authClient;
