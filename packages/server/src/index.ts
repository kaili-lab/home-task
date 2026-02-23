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

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
// 临时开关：设备公开任务接口先下线，避免在鉴权方案未完成前暴露任务数据
const ENABLE_PUBLIC_DEVICE_TASKS_ENDPOINT = false;
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173"];

function appendAllowedOrigins(target: Set<string>, value?: string): void {
  if (!value) return;
  const candidates = value.split(",");
  for (const rawCandidate of candidates) {
    const candidate = rawCandidate.trim();
    if (!candidate) continue;

    try {
      target.add(new URL(candidate).origin);
    } catch {
      // 忽略非法 URL，避免因为配置错误导致服务启动失败
    }
  }
}

function getAllowedOrigins(env: Bindings): string[] {
  const origins = new Set(DEFAULT_ALLOWED_ORIGINS);
  appendAllowedOrigins(origins, env.FRONTEND_URL);
  appendAllowedOrigins(origins, env.BETTER_AUTH_URL);
  return Array.from(origins);
}

// ==================== 全局中间件 ====================
app.use("*", logger());
app.use("*", async (c, next) => {
  // 按请求动态读取环境变量，兼容本地/同域/跨域部署三种场景
  const allowedOrigins = getAllowedOrigins(c.env);
  const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return allowedOrigins[0] || DEFAULT_ALLOWED_ORIGINS[0];
      return allowedOrigins.includes(origin) ? origin : "";
    },
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
