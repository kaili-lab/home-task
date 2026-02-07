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

// ==================== 全局中间件 ====================
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173"],
    credentials: true, // 支持 cookies
  }),
);

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

// 健康检查端点（无需认证）
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// ==================== API 路由 ====================
// 设备任务端点（公开端点，用于硬件调用，在requireAuth之前注册）
// 注意：生产环境应添加设备密钥认证
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

// 需要认证的路由
app.use("/api/*", requireAuth);
app.route("/api/users", usersRoutes);
app.route("/api/groups", groupsRoutes);
app.route("/api/tasks", tasksRoutes);
app.route("/api/ai", aiRoutes);
app.route("/api/devices", devicesRoutes);

export default app;
