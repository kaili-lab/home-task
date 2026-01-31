import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

/**
 * Better Auth 客户端实例
 * 用于前端认证操作（登录、注册、登出等）
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  plugins: [usernameClient()],
});

/**
 * 获取 session hook
 * 用于在组件中获取当前用户会话
 */
export const { useSession } = authClient;
