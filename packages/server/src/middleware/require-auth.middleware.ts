import { createMiddleware } from "hono/factory";
import type { Bindings } from "../types/bindings";
import type { AppVariables } from "../types/variables";

const PUBLIC_PATHS = [
  "/api/auth", // Better Auth 所有路由
  "/health", // 健康检查
  "/api/examples/public-template", // 示例：公共路由模板
];

export const requireAuth = createMiddleware<{
  Bindings: Bindings;
  Variables: AppVariables;
}>(async (c, next) => {
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }

  const path = c.req.path;
  const isPublic = PUBLIC_PATHS.some((publicPath) =>
    path.startsWith(publicPath)
  );

  if (isPublic) {
    await next();
    return;
  }

  const auth = c.get("auth");
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json(
      {
        success: false,
        error: "Unauthorized",
      },
      401
    );
  }

  c.set("session", session);

  await next();
});
