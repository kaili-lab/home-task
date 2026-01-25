import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthenticatedVariables } from "../types/variables";
import type { Bindings } from "../types/bindings";
import { DeviceService } from "../services/device.service";
import { getUserId, successResponse } from "../utils/route-helpers";
import { handleServiceError } from "../utils/error-handler";

const devicesRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AuthenticatedVariables;
}>();

// 绑定设备的Zod Schema
const createDeviceSchema = z.object({
  deviceId: z.string().min(1).max(100),
  name: z.string().min(1).max(50),
  userId: z.number().int().positive().nullable().optional(),
  groupId: z.number().int().positive().nullable().optional(),
}).refine(
  (data) => (data.userId !== null && data.userId !== undefined) !== (data.groupId !== null && data.groupId !== undefined),
  {
    message: "userId和groupId必须二选一",
  }
);

/**
 * POST /api/devices
 * 绑定设备
 */
devicesRoutes.post("/", zValidator("json", createDeviceSchema), async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const data = c.req.valid("json");

    const deviceService = new DeviceService(db);
    const device = await deviceService.createDevice(userId, data);

    return c.json(successResponse(device), 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * GET /api/devices
 * 获取我的设备列表
 */
devicesRoutes.get("/", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);

    const deviceService = new DeviceService(db);
    const devices = await deviceService.getUserDevices(userId);

    return c.json(successResponse({ devices }));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// 注意：设备任务端点 /api/devices/:deviceId/tasks 在 index.ts 中单独注册为公开端点

/**
 * DELETE /api/devices/:id
 * 解绑设备
 */
devicesRoutes.delete("/:id", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const deviceId = c.req.param("id");

    if (!deviceId) {
      return c.json(
        {
          success: false,
          error: "设备ID不能为空",
        },
        400
      );
    }

    const deviceService = new DeviceService(db);
    await deviceService.deleteDevice(deviceId, userId);

    return c.json(successResponse({ message: "设备已解绑" }));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

export default devicesRoutes;
