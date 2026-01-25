import type { Context } from "hono";

/**
 * 检查 session 是否存在，如果不存在则返回 401 响应
 */
export function ensureAuthenticated(c: Context): Response | null {
  const session = c.get("session");

  if (!session) {
    return c.json(
      {
        success: false,
        error: "Unauthorized",
      },
      401
    );
  }

  return null;
}
