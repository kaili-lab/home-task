import { Hono } from "hono";
import type { Bindings } from "./types/bindings";
import type { AppVariables } from "./types/variables";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth.middleware";
import { dbMiddleware } from "./middleware/db.middleware";
import { requireAuth } from "./middleware/require-auth.middleware";
import usersRoutes from "./routes/users.routes";
import groupsRoutes from "./routes/groups.routes";
import tasksRoutes from "./routes/tasks.routes";
import devicesRoutes from "./routes/devices.routes";
import aiRoutes from "./routes/ai.routes";
import { DeviceService } from "./services/device.service";
import { successResponse } from "./utils/route-helpers";
import { handleServiceError } from "./utils/error-handler";
import { getAllowedOrigins } from "./utils/cors";

// 这个泛型是为了给Hono对象做类型标注的
// Bindings告诉 Hono，c.env 里面有哪些环境变量，Variables定义了上下文变量的类型（比如中间件设置的变量）
// Variables: AppVariables：告诉 Hono，c.set() / c.get() 里面可以存取哪些上下文变量，比如 auth 和 db
const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
// 临时开关：设备公开任务接口先下线，避免在鉴权方案未完成前暴露任务数据
const ENABLE_PUBLIC_DEVICE_TASKS_ENDPOINT = false;

// ==================== 全局中间件 ====================
// 顺序是很重要的：在 Hono 里，中间件也是按你注册的先后顺序执行的
app.use("*", logger());
app.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin: getAllowedOrigins(c.env),
    credentials: true, // 支持 cookies
  });

  return corsMiddleware(c, next);
});

// 数据库和认证中间件
app.use("*", dbMiddleware);
app.use("*", authMiddleware);

// Better Auth 路由（必须在 requireAuth 之前注册）
// Better Auth会自动处理所有 /api/auth/* 路径的请求
app.all("/api/auth/*", async (c) => {
  const auth = c.get("auth");
  const response = await auth.handler(c.req.raw);
  return response;
});

// ==================== API 路由 ====================
if (ENABLE_PUBLIC_DEVICE_TASKS_ENDPOINT) {
  // 设备任务端点（公开端点，用于硬件调用，在 requireAuth 之前注册）
  // 先保留实现但默认关闭，后续接入设备密钥鉴权后再开启
  app.get("/api/devices/:deviceId/tasks", async (c) => {
    try {
      const db = c.get("db");
      const deviceId = c.req.param("deviceId");

      if (!deviceId) {
        return c.json(
          {
            success: false,
            error: "设备ID不能为空",
          },
          400,
        );
      }

      const deviceService = new DeviceService(db);
      const tasks = await deviceService.getDeviceTasks(deviceId);

      return c.json(
        successResponse({
          tasks,
          lastUpdated: new Date().toISOString(),
        }),
      );
    } catch (error) {
      return handleServiceError(c, error);
    }
  });
}

// 需要认证的路由
app.use("/api/*", requireAuth);
app.route("/api/users", usersRoutes);
app.route("/api/groups", groupsRoutes);
app.route("/api/tasks", tasksRoutes);
app.route("/api/ai", aiRoutes);
app.route("/api/devices", devicesRoutes);

export default app;
